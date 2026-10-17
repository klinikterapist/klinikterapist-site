import { describe, it, expect } from 'vitest';
import { parseDoi, fetchCsl, cslToReference, DoiError } from '../../../src/admin/lib/doi';

const ray = {
  type: 'article-journal',
  title: 'How the Mind Hurts and Heals the Body',
  'container-title': 'American Psychologist',
  volume: '59', issue: '1', page: '29-40',
  issued: { 'date-parts': [[2004]] },
  author: [{ family: 'Ray', given: 'Oakley' }],
  DOI: '10.1037/0003-066X.59.1.29',
};
const res = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

describe('parseDoi', () => {
  it('accepts bare, url, doi: and padded dx forms', () => {
    expect(parseDoi('10.1037/x')).toBe('10.1037/x');
    expect(parseDoi('https://doi.org/10.1037/x')).toBe('10.1037/x');
    expect(parseDoi('doi:10.1037/x')).toBe('10.1037/x');
    expect(parseDoi(' http://dx.doi.org/10.1037/x ')).toBe('10.1037/x');
  });
  it('returns null for non-DOI text', () => {
    expect(parseDoi('ray 2004')).toBeNull();
  });
});

describe('cslToReference', () => {
  it('maps a journal article', () => {
    const { ref, unsupported } = cslToReference(ray, new Set());
    expect(unsupported).toBeNull();
    expect(ref).toMatchObject({
      type: 'article', title: 'How the mind hurts and heals the body', pages: '29–40', id: 'ray2004',
      year: 2004, container: 'American Psychologist', volume: '59', issue: '1',
      doi: '10.1037/0003-066X.59.1.29', authors: [{ family: 'Ray', given: 'Oakley' }],
    });
  });
  it('flags unsupported types and defaults to book', () => {
    const { ref, unsupported } = cslToReference({ type: 'report', title: 'T' }, new Set());
    expect(unsupported).toBe('report');
    expect(ref.type).toBe('book');
  });
  it('maps literal authors and missing issued', () => {
    const { ref } = cslToReference({ type: 'book', title: 'Guide', author: [{ literal: 'World Health Organization' }] }, new Set());
    expect(ref.authors).toEqual([{ literal: 'World Health Organization' }]);
    expect(ref.year).toBe('nd');
  });
  it('handles array container, editors, bare DOI and Turkish language', () => {
    const { ref } = cslToReference(
      { type: 'chapter', title: 'Çocuklarda Kaygı', language: 'tr', 'container-title': ['Kitap Adı'], editor: [{ family: 'Can', given: 'A' }], DOI: 'https://doi.org/10.1234/abc', edition: '2', publisher: 'P', URL: 'https://x.org' },
      new Set(),
    );
    expect(ref).toMatchObject({ type: 'chapter', container: 'Kitap Adı', editors: [{ family: 'Can', given: 'A' }], doi: '10.1234/abc', edition: '2', publisher: 'P', url: 'https://x.org' });
  });
});

describe('fetchCsl', () => {
  it('GETs doi.org with the CSL accept header', async () => {
    let seen: [unknown, RequestInit | undefined] = [null, undefined];
    const fn = (async (u: unknown, i?: RequestInit) => { seen = [u, i]; return res(200, ray); }) as unknown as typeof fetch;
    expect(await fetchCsl('10.1037/x', fn)).toEqual(ray);
    expect(String(seen[0])).toBe('https://doi.org/10.1037/x');
    expect(JSON.stringify(seen[1])).toContain('application/vnd.citationstyles.csl+json');
  });
  it('404 -> not found', async () => {
    await expect(fetchCsl('10.1/x', (async () => res(404)) as unknown as typeof fetch)).rejects.toThrow('Bu DOI bulunamadı.');
  });
  it('network error and 5xx -> service message', async () => {
    const msg = 'DOI servisine ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
    await expect(fetchCsl('10.1/x', (async () => { throw new TypeError('fail'); }) as unknown as typeof fetch)).rejects.toThrow(msg);
    await expect(fetchCsl('10.1/x', (async () => res(503)) as unknown as typeof fetch)).rejects.toBeInstanceOf(DoiError);
  });
});
