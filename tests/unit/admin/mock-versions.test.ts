import { describe, it, expect } from 'vitest';
import { createMockApi } from '../../../src/admin/api/mock';
import type { Draft } from '../../../src/admin/api/types';

const lang = (title: string) => ({
  title, subtitle: '', seoTitle: '', slug: '', slugTouched: false, description: '', focusKeyword: '', coverAlt: '', doc: { type: 'doc' as const }, references: [],
});
const draft = (rev: number, title: string): Draft => ({
  key: 'k', rev, updatedAt: '', published: false, category: 'terapi', cover: null, coverOriginal: null, coverCrop: null, publishedAt: '2026-10-17', tr: lang(title), en: lang('T'),
});

describe('mock snapshots', () => {
  it('thins to 10 minutes, honours snapshot: true, lists newest first, expires after 30 days', async () => {
    let now = Date.UTC(2026, 9, 17, 12);
    const api = createMockApi({ seed: {}, now: () => now });
    let rev = (await api.saveDraft(draft(0, 'v1'))).rev;
    expect((await api.listVersions('k')).versions).toEqual([]);
    now += 11 * 60e3;
    rev = (await api.saveDraft(draft(rev, 'v2'))).rev;
    now += 3 * 60e3;
    rev = (await api.saveDraft(draft(rev, 'v3'))).rev;
    expect((await api.listVersions('k')).versions).toHaveLength(1);
    now += 60e3;
    rev = (await api.saveDraft(draft(rev, 'v4'), { snapshot: true })).rev;
    now += 11 * 60e3;
    rev = (await api.saveDraft(draft(rev, 'v5'))).rev;
    const { versions } = (await api.listVersions('k'));
    expect(versions.map((v) => v.rev)).toEqual([4, 3, 1]);
    expect(Object.keys(versions[0])).toEqual(['name', 'rev', 'savedAt']);
    expect((await api.getVersion('k', versions[2].name)).draft.tr.title).toBe('v1');
    now += 31 * 24 * 3600e3;
    await api.saveDraft(draft(rev, 'v6'));
    expect((await api.listVersions('k')).versions.map((v) => v.rev)).toEqual([5]);
    await expect(api.getVersion('k', versions[2].name)).rejects.toMatchObject({ code: 'not_found' });
  });
});
