import { describe, expect, it } from 'vitest';
import { aggregate, change, rangeFor } from '../../../src/admin/lib/stats';
import type { LivePost } from '../../../src/admin/lib/publish';

const post = (key: string, tr: string, en: string, title: string) =>
  ({ key, tr: { fm: { slug: tr, title }, sha: '' }, en: { fm: { slug: en, title: `${title} EN` }, sha: '' }, files: [] }) as unknown as LivePost;

describe('rangeFor', () => {
  it('30 days ending today (Istanbul) and the 30 before', () => {
    expect(rangeFor(30, new Date('2026-10-19T22:30:00Z'), null)).toEqual({ from: '2026-09-21', to: '2026-10-20', prevFrom: '2026-08-22', prevTo: '2026-09-20' });
  });
  it('"all" starts at since', () => {
    expect(rangeFor('all', new Date('2026-10-19T10:00:00Z'), '2026-10-10').from).toBe('2026-10-10');
  });
});

describe('aggregate', () => {
  const posts = [post('kaygi', 'kaygi-ile-yasamak', 'living-with-anxiety', 'Kaygı')];
  const r = { from: '2026-10-18', to: '2026-10-19', prevFrom: '2026-10-16', prevTo: '2026-10-17' };
  const s = {
    since: '2026-10-16',
    days: {
      '2026-10-16': { 'v|/': 5 },
      '2026-10-18': {
        'v|/blog/kaygi-ile-yasamak/': 6,
        'v|/en/blog/living-with-anxiety/': 4,
        'rd|kaygi': 5,
        'v|/hakkimda/': 3,
        'ref|instagram.com': 8,
        'ref|google.com.tr': 2,
        'ref|direct': 3,
        'dev|m': 10,
        'c|randevu': 2,
      },
    },
  };
  const a = aggregate(s, r, posts);

  it('adds both language paths of a post and computes the read rate', () => {
    expect(a.topPosts).toEqual([{ key: 'kaygi', title: 'Kaygı', views: 10, reads: 5, readRate: 50 }]);
    expect(a.totals.postViews).toBe(10);
  });
  it('fills missing days with zero', () => {
    expect(a.daily).toEqual([
      { day: '2026-10-18', views: 13, reads: 5 },
      { day: '2026-10-19', views: 0, reads: 0 },
    ]);
  });
  it('labels pages and groups referrers', () => {
    expect(a.topPages).toEqual([{ path: '/hakkimda/', label: 'Hakkımda', views: 3 }]);
    expect(a.referrers.map((x) => x.label)).toEqual(['Instagram', 'Doğrudan', 'Google']);
  });
  it('compares with the previous period', () => {
    expect(a.totals.prevViews).toBe(5);
    expect(a.totals.clicks).toBe(2);
    expect(change(0, 0)).toBeNull();
    expect(change(15, 10)).toBe(50);
  });
});
