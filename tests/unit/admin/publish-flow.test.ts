import { describe, it, expect } from 'vitest';
import { createMockApi } from '../../../src/admin/api/mock';
import { newDraft } from '../../../src/admin/lib/draft';
import { PublishError } from '../../../src/admin/lib/publish';
import { draftImageNames, publishDraft } from '../../../src/admin/lib/publish-flow';
import type { Draft, LangFields } from '../../../src/admin/api/types';

const seed = {
  'src/data/categories.json': '[{"id":"terapi","slug":{"tr":"terapi","en":"therapy"},"label":{"tr":"Terapi","en":"Therapy"}}]\n',
  'src/data/redirects.json': '[]\n',
};
const body = (extra: object[] = []) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metin.' }] }, ...extra] });
const lang = (title: string, slug: string, extra: object[] = []): LangFields => ({
  title, subtitle: '', seoTitle: '', slug, slugTouched: true, description: 'Açıklama', focusKeyword: 'kelime', coverAlt: '', doc: body(extra), references: [],
});
const draft = (over: Partial<Draft> = {}): Draft => ({
  ...newDraft(new Date('2026-10-17T10:00:00')),
  key: 'taslak-x',
  category: 'terapi',
  tr: lang('Kaygı', 'kaygi'),
  en: lang('Anxiety', 'anxiety'),
  ...over,
});
const now = new Date('2026-10-20T10:00:00');

describe('publishDraft', () => {
  it('publishes a new post and deletes the draft', async () => {
    const api = createMockApi({ seed });
    const d = draft();
    api.state.drafts.set(d.key, { ...d, rev: 1 });
    const r = await publishDraft(api, d, { now });
    expect(api.state.commits).toHaveLength(1);
    expect(api.state.commits[0].message).toBe('Yazı yayınlandı: Kaygı');
    expect(api.state.commits[0].writes.map((w) => w.path).sort()).toEqual(['src/content/posts/kaygi/en.md', 'src/content/posts/kaygi/tr.md']);
    expect(api.state.drafts.has(d.key)).toBe(false);
    expect(r).toMatchObject({ key: 'kaygi', wasLive: false, commitSha: 'c2' });
  });

  it('a stale live version throws PublishError stale and commits nothing; force replaces it', async () => {
    const api = createMockApi({ seed });
    await publishDraft(api, draft(), { now });
    // An edit that started from an older copy of the live post.
    const edit = draft({ key: 'kaygi', published: true, base: { tr: 'eski', en: 'eski' }, tr: lang('Kaygı 2', 'kaygi') });
    const err = await publishDraft(api, edit, { now }).catch((e) => e);
    expect(err).toBeInstanceOf(PublishError);
    expect((err as PublishError).code).toBe('stale');
    expect(api.state.commits).toHaveLength(1);
    const r = await publishDraft(api, edit, { now, force: true });
    expect(r.wasLive).toBe(true);
    expect(api.state.commits[1].message).toBe('Yazı güncellendi: Kaygı 2');
  });

  it('a missing image throws and commits nothing', async () => {
    const api = createMockApi({ seed });
    const d = draft({ tr: lang('Kaygı', 'kaygi', [{ type: 'figure', attrs: { src: './yok.webp', alt: 'A', caption: '' } }]) });
    await expect(publishDraft(api, d, { now })).rejects.toThrow(/Görsel bulunamadı: yok\.webp/);
    expect(api.state.commits).toHaveLength(0);
  });

  it('reads the draft images from Drive by itself, originals included', async () => {
    const api = createMockApi({ seed });
    const fig = { type: 'figure', attrs: { src: './foto.webp', alt: 'A', caption: '', shape: 'circle', size: 'md', crop: '0,0,50,80', orig: 'foto-orig.webp' } };
    const d = draft({ tr: lang('Kaygı', 'kaygi', [fig]) });
    await api.putImage(d.key, 'foto.webp', 'Rk9UTw==');
    await api.putImage(d.key, 'foto-orig.webp', 'T1JJRw==');
    let committed = false;
    await publishDraft(api, d, { now, onCommitted: () => (committed = true) });
    expect(committed).toBe(true);
    expect(api.state.commits[0].writes.map((w) => w.path)).toEqual(expect.arrayContaining(['src/content/posts/kaygi/foto.webp', 'src/content/posts/kaygi/foto-orig.webp']));
    expect([...draftImageNames(d)].sort()).toEqual(['foto-orig.webp', 'foto.webp']);
  });
});
