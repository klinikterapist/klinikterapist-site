/** What the home screen shows, derived from the live posts and the drafts. */
import type { DraftSummary } from '../api/types';
import type { LivePost } from './publish';

export type Incomplete = { key: string; title: string; missing: 'tr' | 'en' };

const publishedAt = (p: LivePost) => p.tr.fm.publishedAt;

export function dashboard(live: LivePost[], drafts: DraftSummary[], now: Date) {
  const month = now.toISOString().slice(0, 7);
  const lastLive = live.reduce<LivePost | null>((best, p) => (!best || publishedAt(p) > publishedAt(best) ? p : best), null);
  const recentDrafts = [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const incomplete: Incomplete[] = [];
  for (const d of drafts) {
    const tr = d.title.tr.trim();
    const en = d.title.en.trim();
    if (tr && !en) incomplete.push({ key: d.key, title: tr, missing: 'en' });
    else if (en && !tr) incomplete.push({ key: d.key, title: en, missing: 'tr' });
  }
  return { lastLive, recentDrafts, publishedThisMonth: live.filter((p) => publishedAt(p).startsWith(month)).length, incomplete };
}
