import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { postFrontmatterSchema } from '../../src/lib/schemas';
import { keywordCount } from '../../src/admin/lib/seo-check';
import { slugify } from '../../src/lib/slug';
import { getCategories, getFaq, getHome, type Lang } from '../../src/lib/settings';

/**
 * The owner's sample content (real files under src/content/posts and src/data). Build tests run on
 * fixtures, so this unit test is where the real content is held to the copy rules and the publish checklist.
 */
const POSTS = 'src/content/posts';
const NOTE: Record<Lang, string> = {
  tr: '_Bu bir örnek yazıdır; panelden düzenleyebilir ya da silebilirsiniz._',
  en: '_This is a sample post; edit or delete it in the panel._',
};

type Post = { key: string; lang: Lang; data: Record<string, any>; body: string };
function load(): Post[] {
  const out: Post[] = [];
  for (const key of readdirSync(POSTS).filter((k) => !k.startsWith('.'))) {
    for (const lang of ['tr', 'en'] as const) {
      const raw = readFileSync(join(POSTS, key, `${lang}.md`), 'utf8').replace(/\r\n/g, '\n');
      const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw)!;
      out.push({ key, lang, data: parseYaml(m[1]), body: m[2].trim() });
    }
  }
  return out;
}
const posts = load();
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const firstParagraph = (body: string) =>
  body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('_') && !p.startsWith('#'))!;

describe('sample posts', () => {
  const keys = [...new Set(posts.map((p) => p.key))];
  const ids = getCategories().map((c) => c.id);

  it('six posts, each in both languages', () => {
    expect(keys).toHaveLength(6);
    for (const lang of ['tr', 'en'] as const) expect(posts.filter((p) => p.lang === lang)).toHaveLength(6);
  });

  it('frontmatter passes the post schema', () => {
    for (const p of posts) expect(() => postFrontmatterSchema(ids).parse(p.data), `${p.key}/${p.lang}`).not.toThrow();
  });

  it('covers at least four categories; two featured; three with covers and real alt text', () => {
    const tr = posts.filter((p) => p.lang === 'tr');
    expect(new Set(tr.map((p) => p.data.category)).size).toBeGreaterThanOrEqual(4);
    expect(tr.filter((p) => p.data.featured === true)).toHaveLength(2);
    const covered = keys.filter((k) => existsSync(join(POSTS, k, 'cover.webp')));
    expect(covered).toHaveLength(3);
    for (const p of posts.filter((x) => covered.includes(x.key))) {
      expect(p.data.cover).toBe('./cover.webp');
      expect(String(p.data.coverAlt ?? '').trim().length).toBeGreaterThan(10);
    }
    for (const p of posts.filter((x) => !covered.includes(x.key))) expect(p.data.cover).toBeUndefined();
  });

  it('both languages of a post share category, date, featured and cover', () => {
    for (const k of keys) {
      const tr = posts.find((p) => p.key === k && p.lang === 'tr')!;
      const en = posts.find((p) => p.key === k && p.lang === 'en')!;
      for (const f of ['category', 'featured', 'cover']) expect(en.data[f], `${k}.${f}`).toEqual(tr.data[f]);
      expect(new Date(en.data.publishedAt).getTime()).toBe(new Date(tr.data.publishedAt).getTime());
    }
  });

  it('published over the last six weeks, with times, newest within a week of 18 Oct 2026', () => {
    const times = posts.filter((p) => p.lang === 'tr').map((p) => new Date(p.data.publishedAt));
    for (const p of posts) expect(readFileSync(join(POSTS, p.key, `${p.lang}.md`), 'utf8')).toMatch(/publishedAt: "?\d{4}-\d\d-\d\dT\d\d:\d\d/);
    const ms = times.map((t) => t.getTime()).sort((a, b) => a - b);
    const end = new Date('2026-10-18T23:59:00+03:00').getTime();
    expect(end - ms[0]).toBeLessThanOrEqual(43 * 86400000);
    expect(end - ms[ms.length - 1]).toBeLessThanOrEqual(7 * 86400000);
    expect(new Set(ms.map((m) => new Date(m).toDateString())).size).toBe(6);
  });

  it.each(posts.map((p) => [`${p.key}/${p.lang}`, p] as const))(
    '%s: sample note, 300-500 words, subheadings, checklist keyword rules',
    (_n, p) => {
      expect(p.body.split('\n')[0]).toBe(NOTE[p.lang]);
      const n = words(p.body);
      expect(n).toBeGreaterThanOrEqual(300);
      expect(n).toBeLessThanOrEqual(500);
      expect((p.body.match(/^## /gm) ?? []).length).toBeGreaterThanOrEqual(2);
      const kw = String(p.data.focusKeyword);
      expect(kw.trim()).not.toBe('');
      expect(keywordCount(p.data.title, kw, p.lang), 'title').toBeGreaterThan(0);
      expect(keywordCount(p.data.description, kw, p.lang), 'description').toBeGreaterThan(0);
      expect(keywordCount(firstParagraph(p.body), kw, p.lang), 'first paragraph').toBeGreaterThan(0);
      expect(p.data.slug).toContain(slugify(kw, p.lang));
      const dl = String(p.data.description).length;
      expect(dl).toBeGreaterThanOrEqual(120);
      expect(dl).toBeLessThanOrEqual(158);
    },
  );

  it('no focus keyword is reused across posts of one language', () => {
    for (const lang of ['tr', 'en'] as const) {
      const kws = posts.filter((p) => p.lang === lang).map((p) => String(p.data.focusKeyword).toLowerCase());
      expect(new Set(kws).size).toBe(kws.length);
    }
  });

  it('a reference list on exactly two posts; every listed reference is cited in the text', () => {
    const withRefs = posts.filter((p) => p.lang === 'tr' && (p.data.references ?? []).length > 0);
    expect(withRefs).toHaveLength(2);
    for (const p of posts.filter((x) => withRefs.some((w) => w.key === x.key))) {
      for (const r of p.data.references) expect(p.body, `${p.key}/${p.lang} ${r.id}`).toContain(r.id);
    }
  });

  it('no diagnosis or promise wording, no testimonials', () => {
    for (const p of posts) {
      expect(p.body).not.toMatch(/garanti|kesin (çözüm|iyileş)|tedavi eder|iyileştirir|guarantee|cure[sd]?\b|will heal/i);
      expect(p.body).not.toMatch(/danışanım|hastam|my client|my patient/i);
    }
  });
});

describe('sample site texts', () => {
  it('the five FAQ questions are answered in both languages', () => {
    for (const lang of ['tr', 'en'] as const) expect(getFaq(lang)).toHaveLength(5);
    expect(getFaq('tr').find((f) => f.id === 'ucret')?.a).toContain('Ücret bilgisi için iletişime geçebilirsiniz.');
    expect(getFaq('tr').find((f) => f.id === 'ilk-gorusme')?.a).toContain('genellikle 50 dakika');
    expect(getFaq('tr').find((f) => f.id === 'gizlilik')?.a).toContain('112');
  });

  it('home has three process steps in both languages', () => {
    const steps = getHome().process ?? [];
    expect(steps).toHaveLength(3);
    for (const s of steps) {
      for (const lang of ['tr', 'en'] as const) {
        expect(s.title[lang].trim()).not.toBe('');
        expect(s.text[lang].trim()).not.toBe('');
      }
    }
  });
});
