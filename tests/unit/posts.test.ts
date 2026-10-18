import { describe, it, expect } from 'vitest';
import { validatePostPairs, validateUniqueSlugs, validateReservedSlugs, sortNewestFirst, pickRelated, pickPopular, toPostEntry } from '../../src/lib/posts';

describe('validatePostPairs', () => {
  it('throws naming folder and missing language', () => {
    expect(() => validatePostPairs(['a/tr', 'a/en', 'b/tr'])).toThrow('Yazı "b" için en.md eksik');
    expect(() => validatePostPairs(['b/en'])).toThrow('Yazı "b" için tr.md eksik — her yazı iki dilde olmalı.');
  });
  it('passes for complete pairs and for zero posts', () => {
    expect(() => validatePostPairs(['a/tr', 'a/en'])).not.toThrow();
    expect(() => validatePostPairs([])).not.toThrow();
  });
});

const mk = (key: string, category: string, date: string) => ({
  id: `${key}/tr`,
  body: 'kelime '.repeat(450),
  data: { title: key, description: 'd', slug: key, focusKeyword: 'k', category, publishedAt: new Date(date) },
});

describe('pure helpers', () => {
  it('toPostEntry derives key, lang, reading time', () => {
    const e = toPostEntry(mk('x', 'c', '2026-01-01'));
    expect(e.key).toBe('x');
    expect(e.lang).toBe('tr');
    expect(e.readingMinutes).toBe(3);
  });
  it('sorts newest first without mutating', () => {
    const list = [mk('old', 'c', '2025-01-01'), mk('new', 'c', '2026-01-01')].map(toPostEntry);
    expect(sortNewestFirst(list).map((p) => p.key)).toEqual(['new', 'old']);
    expect(list[0].key).toBe('old');
  });
  it('related: same category first, then newest, excludes self, limited', () => {
    const all = [
      mk('self', 'a', '2026-05-01'), mk('a-old', 'a', '2025-01-01'),
      mk('b-new', 'b', '2026-04-01'), mk('a-new', 'a', '2026-03-01'), mk('b-old', 'b', '2024-01-01'),
    ].map(toPostEntry);
    const rel = pickRelated(all[0], all, 3).map((p) => p.key);
    expect(rel).toEqual(['a-new', 'a-old', 'b-new']);
  });
});

describe('pickPopular', () => {
  const feat = (key: string, date: string) => {
    const p = toPostEntry(mk(key, 'c', date));
    return { ...p, data: { ...p.data, featured: true } };
  };
  const plain = (key: string, date: string) => toPostEntry(mk(key, 'c', date));
  it('without counts: featured posts only, newest first', () => {
    const all = [plain('a', '2026-05-01'), feat('b', '2026-04-01'), feat('c', '2026-06-01')];
    expect(pickPopular(all, () => null).map((p) => p.key)).toEqual(['c', 'b']);
  });
  it('nothing featured and no counts: empty (the Popular tile is hidden)', () => {
    expect(pickPopular([plain('a', '2026-05-01')], () => null)).toEqual([]);
  });
  it('with counts: posts with at least 50 reads, most read first, then featured; limited', () => {
    const counts: Record<string, number> = { a: 900, b: 30, d: 120 };
    const all = [plain('a', '2026-05-01'), plain('b', '2026-04-01'), feat('c', '2026-03-01'), plain('d', '2026-02-01')];
    expect(pickPopular(all, (k) => counts[k] ?? null).map((p) => p.key)).toEqual(['a', 'd', 'c']);
    expect(pickPopular(all, (k) => counts[k] ?? null, 2).map((p) => p.key)).toEqual(['a', 'd']);
  });
});

describe('validateUniqueSlugs (I2)', () => {
  const e = (id: string, slug: string) => ({ id, data: { slug } });
  it('passes when every slug is unique within its language', () => {
    expect(() => validateUniqueSlugs([e('a/tr', 'ortak'), e('a/en', 'ortak'), e('b/tr', 'baska'), e('b/en', 'other')])).not.toThrow();
    expect(() => validateUniqueSlugs([])).not.toThrow();
  });
  it('throws naming both post folders, the language and the slug', () => {
    expect(() => validateUniqueSlugs([e('a/tr', 'ayni'), e('b/tr', 'ayni')]))
      .toThrow('"a" ve "b" yazıları aynı tr slug değerini kullanıyor: "ayni"');
    expect(() => validateUniqueSlugs([e('a/en', 'same'), e('a/tr', 'x'), e('b/en', 'same')])).toThrow(/"a" ve "b".*en/);
  });
});

describe('validateReservedSlugs', () => {
  const e = (id: string, slug: string) => ({ id, data: { slug } });
  it('rejects the category base path as a slug in its language, naming the folder', () => {
    expect(() => validateReservedSlugs([e('a/tr', 'kategori')])).toThrow(/"a"/);
    expect(() => validateReservedSlugs([e('b/en', 'category')])).toThrow(/"b"/);
  });
  it('rejects the popular posts page address too', () => {
    expect(() => validateReservedSlugs([e('c/tr', 'populer')])).toThrow(/"c"/);
    expect(() => validateReservedSlugs([e('d/en', 'popular')])).toThrow(/"d"/);
  });
  it('allows the other language to use it', () => {
    expect(() => validateReservedSlugs([e('a/en', 'kategori'), e('a/tr', 'category')])).not.toThrow();
  });
});
