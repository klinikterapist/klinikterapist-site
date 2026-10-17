import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import {
  PublishError, buildCategoryChangeset, buildPublishChangeset, buildUnpublishChangeset, type LivePost,
} from '../../../src/admin/lib/publish';
import { parsePost } from '../../../src/admin/lib/frontmatter';
import { shortHash } from '../../../src/admin/lib/hash';
import type { Draft, LangFields } from '../../../src/admin/api/types';
import type { Category } from '../../../src/lib/schemas';

const categories: Category[] = [
  { id: 'terapi', slug: { tr: 'terapi', en: 'therapy' }, label: { tr: 'Terapi', en: 'Therapy' } },
  { id: 'yasam', slug: { tr: 'yasam', en: 'life' }, label: { tr: 'Yaşam', en: 'Life' } },
];

const doc = (...images: string[]): JSONContent => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Metin.' }] },
    ...images.map((src) => ({ type: 'figure', attrs: { src: `./${src}`, alt: 'Alt', caption: '' } })),
  ],
});
const lang = (title: string, slug: string, images: string[] = []): LangFields => ({
  title, seoTitle: '', slug, slugTouched: true, description: 'Açıklama', focusKeyword: 'kelime', coverAlt: 'Kapak', doc: doc(...images),
});
const draft = (over: Partial<Draft> = {}): Draft => ({
  key: 'taslak-x', rev: 3, updatedAt: '', published: false, category: 'terapi', cover: null, publishedAt: '2026-10-17',
  tr: lang('Kaygı', 'kaygi'), en: lang('Anxiety', 'anxiety'), ...over,
});
const livePost = (key: string, trSlug: string, enSlug: string, extra: { path: string; sha: string }[] = []): LivePost => ({
  key,
  tr: { fm: { title: `TR ${key}`, description: 'd', slug: trSlug, focusKeyword: 'k', category: 'terapi', publishedAt: '2026-01-01' }, sha: `${key}-tr` },
  en: { fm: { title: `EN ${key}`, description: 'd', slug: enSlug, focusKeyword: 'k', category: 'terapi', publishedAt: '2026-01-01' }, sha: `${key}-en` },
  files: [
    { path: `src/content/posts/${key}/tr.md`, sha: `${key}-tr` },
    { path: `src/content/posts/${key}/en.md`, sha: `${key}-en` },
    ...extra,
  ],
});
const noRedirects = { list: [], sha: 'r0' };
const base = { allLive: [] as LivePost[], redirects: noRedirects, categories, images: new Map(), today: '2026-10-20' };
const paths = (xs: { path: string }[]) => xs.map((x) => x.path).sort();

describe('buildPublishChangeset — new post', () => {
  it('writes both languages under the TR slug as the folder key, with no redirects', () => {
    const cs = buildPublishChangeset({ ...base, draft: draft(), live: null });
    expect(cs.key).toBe('kaygi');
    expect(paths(cs.writes)).toEqual(['src/content/posts/kaygi/en.md', 'src/content/posts/kaygi/tr.md']);
    expect(cs.writes.every((w) => w.expectSha === null)).toBe(true);
    const tr = parsePost(cs.writes.find((w) => w.path.endsWith('tr.md'))!.content);
    expect(tr.fm).toMatchObject({ title: 'Kaygı', slug: 'kaygi', category: 'terapi', publishedAt: '2026-10-17' });
    expect(tr.fm.updatedAt).toBeUndefined();
    expect(tr.body).toBe('Metin.\n');
    expect(cs.deletes).toEqual([]);
  });

  it('adds -2 to the folder key when the folder exists', () => {
    const cs = buildPublishChangeset({ ...base, draft: draft(), live: null, allLive: [livePost('kaygi', 'baska', 'other')] });
    expect(cs.key).toBe('kaygi-2');
  });

  it('a slug used by another live post is refused, naming both titles', () => {
    const run = () => buildPublishChangeset({ ...base, draft: draft(), live: null, allLive: [livePost('eski', 'kaygi', 'old')] });
    expect(run).toThrow(PublishError);
    expect(run).toThrow(/TR eski/);
    expect(run).toThrow(/Kaygı/);
  });

  it('an incomplete draft is refused with the missing fields', () => {
    expect(() => buildPublishChangeset({ ...base, draft: draft({ en: lang('', 'anxiety') }), live: null })).toThrow(/İngilizce: Başlık/);
  });

  it('uploads the cover and body images, and an image without data is refused', () => {
    const images = new Map([
      ['cover.webp', { base64: 'Q09WRVI=', inRepo: false }],
      ['yaprak.webp', { base64: 'WUFQ', inRepo: false }],
    ]);
    const d = draft({ cover: 'cover.webp', tr: lang('Kaygı', 'kaygi', ['yaprak.webp']) });
    const cs = buildPublishChangeset({ ...base, draft: d, live: null, images });
    expect(paths(cs.writes)).toContain('src/content/posts/kaygi/cover.webp');
    expect(cs.writes.find((w) => w.path.endsWith('yaprak.webp'))).toMatchObject({ encoding: 'base64', content: 'WUFQ', expectSha: null });
    expect(parsePost(cs.writes.find((w) => w.path.endsWith('tr.md'))!.content).fm.cover).toBe('./cover.webp');
    expect(() => buildPublishChangeset({ ...base, draft: d, live: null, images: new Map() })).toThrow(/Görsel bulunamadı: (cover|yaprak)\.webp/);
  });

  it('a redirect sitting on the new address is removed with a notice', () => {
    const redirects = { list: [{ from: '/blog/kaygi/', to: '/blog/' }], sha: 'r1' };
    const cs = buildPublishChangeset({ ...base, draft: draft(), live: null, redirects });
    const r = cs.writes.find((w) => w.path === 'src/data/redirects.json')!;
    expect(r).toMatchObject({ expectSha: 'r1', content: '[]\n' });
    expect(cs.notices.length).toBe(1);
  });
});

describe('buildPublishChangeset — live post', () => {
  const live = livePost('kaygi', 'kaygi', 'anxiety', [
    { path: 'src/content/posts/kaygi/eski.webp', sha: 's-eski' },
    { path: 'src/content/posts/kaygi/kalan.webp', sha: 's-kalan' },
  ]);
  const images = new Map([['kalan.webp', { base64: 'S0FMQU4=', inRepo: true }]]);

  it('an unchanged republish writes no redirects.json, sets updatedAt and keeps the folder', () => {
    const d = draft({ key: 'kaygi', published: true, tr: lang('Kaygı', 'kaygi', ['kalan.webp']) });
    const cs = buildPublishChangeset({ ...base, draft: d, live, allLive: [live], images });
    expect(cs.key).toBe('kaygi');
    expect(cs.writes.some((w) => w.path.endsWith('redirects.json'))).toBe(false);
    expect(cs.writes.find((w) => w.path.endsWith('tr.md'))!.expectSha).toBe('kaygi-tr');
    expect(parsePost(cs.writes.find((w) => w.path.endsWith('en.md'))!.content).fm.updatedAt).toBe('2026-10-20');
    // The kept image is neither re-uploaded nor deleted; the removed one is deleted.
    expect(paths(cs.writes)).not.toContain('src/content/posts/kaygi/kalan.webp');
    expect(cs.deletes).toEqual([{ path: 'src/content/posts/kaygi/eski.webp', expectSha: 's-eski' }]);
  });

  it('a slug change adds a redirect per changed language', () => {
    const d = draft({ key: 'kaygi', published: true, tr: lang('Kaygı', 'kaygi-yeni', ['kalan.webp']) });
    const cs = buildPublishChangeset({ ...base, draft: d, live, allLive: [live], images });
    const r = cs.writes.find((w) => w.path === 'src/data/redirects.json')!;
    expect(r.expectSha).toBe('r0');
    expect(JSON.parse(r.content)).toEqual([{ from: '/blog/kaygi/', to: '/blog/kaygi-yeni/' }]);
    expect(r.content.endsWith('\n')).toBe(true);
  });

  it('a replaced image with the same name is written over the existing file', () => {
    const live2 = livePost('kaygi', 'kaygi', 'anxiety', [{ path: 'src/content/posts/kaygi/cover.webp', sha: 's-cover' }]);
    const d = draft({ key: 'kaygi', published: true, cover: 'cover.webp' });
    const cs = buildPublishChangeset({ ...base, draft: d, live: live2, allLive: [live2], images: new Map([['cover.webp', { base64: 'TkVX', inRepo: false }]]) });
    expect(cs.writes.find((w) => w.path.endsWith('cover.webp'))?.expectSha).toBe('s-cover');
  });
});

describe('buildUnpublishChangeset', () => {
  it('deletes every file and sends both addresses to the blog index', () => {
    const live = livePost('kaygi', 'kaygi', 'anxiety', [{ path: 'src/content/posts/kaygi/cover.webp', sha: 's-c' }]);
    const cs = buildUnpublishChangeset(live, noRedirects);
    expect(paths(cs.deletes)).toEqual(paths(live.files));
    expect(JSON.parse(cs.writes[0].content)).toEqual([
      { from: '/blog/kaygi/', to: '/blog/' },
      { from: '/en/blog/anxiety/', to: '/en/blog/' },
    ]);
  });

  it('republishing with the same slug later removes the blog-index redirect', () => {
    const live = livePost('kaygi', 'kaygi', 'anxiety');
    const after = JSON.parse(buildUnpublishChangeset(live, noRedirects).writes[0].content);
    const cs = buildPublishChangeset({ ...base, draft: draft(), live: null, redirects: { list: after, sha: 'r2' } });
    expect(JSON.parse(cs.writes.find((w) => w.path.endsWith('redirects.json'))!.content)).toEqual([]);
  });
});

describe('buildCategoryChangeset', () => {
  it('refuses to delete a category in use', () => {
    expect(() =>
      buildCategoryChangeset({ before: categories, after: [categories[1]], sha: 'c0', usedIds: new Set(['terapi']), redirects: noRedirects }),
    ).toThrow('Bu kategoride yazı ya da taslak var; önce onları başka kategoriye taşıyın.');
  });

  it('a slug change redirects the old category pages in both languages', () => {
    const after = [{ ...categories[0], slug: { tr: 'psikoterapi', en: 'psychotherapy' } }, categories[1]];
    const cs = buildCategoryChangeset({ before: categories, after, sha: 'c0', usedIds: new Set(), redirects: noRedirects });
    expect(cs.writes.find((w) => w.path === 'src/data/categories.json')?.expectSha).toBe('c0');
    expect(JSON.parse(cs.writes.find((w) => w.path === 'src/data/redirects.json')!.content)).toEqual([
      { from: '/blog/kategori/terapi/', to: '/blog/kategori/psikoterapi/' },
      { from: '/en/blog/category/therapy/', to: '/en/blog/category/psychotherapy/' },
    ]);
  });

  it('a new category writes only categories.json; an invalid one is refused', () => {
    const added = [...categories, { id: 'yeni', slug: { tr: 'yeni', en: 'new' }, label: { tr: 'Yeni', en: 'New' } }];
    const cs = buildCategoryChangeset({ before: categories, after: added, sha: 'c0', usedIds: new Set(), redirects: noRedirects });
    expect(cs.writes.map((w) => w.path)).toEqual(['src/data/categories.json']);
    const dup = [...categories, { id: 'kopya', slug: { tr: 'terapi', en: 'copy' }, label: { tr: 'K', en: 'C' } }];
    expect(() => buildCategoryChangeset({ before: categories, after: dup, sha: 'c0', usedIds: new Set(), redirects: noRedirects })).toThrow(PublishError);
  });
});

describe('shortHash', () => {
  it('is the first 8 hex chars of SHA-256', async () => {
    expect(await shortHash(new TextEncoder().encode('abc'))).toBe('ba7816bf');
  });
});
