/**
 * The anonymous page counter (Panel v3 Plan C, Task C5). Hits land in Istanbul hour buckets in
 * Script Properties, spread over a few shards (`st:h:<YYYYMMDDHH>:<n>`). A hit takes no lock
 * (night review B2-2): the script lock is shared with the panel and the booking files, and a busy
 * page must not make them wait. Two hits on the same shard at the same moment may lose one count;
 * the shards make that rare, and the counter is approximate anyway.
 * Buckets at least an hour old are rolled into monthly Drive files `istatistik/<YYYY-MM>.json`,
 * shaped `{ days: { 'YYYY-MM-DD': DayCounts } }`, under the lock: by the hourly trigger and before
 * every summary. The hour of margin keeps a hit that started before the hour turned from writing
 * into a bucket that was already rolled up.
 *
 * `stats.hit` is public and never reads data or returns error details; `stats.reads` is public and
 * returns only reads per post key (for the site build); `stats.summary` needs the owner's session.
 */
import { hitKeys, hourDay, istanbulDay, istanbulHour, parseHit, readsByPost, type DayCounts, type StatsSummary } from '../../src/lib/stats-wire';
import type { FolderLike, Gas } from './gas';
import { badRequest } from './respond';
import { DAY_RE } from '../../src/lib/field-rules';

/** The list of hours of the earlier, locked version; dropped on the first roll-up. */
const OLD_IDX = 'st:idx';
const SINCE = 'st:since';
export const SHARDS = 4;
const shardKey = (hour: string, n: number) => `st:h:${hour}:${n}`;
/** `st:h:<hour>:<n>`, or `st:h:<hour>` from the earlier version. */
const BUCKET = /^st:h:(\d{10})(?::\d+)?$/;
/** A bucket keeps counting its existing keys but takes no new ones past this (junk paths). */
export const MAX_BUCKET_KEYS = 200;
/** Script Properties allows about 9 KB per value. */
const MAX_BUCKET_BYTES = 8000;
const READS_CACHE = 'st:reads';
/** Flood guard: hits past this many in one hour are dropped before the lock (cache counter, approximate). */
export const MAX_HITS_PER_HOUR = 3000;

type MonthFile = { days: Record<string, DayCounts> };

function readJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Every bucket not yet rolled up, with its hour. */
function buckets(gas: Gas): { key: string; hour: string }[] {
  return Object.keys(gas.props.all()).flatMap((key) => {
    const m = BUCKET.exec(key);
    return m ? [{ key, hour: m[1] }] : [];
  });
}

function statsFolder(gas: Gas, create: boolean): FolderLike | null {
  const root = gas.drive.rootFolder();
  return root.findFolder('istatistik') ?? (create ? root.createFolder('istatistik') : null);
}

function addInto(target: DayCounts, src: DayCounts) {
  for (const [k, n] of Object.entries(src)) if (Number.isFinite(n)) target[k] = (target[k] ?? 0) + n;
}

/** Moves every bucket of an hour before `before` into its month file. Call under the lock. */
function flushBefore(gas: Gas, before: string): void {
  const old = buckets(gas).filter((b) => b.hour < before);
  if (!old.length) {
    gas.props.del(OLD_IDX);
    return;
  }
  const byMonth = new Map<string, typeof old>();
  for (const b of old) byMonth.set(b.hour.slice(0, 6), [...(byMonth.get(b.hour.slice(0, 6)) ?? []), b]);
  const folder = statsFolder(gas, true)!;
  for (const [ym, list] of byMonth) {
    const name = `${ym.slice(0, 4)}-${ym.slice(4, 6)}.json`;
    const file = folder.findFile(name);
    const data = readJson<MonthFile>(file?.read() ?? null, { days: {} });
    for (const b of list) {
      const day = hourDay(b.hour);
      data.days[day] ??= {};
      addInto(data.days[day], readJson<DayCounts>(gas.props.get(b.key), {}));
    }
    const text = JSON.stringify(data);
    if (file) file.write(text);
    else folder.createFile(name, text, 'json');
  }
  // Only after every month file is written: a failed write keeps the buckets for the next try.
  for (const b of old) gas.props.del(b.key);
  gas.props.del(OLD_IDX);
  gas.cache.put(READS_CACHE, '', 1);
}

/** Rolls up every bucket at least an hour old (the hourly trigger; summaries do it too). */
export function flushStats(gas: Gas): void {
  gas.withLock(() => flushBefore(gas, istanbulHour(gas.now() - 3600e3)));
}

/** Public. Counts one hit, without the lock; invalid input is ignored. Always returns `{}`. */
export function recordHit(gas: Gas, body: unknown): Record<string, never> {
  const hit = parseHit(body);
  if (!hit) return {};
  const keys = hitKeys(hit);
  const now = gas.now();
  const hour = istanbulHour(now);
  const rateKey = `st:rate:${hour}`;
  const seen = Number(gas.cache.get(rateKey) ?? '0') || 0;
  if (seen >= MAX_HITS_PER_HOUR) return {};
  gas.cache.put(rateKey, String(seen + 1), 3700);
  const key = shardKey(hour, parseInt(gas.uuid().replace(/-/g, '').slice(-1), 16) % SHARDS);
  const bucket = readJson<DayCounts>(gas.props.get(key), {});
  let size = Object.keys(bucket).length;
  for (const k of keys) {
    if (bucket[k] === undefined) {
      if (size >= MAX_BUCKET_KEYS) continue;
      size += 1;
    }
    bucket[k] = (bucket[k] ?? 0) + 1;
  }
  const text = JSON.stringify(bucket);
  if (text.length > MAX_BUCKET_BYTES) return {};
  gas.props.set(key, text);
  if (!gas.props.get(SINCE)) gas.props.set(SINCE, istanbulDay(now));
  return {};
}

function day(value: unknown): string {
  if (typeof value !== 'string' || !DAY_RE.test(value)) throw badRequest('Geçersiz tarih aralığı.');
  return value;
}

/** Months `YYYY-MM` from `from` to `to`, inclusive. */
function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = +from.slice(0, 4);
  let m = +from.slice(5, 7);
  const endY = +to.slice(0, 4);
  const endM = +to.slice(5, 7);
  while ((y < endY || (y === endY && m <= endM)) && out.length < 240) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Owner only. Day counts in [from, to] (Istanbul days), including the hours not yet rolled up. */
export function statsSummary(gas: Gas, p: Record<string, unknown>): StatsSummary {
  const from = day(p.from);
  const to = day(p.to);
  if (from > to) throw badRequest('Geçersiz tarih aralığı.');
  return gas.withLock(() => {
    flushBefore(gas, istanbulHour(gas.now() - 3600e3));
    const days: Record<string, DayCounts> = {};
    const folder = statsFolder(gas, false);
    for (const ym of monthsBetween(from, to)) {
      const data = readJson<MonthFile>(folder?.findFile(`${ym}.json`)?.read() ?? null, { days: {} });
      for (const [d, counts] of Object.entries(data.days)) {
        if (d >= from && d <= to) days[d] = { ...counts };
      }
    }
    // The last hour or two, not rolled up yet.
    for (const b of buckets(gas)) {
      const d = hourDay(b.hour);
      if (d < from || d > to) continue;
      days[d] ??= {};
      addInto(days[d], readJson<DayCounts>(gas.props.get(b.key), {}));
    }
    return { days, since: gas.props.get(SINCE) };
  });
}

/** Public. Reads per post key over all time, for the site build. Cached for an hour. */
export function statsReads(gas: Gas): { counts: Record<string, number> } {
  const cached = gas.cache.get(READS_CACHE);
  if (cached) return { counts: readJson<Record<string, number>>(cached, {}) };
  const days: Record<string, DayCounts> = {};
  for (const file of statsFolder(gas, false)?.listFiles() ?? []) {
    if (!/^\d{4}-\d{2}\.json$/.test(file.getName())) continue;
    Object.assign(days, readJson<MonthFile>(file.read(), { days: {} }).days);
  }
  const counts = readsByPost(days);
  gas.cache.put(READS_CACHE, JSON.stringify(counts), 3600);
  return { counts };
}
