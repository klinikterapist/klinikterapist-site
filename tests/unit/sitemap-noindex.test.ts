import { describe, it, expect } from 'vitest';
import { isNoindex, stripUrls } from '../../src/lib/sitemap-noindex';

const xml =
  '<?xml version="1.0" encoding="UTF-8"?><urlset>' +
  '<url><loc>https://example.com/</loc><xhtml:link rel="alternate" hreflang="tr" href="https://example.com/"/><xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/"/></url>' +
  '<url><loc>https://example.com/blog/populer/</loc></url>' +
  '<url><loc>https://example.com/blog/kategori/arastirma/</loc><xhtml:link rel="alternate" hreflang="tr" href="https://example.com/blog/kategori/arastirma/"/></url>' +
  '<url><loc>https://example.com/blog/populer-olmayan/</loc></url>' +
  '</urlset>';

describe('sitemap noindex filter', () => {
  it('spots the robots noindex meta', () => {
    expect(isNoindex('<head><meta name="robots" content="noindex"></head>')).toBe(true);
    expect(isNoindex("<meta name='robots' content='noindex, follow'>")).toBe(true);
    expect(isNoindex('<meta name="description" content="noindex">')).toBe(false);
    expect(isNoindex('<p>noindex</p>')).toBe(false);
  });

  it('removes exactly the given URLs and links to them', () => {
    const out = stripUrls(xml, ['https://example.com/blog/populer/', 'https://example.com/blog/kategori/arastirma/']);
    expect(out).not.toContain('<loc>https://example.com/blog/populer/</loc>');
    expect(out).not.toContain('arastirma');
    expect(out).toContain('<loc>https://example.com/blog/populer-olmayan/</loc>');
    expect(out).toContain('<loc>https://example.com/</loc>');
    expect(out).toContain('hreflang="en" href="https://example.com/en/"');
    expect(stripUrls(xml, [])).toBe(xml);
  });
});
