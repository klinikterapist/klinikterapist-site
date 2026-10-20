/**
 * The anonymous page counter (Panel v3 Plan C, Task C5). Hits land in Istanbul hour buckets in
 * Script Properties (`st:h:<YYYYMMDDHH>`, listed in `st:idx`) under the script lock. Buckets older
 * than the current hour are rolled into monthly Drive files `istatistik/<YYYY-MM>.json`, shaped
 * `{ days: { 'YYYY-MM-DD': DayCounts } }`: on the first hit of a new hour and before every summary,
 * so no time trigger (and no extra OAuth scope) is needed.
 *
 * `stats.hit` is public and never reads data or returns error details; `stats.reads` is public and
 * returns only reads per post key (for the site build); `stats.summary` needs the owner's session.
 */
import { hitKeys, hourDay, istanbulDay, istanbulHour, parseHit, readsByPost, type DayCounts, type StatsSummary } from '../../src/lib/stats-wire';
import type { FolderLike, Gas } from './gas';
import { badRequest } from './respond';
import { DAY_RE } from '../../src/lib/field-rules';

const IDX = 'st:idx';
const SINCE = 'st:since';
const bucketKey = (hour: string) => `st:h:${hour}`;
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

const index = (gas: Gas) => readJson<string[]>(gas.props.get(IDX), []);

function statsFolder(gas: Gas, create: boolean): FolderLike | null {
  const root = gas.drive.rootFolder();
  return root.findFolder('istatistik') ?? (create ? root.createFolder('istatistik') : null);
}

function addInto(target: DayCounts, src: DayCounts) {
  for (const [k, n] of Object.entries(src)) if (Number.isFinite(n)) target[k] = (target[k] ?? 0) + n;
}

/** Moves every bucket older than `currentHour` into its month file. Call under the lock. */
function flushOld(gas: Gas, currentHour: string): void {
  const idx = index(gas);
  const old = idx.filter((h) => h < currentHour);
  if (!old.length) return;
  const byMonth = new Map<string, string[]>();
  for (const h of old) byMonth.set(h.slice(0, 6), [...(byMonth.get(h.slice(0, 6)) ?? []), h]);
  const folder = statsFolder(gas, true)!;
  for (const [ym, hours] of byMonth) {
    const name = `${ym.slice(0, 4)}-${ym.slice(4, 6)}.json`;
    const file = folder.findFile(name);
    const data = readJson<MonthFile>(file?.read() ?? null, { days: {} });
    for (const h of hours) {
      const day = hourDay(h);
      data.days[day] ??= {};
      addInto(data.days[day], readJson<DayCounts>(gas.props.get(bucketKey(h)), {}));
    }
    const text = JSON.stringify(data);
    if (file) file.write(text);
    else folder.createFile(name, text, 'json');
  }
  // Only after every month file is written: a failed write keeps the buckets for the next try.
  for (const h of old) gas.props.del(bucketKey(h));
  gas.props.set(IDX, JSON.stringify(idx.filter((h) => h >= currentHour)));
  gas.cache.put(READS_CACHE, '', 1);
}

/** Public. Counts one hit; invalid input is ignored. Always returns `{}`. */
export function recordHit(gas: Gas, body: unknown): Record<string, never> {
  const hit = parseHit(body);
  if (!hit) return {};
  const keys = hitKeys(hit);
  const rateKey = `st:rate:${istanbulHour(gas.now())}`;
  const seen = Number(gas.cache.get(rateKey) ?? '0') || 0;
  if (seen >= MAX_HITS_PER_HOUR) return {};
  gas.cache.put(rateKey, String(seen + 1), 3700);
  gas.withLock(() => {
    const now = gas.now();
    const hour = istanbulHour(now);
    try {
      flushOld(gas, hour);
    } catch (e) {
      gas.log(`stats.flush: ${e instanceof Error ? e.message : String(e)}`);
    }
    const bucket = readJson<DayCounts>(gas.props.get(bucketKey(hour)), {});
    let size = Object.keys(bucket).length;
    for (const k of keys) {
      if (bucket[k] === undefined) {
        if (size >= MAX_BUCKET_KEYS) continue;
        size += 1;
      }
      bucket[k] = (bucket[k] ?? 0) + 1;
    }
    const text = JSON.stringify(bucket);
    if (text.length > MAX_BUCKET_BYTES) return;
    gas.props.set(bucketKey(hour), text);
    const idx = index(gas);
    if (!idx.includes(hour)) gas.props.set(IDX, JSON.stringify([...idx, hour]));
    if (!gas.props.get(SINCE)) gas.props.set(SINCE, istanbulDay(now));
  });
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

/** Owner only. Day counts in [from, to] (Istanbul days), including the hour not yet rolled up. */
export function statsSummary(gas: Gas, p: Record<string, unknown>): StatsSummary {
  const from = day(p.from);
  const to = day(p.to);
  if (from > to) throw badRequest('Geçersiz tarih aralığı.');
  return gas.withLock(() => {
    const hour = istanbulHour(gas.now());
    flushOld(gas, hour);
    const days: Record<string, DayCounts> = {};
    const folder = statsFolder(gas, false);
    for (const ym of monthsBetween(from, to)) {
      const data = readJson<MonthFile>(folder?.findFile(`${ym}.json`)?.read() ?? null, { days: {} });
      for (const [d, counts] of Object.entries(data.days)) {
        if (d >= from && d <= to) days[d] = { ...counts };
      }
    }
    const current = hourDay(hour);
    if (current >= from && current <= to) {
      days[current] ??= {};
      addInto(days[current], readJson<DayCounts>(gas.props.get(bucketKey(hour)), {}));
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
