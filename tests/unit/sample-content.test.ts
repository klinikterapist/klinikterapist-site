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
 * The owner edits and deletes these samples in the panel, so nothing here pins a count or a text: every
 * `ornek-*` post that exists must pass the per-post rules, and any that is gone is simply not checked.
 */
const POSTS = 'src/content/posts';
const NOTE: Record<Lang, string> = {
  tr: '_Bu bir örnek yazıdır; panelden düzenleyebilir ya da silebilirsiniz._',
  en: '_This is a sample post; edit or delete it in the panel._',
};

type Post = { key: string; lang: Lang; data: Record<string, any>; body: string };
function load(): Post[] {
  const out: Post[] = [];
  for (const key of readdirSync(POSTS).filter((k) => k.startsWith('ornek-'))) {
    for (const lang of ['tr', 'en'] as const) {
      if (!existsSync(join(POSTS, key, `${lang}.md`))) continue;
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

  it('frontmatter passes the post schema', () => {
    for (const p of posts) expect(() => postFrontmatterSchema(ids).parse(p.data), `${p.key}/${p.lang}`).not.toThrow();
  });

  it('a cover is declared exactly when the cover file exists, and has real alt text', () => {
    for (const p of posts) {
      const has = existsSync(join(POSTS, p.key, 'cover.webp'));
      expect(p.data.cover !== undefined, `${p.key}/${p.lang}`).toBe(has);
      if (has) {
        expect(p.data.cover).toBe('./cover.webp');
        expect(String(p.data.coverAlt ?? '').trim().length).toBeGreaterThan(10);
      }
    }
  });

  it('both languages of a post (when both exist) share category, date, featured and cover', () => {
    for (const k of keys) {
      const tr = posts.find((p) => p.key === k && p.lang === 'tr');
      const en = posts.find((p) => p.key === k && p.lang === 'en');
      if (!tr || !en) continue;
      for (const f of ['category', 'featured', 'cover']) expect(en.data[f], `${k}.${f}`).toEqual(tr.data[f]);
      expect(new Date(en.data.publishedAt).getTime()).toBe(new Date(tr.data.publishedAt).getTime());
    }
  });

  it('every post has a publish date with a time', () => {
    for (const p of posts) expect(readFileSync(join(POSTS, p.key, `${p.lang}.md`), 'utf8')).toMatch(/publishedAt: "?\d{4}-\d\d-\d\dT\d\d:\d\d/);
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

  it('every listed reference is cited in the text', () => {
    for (const p of posts) {
      for (const r of p.data.references ?? []) expect(p.body, `${p.key}/${p.lang} ${r.id}`).toContain(r.id);
    }
  });

  it('no diagnosis or promise wording, no testimonials', () => {
    for (const p of posts) {
      expect(p.body).not.toMatch(/garanti|kesin (çözüm|iyileş)|tedavi eder|iyileştirir|guarantee|cure[sd]?|will heal/i);
      expect(p.body).not.toMatch(/danışanım|hastam|my client|my patient/i);
    }
  });
});

describe('sample site texts', () => {
  it('a FAQ answer is never half-filled: both languages or neither', () => {
    const faq = JSON.parse(readFileSync('src/data/faq.json', 'utf8')) as { id: string; a: { tr: string; en: string } }[];
    for (const f of faq) expect(f.a.tr.trim() !== '', f.id).toBe(f.a.en.trim() !== '');
    expect(getFaq('tr').length).toBe(getFaq('en').length);
  });

  it('every home process step has a title and text in both languages', () => {
    for (const s of getHome().process ?? []) {
      for (const lang of ['tr', 'en'] as const) {
        expect(s.title[lang].trim()).not.toBe('');
        expect(s.text[lang].trim()).not.toBe('');
      }
    }
  });
});
