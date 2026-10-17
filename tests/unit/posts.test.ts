import { describe, it, expect } from 'vitest';
import { validatePostPairs, validateUniqueSlugs, sortNewestFirst, pickRelated, toPostEntry } from '../../src/lib/posts';

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
