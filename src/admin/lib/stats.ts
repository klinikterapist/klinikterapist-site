/**
 * The Ana sayfa statistics (Panel v3 Plan C, Task C7): turns the counter's day counts into totals,
 * a daily series, top posts and pages, referrers, devices, languages and link clicks. Pure.
 */
import type { DayCounts, StatsSummary } from '../../lib/stats-wire';
import { pathFor, postPath } from '../../i18n/routes';
import type { Lang } from '../../lib/schemas';
import type { LivePost } from './publish';

export type Period = 7 | 30 | 90 | 'all';
export type Range = { from: string; to: string; prevFrom: string; prevTo: string };

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 3 * 3_600_000;
const dayOf = (ms: number) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
const msOf = (day: string) => Date.parse(`${day}T00:00:00Z`);
const addDays = (day: string, n: number) => new Date(msOf(day) + n * DAY_MS).toISOString().slice(0, 10);

/** The period's days (Istanbul) ending today, and the same-length period before it. */
export function rangeFor(p: Period, now: Date, since: string | null): Range {
  const to = dayOf(now.getTime());
  let from: string;
  if (p === 'all') from = since && since <= to ? since : to;
  else from = addDays(to, -(p - 1));
  const len = Math.round((msOf(to) - msOf(from)) / DAY_MS) + 1;
  return { from, to, prevFrom: addDays(from, -len), prevTo: addDays(from, -1) };
}

export type DashboardStats = {
  /** `postViews`: views of post pages only, the base of the read rate. */
  totals: { views: number; reads: number; clicks: number; postViews: number; prevViews: number; prevReads: number; prevClicks: number; prevPostViews: number };
  daily: { day: string; views: number; reads: number }[];
  topPosts: { key: string; title: string; views: number; reads: number; readRate: number | null }[];
  topPages: { path: string; label: string; views: number }[];
  referrers: { label: string; views: number }[];
  devices: { label: 'Telefon' | 'Tablet' | 'Bilgisayar'; views: number }[];
  langs: { label: 'Türkçe' | 'İngilizce'; views: number }[];
  clicks: { id: string; label: string; count: number }[];
};

/** Change in percent, or null when there was nothing before. */
export const change = (cur: number, prev: number): number | null => (prev === 0 ? null : Math.round(((cur - prev) / prev) * 100));

const PAGE_LABELS: [string, string][] = (
  [
    ['home', 'Ana sayfa'],
    ['about', 'Hakkımda'],
    ['blog', 'Blog'],
    ['resources', 'Kaynaklar'],
    ['contact', 'İletişim'],
    ['appointment', 'Randevu'],
    ['preConsult', 'Ön görüşme'],
    ['faq', 'Sık sorulan sorular'],
    ['popular', 'Popüler yazılar'],
    ['topics', 'Konular'],
    ['privacyNotice', 'Aydınlatma metni'],
    ['privacyPolicy', 'Gizlilik'],
  ] as const
).flatMap(([key, label]) => (['tr', 'en'] as Lang[]).map((l) => [pathFor(key, l), l === 'en' ? `${label} (EN)` : label] as [string, string]));
const PAGE_LABEL = new Map(PAGE_LABELS);

const CLICK_LABELS: Record<string, string> = {
  randevu: 'Randevu Al',
  email: 'E-posta',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  medium: 'Medium',
  substack: 'Substack (bülten)',
  youtube: 'YouTube',
  x: 'X',
  tiktok: 'TikTok',
  threads: 'Threads',
  whatsapp: 'WhatsApp paylaşımı',
};

function referrerLabel(host: string): string {
  if (host === 'direct') return 'Doğrudan';
  if (/(^|\.)instagram\.com$|^l\.instagram\.com$/.test(host)) return 'Instagram';
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'Google';
  if (/(^|\.)(bing\.com|duckduckgo\.com|yandex\.[a-z.]+)$/.test(host)) return 'Diğer arama motorları';
  if (/(^|\.)(t\.co|x\.com|twitter\.com)$/.test(host)) return 'X';
  if (/(^|\.)(linkedin\.com|lnkd\.in)$/.test(host)) return 'LinkedIn';
  if (/(^|\.)(facebook\.com|fb\.me)$/.test(host)) return 'Facebook';
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return 'WhatsApp';
  if (/(^|\.)substack\.com$/.test(host)) return 'Substack';
  if (/(^|\.)medium\.com$/.test(host)) return 'Medium';
  return 'Diğer siteler';
}

function sumRange(days: Record<string, DayCounts>, from: string, to: string): DayCounts {
  const out: DayCounts = {};
  for (const [d, counts] of Object.entries(days)) {
    if (d < from || d > to) continue;
    for (const [k, n] of Object.entries(counts)) out[k] = (out[k] ?? 0) + n;
  }
  return out;
}

const total = (c: DayCounts, prefix: string) => Object.entries(c).reduce((s, [k, n]) => (k.startsWith(prefix) ? s + n : s), 0);
const sortDesc = <T extends { views?: number; count?: number }>(list: T[]) => list.sort((a, b) => (b.views ?? b.count ?? 0) - (a.views ?? a.count ?? 0));

export function aggregate(s: StatsSummary, r: Range, posts: LivePost[]): DashboardStats {
  const cur = sumRange(s.days, r.from, r.to);
  const prev = sumRange(s.days, r.prevFrom, r.prevTo);

  const daily: DashboardStats['daily'] = [];
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
    const c = s.days[d] ?? {};
    daily.push({ day: d, views: total(c, 'v|'), reads: total(c, 'rd|') });
    if (daily.length > 3660) break;
  }

  const postByPath = new Map<string, LivePost>();
  for (const p of posts) {
    postByPath.set(postPath(p.tr.fm.slug, 'tr'), p);
    postByPath.set(postPath(p.en.fm.slug, 'en'), p);
  }
  const postViews = new Map<string, number>();
  const pageViews = new Map<string, number>();
  const ref = new Map<string, number>();
  const dev = { m: 0, t: 0, d: 0 };
  const lang = { tr: 0, en: 0 };
  const clicks: DashboardStats['clicks'] = [];
  const reads = new Map<string, number>();
  for (const [k, n] of Object.entries(cur)) {
    const [kind, value] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)];
    if (kind === 'v') {
      const post = postByPath.get(value);
      if (post) postViews.set(post.key, (postViews.get(post.key) ?? 0) + n);
      else pageViews.set(value, (pageViews.get(value) ?? 0) + n);
    } else if (kind === 'rd') reads.set(value, (reads.get(value) ?? 0) + n);
    else if (kind === 'ref') ref.set(referrerLabel(value), (ref.get(referrerLabel(value)) ?? 0) + n);
    else if (kind === 'dev' && value in dev) dev[value as keyof typeof dev] += n;
    else if (kind === 'lang' && value in lang) lang[value as keyof typeof lang] += n;
    else if (kind === 'c') clicks.push({ id: value, label: CLICK_LABELS[value] ?? value, count: n });
  }

  const postViewsIn = (c: DayCounts) => Object.entries(c).reduce((sum, [k, n]) => (k.startsWith('v|') && postByPath.has(k.slice(2)) ? sum + n : sum), 0);
  const titleOf = new Map(posts.map((p) => [p.key, p.tr.fm.title || p.en.fm.title]));
  const keys = new Set([...postViews.keys(), ...reads.keys()].filter((k) => titleOf.has(k)));
  const topPosts = [...keys]
    .map((key) => {
      const views = postViews.get(key) ?? 0;
      const rd = reads.get(key) ?? 0;
      return { key, title: titleOf.get(key) ?? key, views, reads: rd, readRate: views ? Math.min(100, Math.round((rd / views) * 100)) : null };
    })
    .sort((a, b) => b.reads - a.reads || b.views - a.views)
    .slice(0, 5);

  const topPages = sortDesc(
    [...pageViews].map(([path, views]) => ({ path, label: PAGE_LABEL.get(path) ?? path, views })),
  ).slice(0, 5);

  return {
    totals: {
      views: total(cur, 'v|'),
      reads: total(cur, 'rd|'),
      clicks: total(cur, 'c|randevu'),
      postViews: postViewsIn(cur),
      prevViews: total(prev, 'v|'),
      prevReads: total(prev, 'rd|'),
      prevClicks: total(prev, 'c|randevu'),
      prevPostViews: postViewsIn(prev),
    },
    daily,
    topPosts,
    topPages,
    referrers: sortDesc([...ref].map(([label, views]) => ({ label, views }))),
    devices: [
      { label: 'Telefon' as const, views: dev.m },
      { label: 'Tablet' as const, views: dev.t },
      { label: 'Bilgisayar' as const, views: dev.d },
    ].filter((x) => x.views > 0),
    langs: [
      { label: 'Türkçe' as const, views: lang.tr },
      { label: 'İngilizce' as const, views: lang.en },
    ].filter((x) => x.views > 0),
    clicks: sortDesc(clicks),
  };
}
