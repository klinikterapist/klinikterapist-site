import { describe, it, expect } from 'vitest';
import { liveToDraft, loadSiteState, mergeList } from '../../../src/admin/lib/posts-repo';
import { createMockApi } from '../../../src/admin/api/mock';

const post = (slug: string, title: string) =>
  `---\ntitle: ${JSON.stringify(title)}\ndescription: "D"\nslug: "${slug}"\nfocusKeyword: "k"\ncategory: "terapi"\ncover: "./cover.webp"\ncoverAlt: "Alt"\npublishedAt: 2026-03-10\n---\n\nMetin **kalın**.\n`;

const seed = {
  'src/content/posts/kaygi/tr.md': post('kaygi', 'Kaygı'),
  'src/content/posts/kaygi/en.md': post('anxiety', 'Anxiety'),
  'src/content/posts/kaygi/cover.webp': 'Q09WRVI=',
  'src/data/redirects.json': '[{"from":"/blog/eski/","to":"/blog/kaygi/"}]\n',
  'src/data/categories.json': '[{"id":"terapi","slug":{"tr":"terapi","en":"therapy"},"label":{"tr":"Terapi","en":"Therapy"}}]\n',
};

describe('loadSiteState', () => {
  it('reads live posts with their files, redirects and categories', async () => {
    const s = await loadSiteState(createMockApi({ seed }));
    expect(s.posts).toHaveLength(1);
    const p = s.posts[0];
    expect(p.key).toBe('kaygi');
    expect(p.tr.fm.title).toBe('Kaygı');
    expect(p.en.fm.slug).toBe('anxiety');
    expect(p.body.tr).toBe('Metin **kalın**.\n');
    expect(p.files.map((f) => f.path).sort()).toEqual([
      'src/content/posts/kaygi/cover.webp', 'src/content/posts/kaygi/en.md', 'src/content/posts/kaygi/tr.md',
    ]);
    expect(s.redirects.list).toEqual([{ from: '/blog/eski/', to: '/blog/kaygi/' }]);
    expect(s.redirects.sha).toBeTruthy();
    expect(s.categories.list.map((c) => c.id)).toEqual(['terapi']);
  });
});

describe('loadSiteState site name', () => {
  const seo = '{"siteName":{"tr":"Psikolog Osman","en":"Psychologist Osman"},"defaultDescription":{"tr":"a","en":"b"},"ogImage":"/og.png"}';
  it('reads the site name from seo.json', async () => {
    const s = await loadSiteState(createMockApi({ seed: { ...seed, 'src/data/seo.json': seo } }));
    expect(s.siteName).toEqual({ tr: 'Psikolog Osman', en: 'Psychologist Osman' });
  });
  it('is null when seo.json is missing or invalid', async () => {
    expect((await loadSiteState(createMockApi({ seed }))).siteName).toBeNull();
    const bad = await loadSiteState(createMockApi({ seed: { ...seed, 'src/data/seo.json': '{"siteName":1}' } }));
    expect(bad.siteName).toBeNull();
    const broken = await loadSiteState(createMockApi({ seed: { ...seed, 'src/data/seo.json': 'not json' } }));
    expect(broken.siteName).toBeNull();
  });
});

describe('liveToDraft', () => {
  it('turns a live post into an editable, published draft', async () => {
    const [p] = (await loadSiteState(createMockApi({ seed }))).posts;
    const d = liveToDraft(p);
    expect(d).toMatchObject({ key: 'kaygi', rev: 0, published: true, category: 'terapi', cover: 'cover.webp', publishedAt: '2026-03-10' });
    expect(d.base).toEqual({ tr: p.tr.sha, en: p.en.sha });
    expect(d.tr).toMatchObject({ title: 'Kaygı', slug: 'kaygi', slugTouched: true, coverAlt: 'Alt' });
    expect(d.tr.doc.content?.[0].content?.[1]).toMatchObject({ text: 'kalın', marks: [{ type: 'bold' }] });
  });
});

describe('mergeList', () => {
  it('marks drafts, live posts and live posts with unpublished changes', async () => {
    const [p] = (await loadSiteState(createMockApi({ seed }))).posts;
    const rows = mergeList(
      [p],
      [
        { key: 'kaygi', rev: 2, updatedAt: '2026-10-17T10:00:00Z', published: true, category: 'terapi', title: { tr: 'Kaygı (yeni)', en: 'Anxiety' } },
        { key: 'taslak-1', rev: 1, updatedAt: '2026-10-16T10:00:00Z', published: false, category: '', title: { tr: '', en: '' } },
      ],
    );
    expect(rows.map((r) => [r.key, r.status, r.title])).toEqual([
      ['kaygi', 'yayında-değişiklik-var', 'Kaygı (yeni)'],
      ['taslak-1', 'taslak', 'Başlıksız taslak'],
    ]);
    expect(mergeList([p], [])[0].status).toBe('yayında');
  });
});
