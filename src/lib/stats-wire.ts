/**
 * The anonymous page counter's wire format, shared by the site's beacon, the Apps Script backend and
 * the panel (Panel v3 Plan C, Task C5). A hit holds no identifier: the page path, the referrer's host
 * only, the device class (phone/tablet/desktop), the page language, and for a read or a click the
 * post key or link id. No cookie, no IP address, no full referrer URL.
 */
export type HitType = 'view' | 'read' | 'click';
export type Hit = { t: HitType; p?: string; r?: string; d?: 'm' | 't' | 'd'; l?: 'tr' | 'en'; k?: string };

/** Counter keys and their counts for one Istanbul day (or hour bucket). */
export type DayCounts = Record<string, number>;
/** `days` is keyed `YYYY-MM-DD` (Istanbul); `since` is the first day anything was counted. */
export type StatsSummary = { days: Record<string, DayCounts>; since: string | null };

const PATH_RE = /^\/[a-z0-9\-/]{0,120}$/;
const HOST_RE = /^[a-z0-9.-]{1,80}$/;
const POST_KEY_RE = /^[a-z0-9-]{1,80}$/;
const LINK_RE = /^[a-z0-9-]{1,40}$/;

/** A valid hit with only the known fields, or null. */
export function parseHit(body: unknown): Hit | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const t = b.t;
  if (t !== 'view' && t !== 'read' && t !== 'click') return null;
  const out: Hit = { t };
  if (t === 'view') {
    if (typeof b.p !== 'string' || !PATH_RE.test(b.p) || !b.p.endsWith('/') || b.p.includes('//')) return null;
    out.p = b.p;
    if (b.r !== undefined) {
      if (typeof b.r !== 'string' || !HOST_RE.test(b.r)) return null;
      out.r = b.r.replace(/^www\./, '');
    }
    if (b.d === 'm' || b.d === 't' || b.d === 'd') out.d = b.d;
    if (b.l === 'tr' || b.l === 'en') out.l = b.l;
    return out;
  }
  const re = t === 'read' ? POST_KEY_RE : LINK_RE;
  if (typeof b.k !== 'string' || !re.test(b.k)) return null;
  out.k = b.k;
  return out;
}

/** The counter keys one hit increments. */
export function hitKeys(h: Hit): string[] {
  if (h.t === 'read') return [`rd|${h.k}`];
  if (h.t === 'click') return [`c|${h.k}`];
  const keys = [`v|${h.p}`, `ref|${h.r ?? 'direct'}`];
  if (h.d) keys.push(`dev|${h.d}`);
  if (h.l) keys.push(`lang|${h.l}`);
  return keys;
}

/** Istanbul has used a fixed UTC+3 since 2016. */
const IST_OFFSET_MS = 3 * 60 * 60 * 1000;

/** `YYYYMMDDHH` of the Istanbul hour containing `ms`. */
export function istanbulHour(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 13).replace(/[-T]/g, '');
}

/** `YYYY-MM-DD` of an hour id (`YYYYMMDDHH`). */
export const hourDay = (hour: string) => `${hour.slice(0, 4)}-${hour.slice(4, 6)}-${hour.slice(6, 8)}`;

/** `YYYY-MM-DD` of the Istanbul day containing `ms`. */
export const istanbulDay = (ms: number) => hourDay(istanbulHour(ms));

/** Sum of `rd|<key>` over all days: reads per post key. */
export function readsByPost(days: Record<string, DayCounts>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const counts of Object.values(days)) {
    for (const [k, n] of Object.entries(counts)) {
      if (k.startsWith('rd|')) out[k.slice(3)] = (out[k.slice(3)] ?? 0) + n;
    }
  }
  return out;
}
