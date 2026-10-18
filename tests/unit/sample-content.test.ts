import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { postFrontmatterSchema } from '../../src/lib/schemas';
import { keywordCount } from '../../src/admin/lib/seo-check';
import { slugify } from '../../src/lib/slug';
import { getCategories, type Lang } from '../../src/lib/settings';

/**
 * The owner's sample content (real files under src/content/posts and src/data). Build tests run on
 * fixtures, so this unit test is where the real content is held to the copy rules and the publish checklist.
 * The owner edits and deletes these samples in the panel, and deploy.yml runs this suite before every deploy, so
 * a test here must hold for ANY valid panel state. The copy rules only apply to an untouched sample (an `ornek-*`
 * post whose body still starts with the sample note); a post whose note was removed is the owner's own and is not
 * checked. Nothing pins a count, a text or a FAQ/process state.
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
/** Untouched samples: the copy rules below hold only for these. */
const samples = posts.filter((p) => p.body.split(/\n/)[0] === NOTE[p.lang]);
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const firstParagraph = (body: string) =>
  body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('_') && !p.startsWith('#'))!;

describe('sample posts', () => {
  const ids = getCategories().map((c) => c.id);
  const sampleKeys = (lang: Lang) => new Set(samples.filter((p) => p.lang === lang).map((p) => p.key));

  it('frontmatter passes the post schema', () => {
    for (const p of posts) expect(() => postFrontmatterSchema(ids).parse(p.data), `${p.key}/${p.lang}`).not.toThrow();
  });

  it('a declared cover points at a file that exists', () => {
    for (const p of posts) if (p.data.cover) expect(existsSync(join(POSTS, p.key, String(p.data.cover))), `${p.key}/${p.lang}`).toBe(true);
  });

  it('untouched samples: a cover is declared as ./cover.webp with real alt text', () => {
    for (const p of samples.filter((x) => x.data.cover)) {
      expect(p.data.cover).toBe('./cover.webp');
      expect(String(p.data.coverAlt ?? '').trim().length).toBeGreaterThan(10);
    }
  });

  it('untouched samples: both languages share category, date, featured and cover', () => {
    for (const k of sampleKeys('tr')) {
      if (!sampleKeys('en').has(k)) continue;
      const tr = samples.find((p) => p.key === k && p.lang === 'tr')!;
      const en = samples.find((p) => p.key === k && p.lang === 'en')!;
      for (const f of ['category', 'featured', 'cover']) expect(en.data[f], `${k}.${f}`).toEqual(tr.data[f]);
      expect(new Date(en.data.publishedAt).getTime()).toBe(new Date(tr.data.publishedAt).getTime());
    }
  });

  it('untouched samples carry a publish date with a time', () => {
    for (const p of samples) expect(readFileSync(join(POSTS, p.key, `${p.lang}.md`), 'utf8')).toMatch(/publishedAt: "?\d{4}-\d\d-\d\dT\d\d:\d\d/);
  });

  it.each(samples.map((p) => [`${p.key}/${p.lang}`, p] as const))(
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

  it('untouched samples: no focus keyword is reused across posts of one language', () => {
    for (const lang of ['tr', 'en'] as const) {
      const kws = samples.filter((p) => p.lang === lang).map((p) => String(p.data.focusKeyword).toLowerCase());
      expect(new Set(kws).size).toBe(kws.length);
    }
  });

  it('untouched samples: every listed reference is cited in the text', () => {
    for (const p of samples) {
      for (const r of p.data.references ?? []) expect(p.body, `${p.key}/${p.lang} ${r.id}`).toContain(r.id);
    }
  });

  it('untouched samples: no diagnosis or promise wording, no testimonials', () => {
    for (const p of samples) {
      expect(p.body).not.toMatch(/garanti|kesin (çözüm|iyileş)|tedavi eder|iyileştirir|guarantee|cure[sd]?|will heal/i);
      expect(p.body).not.toMatch(/danışanım|hastam|my client|my patient/i);
    }
  });
});
