import { describe, it, expect } from 'vitest';
import { dashboard } from '../../../src/admin/lib/dashboard';
import type { DraftSummary } from '../../../src/admin/api/types';
import type { LivePost } from '../../../src/admin/lib/publish';

const live = (key: string, publishedAt: string) =>
  ({ key, tr: { fm: { title: key, publishedAt }, sha: 's' }, en: { fm: { title: key, publishedAt }, sha: 's' }, files: [] }) as unknown as LivePost;
const draft = (key: string, updatedAt: string, tr = 'T', en = 'E'): DraftSummary => ({
  key,
  rev: 1,
  updatedAt,
  published: false,
  category: 'terapi',
  title: { tr, en },
});
const now = new Date('2026-10-17T10:00:00Z');

describe('dashboard', () => {
  it('picks the latest live post and counts this month', () => {
    const d = dashboard([live('a', '2026-09-30'), live('b', '2026-10-05'), live('c', '2026-10-01')], [], now);
    expect(d.lastLive?.key).toBe('b');
    expect(d.publishedThisMonth).toBe(2);
  });
  it('has no last post when nothing is live', () => {
    expect(dashboard([], [], now).lastLive).toBeNull();
  });
  it('keeps at most 5 recent drafts, newest first', () => {
    const drafts = [1, 2, 3, 4, 5, 6, 7].map((n) => draft(`d${n}`, `2026-10-0${n}T00:00:00Z`));
    const d = dashboard([], drafts, now);
    expect(d.recentDrafts.map((x) => x.key)).toEqual(['d7', 'd6', 'd5', 'd4', 'd3']);
  });
  it('lists drafts missing one language, but not fully empty ones', () => {
    const d = dashboard([], [draft('x', '2026-10-01T00:00:00Z', 'Bağlanma', ''), draft('y', '2026-10-02T00:00:00Z', '', ''), draft('z', '2026-10-03T00:00:00Z', '', 'Bonding')], now);
    expect(d.incomplete).toEqual([
      { key: 'x', title: 'Bağlanma', missing: 'en' },
      { key: 'z', title: 'Bonding', missing: 'tr' },
    ]);
  });
});
