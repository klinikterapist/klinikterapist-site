import { describe, expect, it } from 'vitest';
import {
  bibliography,
  citationText,
  formatReferenceHtml,
  makeRefId,
  referenceSchema,
  sentenceCase,
  type Citation,
  type Reference,
} from '../../src/lib/apa';

const R: Reference = {
  id: 'ray2004', type: 'article', authors: [{ family: 'Ray', given: 'Oakley' }], year: 2004,
  title: 'How the mind hurts and heals the body', container: 'American Psychologist',
  volume: '59', issue: '1', pages: '29-40', doi: '10.1037/0003-066X.59.1.29',
};
const SL: Reference = {
  id: 'sl', type: 'article', authors: [{ family: 'Smith', given: 'John' }, { family: 'Lee', given: 'Kim' }],
  year: 2010, title: 'Two authors',
};
const KAYA: Reference = {
  id: 'kaya', type: 'article', year: 2021, title: 'Many authors',
  authors: [{ family: 'Kaya', given: 'A' }, { family: 'Demir', given: 'B' }, { family: 'Aydın', given: 'C' }],
};
const cite = (ids: string[], narrative = false): Citation => ({ items: ids.map((id) => ({ id })), narrative });
const person = (n: number) => ({ family: `Author${String.fromCharCode(65 + n)}`, given: 'X' });

describe('formatReferenceHtml', () => {
  it('article with DOI', () => {
    expect(formatReferenceHtml(R, [R], 'en')).toBe(
      'Ray, O. (2004). How the mind hurts and heals the body. <i>American Psychologist, 59</i>(1), 29–40. <a href="https://doi.org/10.1037/0003-066X.59.1.29">https://doi.org/10.1037/0003-066X.59.1.29</a>',
    );
  });
  it('two authors', () => {
    expect(formatReferenceHtml(SL, [SL], 'en')).toContain('Smith, J., &amp; Lee, K. (2010).');
    expect(formatReferenceHtml(SL, [SL], 'tr')).toContain('Smith, J. ve Lee, K. (2010).');
  });
  it('book with edition', () => {
    const b: Reference = { id: 'b', type: 'book', authors: [{ family: 'Sapolsky', given: 'Robert M.' }], year: 2004, title: "Why zebras don't get ulcers", edition: '3', publisher: 'Holt' };
    expect(formatReferenceHtml(b, [b], 'en')).toBe("Sapolsky, R. M. (2004). <i>Why zebras don't get ulcers</i> (3rd ed.). Holt.");
    expect(formatReferenceHtml(b, [b], 'tr')).toBe("Sapolsky, R. M. (2004). <i>Why zebras don't get ulcers</i> (3. bs.). Holt.");
  });
  it('chapter', () => {
    const c: Reference = { id: 'c', type: 'chapter', authors: [{ family: 'Yılmaz', given: 'A' }], editors: [{ family: 'Demir', given: 'B' }], year: 2019, title: 'Bağlanma kuramı', container: 'Gelişim psikolojisi', pages: '10-20', publisher: 'Nobel' };
    expect(formatReferenceHtml(c, [c], 'tr')).toBe('Yılmaz, A. (2019). Bağlanma kuramı. B. Demir (Ed.), <i>Gelişim psikolojisi</i> içinde (ss. 10–20). Nobel.');
    expect(formatReferenceHtml(c, [c], 'en')).toBe('Yılmaz, A. (2019). Bağlanma kuramı. In B. Demir (Ed.), <i>Gelişim psikolojisi</i> (pp. 10–20). Nobel.');
  });
  it('organisation author without a date', () => {
    const o: Reference = { id: 'o', type: 'book', authors: [{ literal: 'American Psychiatric Association' }], year: 'nd', title: 'DSM' };
    expect(formatReferenceHtml(o, [o], 'tr')).toContain('American Psychiatric Association. (t.y.).');
    expect(formatReferenceHtml(o, [o], 'en')).toContain('American Psychiatric Association. (n.d.).');
  });
  it('web page with access date', () => {
    const w: Reference = { id: 'w', type: 'web', authors: [{ literal: 'WHO' }], year: 2022, title: 'Mental health', url: 'https://example.org/x', accessed: '2026-01-05' };
    expect(formatReferenceHtml(w, [w], 'tr')).toMatch(/Erişim tarihi: 5 Ocak 2026, <a href="https:\/\/example\.org\/x">https:\/\/example\.org\/x<\/a>$/);
    expect(formatReferenceHtml(w, [w], 'en')).toMatch(/Retrieved January 5, 2026, from <a href="https:\/\/example\.org\/x">/);
  });
  it('prints an unsafe url as text', () => {
    const w: Reference = { id: 'w', type: 'web', authors: [{ literal: 'WHO' }], year: 2022, title: 'T', url: 'javascript:x' };
    const html = formatReferenceHtml(w, [w], 'en');
    expect(html).not.toContain('<a');
    expect(html).toContain('javascript:x');
  });
  it('escapes text fields', () => {
    const w: Reference = { id: 'w', type: 'book', authors: [{ literal: 'A<b>' }], year: 2022, title: '<script>x</script>' };
    const html = formatReferenceHtml(w, [w], 'en');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
  });
  it('suffix', () => {
    const k: Reference = { id: 'k', type: 'book', authors: [{ family: 'King', given: 'Martin Luther', suffix: 'Jr.' }], year: 1963, title: 'T' };
    expect(formatReferenceHtml(k, [k], 'en')).toMatch(/^King, M\. L\., Jr\. \(1963\)\./);
  });
  it('initials of hyphenated given names', () => {
    const k: Reference = { id: 'k', type: 'book', authors: [{ family: 'Sartre', given: 'Jean-Paul' }], year: 1943, title: 'T' };
    expect(formatReferenceHtml(k, [k], 'en')).toMatch(/^Sartre, J\.-P\. \(1943\)\./);
  });
  it('lists 20 authors in full and abbreviates 21 or more (APA 7 §9.8, ruling R13)', () => {
    const mk = (n: number): Reference => ({ id: 'm', type: 'article', authors: Array.from({ length: n }, (_, i) => person(i)), year: 2020, title: 'T' });
    const h20 = formatReferenceHtml(mk(20), [], 'en');
    for (let i = 0; i < 20; i++) expect(h20).toContain(`Author${String.fromCharCode(65 + i)}, X.`);
    expect(h20).not.toContain('. . .');
    const h21 = formatReferenceHtml(mk(21), [], 'en');
    expect(h21).toContain('AuthorS, X., . . . AuthorU, X. (2020).');
    expect(h21).not.toContain('AuthorT,');
    const h22 = formatReferenceHtml(mk(22), [], 'en');
    expect(h22).toContain('AuthorS, X., . . . AuthorV, X. (2020).');
    expect(h22).not.toContain('AuthorT,');
  });
  it('an access date must be a real calendar date', () => {
    const w = { id: 'w', type: 'web', authors: [], year: 2022, title: 'T', url: 'https://example.org' };
    expect(referenceSchema.safeParse({ ...w, accessed: '2026-01-05' }).success).toBe(true);
    expect(referenceSchema.safeParse({ ...w, accessed: '2026-12-31' }).success).toBe(true);
    for (const bad of ['2026-13-01', '2026-00-10', '2026-01-32', '2026-01-00', '2026-1-5']) {
      expect(referenceSchema.safeParse({ ...w, accessed: bad }).success, bad).toBe(false);
    }
  });
  it('title leads when there is no author', () => {
    const b: Reference = { id: 'b', type: 'book', authors: [], year: 2022, title: 'Mental health', publisher: 'Pub' };
    expect(formatReferenceHtml(b, [b], 'en')).toBe('<i>Mental health</i>. (2022). Pub.');
  });
  it('2004a/2004b in the reference entries', () => {
    const a: Reference = { ...R, id: 'a', title: 'Alpha' };
    const b: Reference = { ...R, id: 'b', title: 'Beta' };
    expect(formatReferenceHtml(b, [b, a], 'en')).toContain('Ray, O. (2004b). Beta.');
    expect(formatReferenceHtml(a, [b, a], 'en')).toContain('Ray, O. (2004a). Alpha.');
  });
});

describe('citationText', () => {
  const refs = [R, SL, KAYA];
  it('parenthetical', () => {
    expect(citationText(cite(['ray2004']), refs, 'tr')).toBe('(Ray, 2004)');
    expect(citationText(cite(['sl']), refs, 'tr')).toBe('(Smith ve Lee, 2010)');
    expect(citationText(cite(['kaya']), refs, 'tr')).toBe('(Kaya vd., 2021)');
    expect(citationText(cite(['sl']), refs, 'en')).toBe('(Smith & Lee, 2010)');
    expect(citationText(cite(['kaya']), refs, 'en')).toBe('(Kaya et al., 2021)');
  });
  it('narrative', () => {
    expect(citationText(cite(['sl'], true), refs, 'tr')).toBe('Smith ve Lee (2010)');
    expect(citationText(cite(['sl'], true), refs, 'en')).toBe('Smith and Lee (2010)');
  });
  it('several sources in either order', () => {
    expect(citationText(cite(['ray2004', 'sl']), refs, 'tr')).toBe('(Ray, 2004; Smith ve Lee, 2010)');
    expect(citationText(cite(['sl', 'ray2004']), refs, 'tr')).toBe('(Ray, 2004; Smith ve Lee, 2010)');
  });
  it('same author merges years', () => {
    const r2: Reference = { ...R, id: 'ray2010', year: 2010, title: 'Other' };
    expect(citationText(cite(['ray2010', 'ray2004']), [R, r2], 'en')).toBe('(Ray, 2004, 2010)');
  });
  it('locators', () => {
    const c = (kind: 'p' | 'pp' | 'para' | 'ch', value: string): Citation => ({ items: [{ id: 'ray2004', locator: { kind, value } }], narrative: false });
    expect(citationText(c('p', '34'), refs, 'tr')).toBe('(Ray, 2004, s. 34)');
    expect(citationText(c('pp', '34-36'), refs, 'tr')).toBe('(Ray, 2004, ss. 34–36)');
    expect(citationText(c('para', '3'), refs, 'tr')).toBe('(Ray, 2004, paragraf 3)');
    expect(citationText(c('ch', '2'), refs, 'tr')).toBe('(Ray, 2004, Bölüm 2)');
    expect(citationText(c('p', '34'), refs, 'en')).toBe('(Ray, 2004, p. 34)');
    expect(citationText(c('pp', '34–36'), refs, 'en')).toBe('(Ray, 2004, pp. 34–36)');
    expect(citationText(c('para', '3'), refs, 'en')).toBe('(Ray, 2004, para. 3)');
    expect(citationText(c('ch', '2'), refs, 'en')).toBe('(Ray, 2004, Chapter 2)');
  });
  it('2004a/2004b', () => {
    const a: Reference = { ...R, id: 'a', title: 'Alpha' };
    const b: Reference = { ...R, id: 'b', title: 'Beta' };
    expect(citationText(cite(['b']), [b, a], 'en')).toBe('(Ray, 2004b)');
    expect(citationText(cite(['a']), [b, a], 'en')).toBe('(Ray, 2004a)');
  });
  it('no author uses the title; organisation author in full', () => {
    const t: Reference = { id: 't', type: 'book', authors: [], year: 2022, title: 'Mental health' };
    const o: Reference = { id: 'o', type: 'book', authors: [{ literal: 'American Psychiatric Association' }], year: 2013, title: 'DSM' };
    expect(citationText(cite(['t']), [t], 'en')).toBe('(Mental health, 2022)');
    expect(citationText(cite(['o']), [o], 'en')).toBe('(American Psychiatric Association, 2013)');
  });
  it('no date and in press', () => {
    const nd: Reference = { ...R, id: 'nd', year: 'nd' };
    const ip: Reference = { ...R, id: 'ip', year: 'inpress' };
    expect(citationText(cite(['nd']), [nd], 'tr')).toBe('(Ray, t.y.)');
    expect(citationText(cite(['ip']), [ip], 'tr')).toBe('(Ray, baskıda)');
    expect(citationText(cite(['nd']), [nd], 'en')).toBe('(Ray, n.d.)');
    expect(citationText(cite(['ip']), [ip], 'en')).toBe('(Ray, in press)');
  });
  it('throws for an unknown id', () => {
    expect(() => citationText(cite(['nope']), refs, 'en')).toThrow(/nope/);
  });
});

describe('bibliography', () => {
  const mk = (id: string, family: string, year: Reference['year'] = 2000, title = 'T'): Reference =>
    ({ id, type: 'book', authors: [{ family }], year, title });
  it('sorts Turkish collation and drops uncited', () => {
    const refs = [mk('d', 'Demir'), mk('i', 'İnce'), mk('c', 'Çelik'), mk('l', 'Ilgaz'), mk('x', 'Zed')];
    const out = bibliography(refs, new Set(['d', 'i', 'c', 'l']), 'tr').map((r) => r.id);
    expect(out).toEqual(['c', 'd', 'l', 'i']);
  });
  it('ties: nd first, in press last, then title', () => {
    const refs = [mk('ip', 'Ray', 'inpress'), mk('y', 'Ray', 2004, 'B'), mk('nd', 'Ray', 'nd'), mk('y2', 'Ray', 2004, 'A')];
    expect(bibliography(refs, new Set(refs.map((r) => r.id)), 'en').map((r) => r.id)).toEqual(['nd', 'y2', 'y', 'ip']);
  });
  it('uses the title when there is no author', () => {
    const t: Reference = { id: 't', type: 'book', authors: [], year: 2000, title: 'Beta' };
    const refs = [mk('z', 'Zed'), t, mk('a', 'Alpha')];
    expect(bibliography(refs, new Set(['z', 't', 'a']), 'en').map((r) => r.id)).toEqual(['a', 't', 'z']);
  });
});

describe('sentenceCase', () => {
  it('lowers words, keeps acronyms and the word after a colon', () => {
    expect(sentenceCase('How the Mind Hurts: The Body and APA')).toBe('How the mind hurts: The body and APA');
  });
  it('keeps the word after ? and !', () => {
    expect(sentenceCase('Why Sleep? The Answer! Is Here')).toBe('Why sleep? The answer! Is here');
  });
});

describe('makeRefId', () => {
  it('builds ids and avoids collisions', () => {
    const ray = { authors: [{ family: 'Ray' }], year: 2004 as const, title: 'X' };
    expect(makeRefId(ray, new Set())).toBe('ray2004');
    expect(makeRefId(ray, new Set(['ray2004']))).toBe('ray2004-2');
    expect(makeRefId(ray, new Set(['ray2004', 'ray2004-2']))).toBe('ray2004-3');
  });
  it('folds non-ASCII', () => {
    expect(makeRefId({ authors: [{ family: 'Yılmaz' }], year: 2019, title: 'X' }, new Set())).toBe('yilmaz2019');
  });
  it('uses the first title word without an author', () => {
    expect(makeRefId({ authors: [], year: 2022, title: 'Mental health today' }, new Set())).toBe('mental2022');
  });
});

describe('review fixes', () => {
  const mkA = (id: string, authors: { family: string; given?: string }[], year: Reference['year'], title = 'T'): Reference =>
    ({ id, type: 'book', authors, year, title });
  const r03 = mkA('r03', [{ family: 'Ray', given: 'O' }], 2003);
  const rs04 = mkA('rs04', [{ family: 'Ray', given: 'O' }, { family: 'Smith', given: 'J' }], 2004);
  const r10 = mkA('r10', [{ family: 'Ray', given: 'O' }], 2010);

  it('orders author lists APA-style and merges years by author key', () => {
    const refs = [rs04, r10, r03];
    expect(bibliography(refs, new Set(['r03', 'rs04', 'r10']), 'en').map((r) => r.id)).toEqual(['r03', 'r10', 'rs04']);
    expect(citationText(cite(['r03', 'rs04', 'r10']), refs, 'en')).toBe('(Ray, 2003, 2010; Ray & Smith, 2004)');
  });
  it('compares initials when surnames tie', () => {
    const a = mkA('a', [{ family: 'Ray', given: 'Z' }], 2000);
    const b = mkA('b', [{ family: 'Ray', given: 'A' }], 2000);
    expect(bibliography([a, b], new Set(['a', 'b']), 'en').map((r) => r.id)).toEqual(['b', 'a']);
  });
  it('ignores a leading article when sorting by title (EN)', () => {
    const t = (id: string, title: string): Reference => ({ id, type: 'book', authors: [], year: 2000, title });
    const refs = [t('z', 'Zebra'), t('a', 'The Apple'), t('m', 'Mango')];
    expect(bibliography(refs, new Set(['z', 'a', 'm']), 'en').map((r) => r.id)).toEqual(['a', 'm', 'z']);
  });
  const chapter = (editors: { family: string; given: string }[]): Reference =>
    ({ id: 'c', type: 'chapter', authors: [{ family: 'Y', given: 'A' }], editors, year: 2019, title: 'T', container: 'Book', pages: '1-2' });
  const E = [{ family: 'Demir', given: 'B' }, { family: 'Kaya', given: 'C' }, { family: 'Aslan', given: 'D' }];
  it('editor lists', () => {
    const two = chapter(E.slice(0, 2));
    expect(formatReferenceHtml(two, [two], 'en')).toContain('In B. Demir &amp; C. Kaya (Eds.), <i>Book</i>');
    expect(formatReferenceHtml(two, [two], 'tr')).toContain('B. Demir ve C. Kaya (Ed.), <i>Book</i> içinde');
    const three = chapter(E);
    expect(formatReferenceHtml(three, [three], 'en')).toContain('In B. Demir, C. Kaya, &amp; D. Aslan (Eds.)');
    expect(formatReferenceHtml(three, [three], 'tr')).toContain('B. Demir, C. Kaya ve D. Aslan (Ed.)');
  });
  it('chapter without a container has no empty italics', () => {
    const c: Reference = { ...chapter(E.slice(0, 1)), container: undefined, pages: undefined };
    expect(formatReferenceHtml(c, [c], 'en')).not.toContain('<i></i>');
  });
  it('sentence case with Turkish and I', () => {
    expect(sentenceCase('İnsan ve Işık: İstanbul Örneği')).toBe('İnsan ve ışık: İstanbul örneği');
    expect(sentenceCase('What I Learned About Self-Esteem')).toBe('What I learned about self-esteem');
  });
  it('serial comma in narrative lists', () => {
    const mk = (id: string, f: string, y: number): Reference => ({ id, type: 'book', authors: [{ family: f }], year: y, title: 'T' });
    const refs = [mk('a', 'Ay', 2001), mk('b', 'Bo', 2002), mk('c', 'Cy', 2003)];
    expect(citationText(cite(['a', 'b', 'c'], true), refs, 'en')).toBe('Ay (2001), Bo (2002), and Cy (2003)');
    expect(citationText(cite(['a', 'b', 'c'], true), refs, 'tr')).toBe('Ay (2001), Bo (2002) ve Cy (2003)');
  });
  it('prints the site name for web pages', () => {
    const w: Reference = { id: 'w', type: 'web', authors: [{ literal: 'WHO' }], year: 2022, title: 'Mental health', container: 'WHO News', url: 'https://example.org/x' };
    expect(formatReferenceHtml(w, [w], 'en')).toContain('<i>Mental health</i>. WHO News. <a');
  });
  it('initials from dotted input', () => {
    const k: Reference = { id: 'k', type: 'book', authors: [{ family: 'Sapolsky', given: 'R.M.' }], year: 2004, title: 'T' };
    expect(formatReferenceHtml(k, [k], 'en')).toMatch(/^Sapolsky, R\. M\. \(2004\)/);
  });
  it('percent-encodes the DOI in the href only', () => {
    const d: Reference = { ...R, doi: '10.1002/a#b?c' };
    const html = formatReferenceHtml(d, [d], 'en');
    expect(html).toContain('href="https://doi.org/10.1002/a%23b%3Fc"');
    expect(html).toContain('>https://doi.org/10.1002/a#b?c</a>');
  });
});
