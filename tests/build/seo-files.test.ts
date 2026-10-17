import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, loadPage } from './load';

const read = (f: string) => readFileSync(join(DIST, f), 'utf8');

describe('sitemap, robots, verification', () => {
  it('sitemap lists pages with hreflang alternates, without redirects or 404', () => {
    const sm = read('sitemap-0.xml');
    expect(sm).toContain('https://example.com/en/about/');
    expect(sm).toContain('hreflang="tr"');
    expect(sm).toContain('hreflang="en"');
    expect(sm).not.toMatch(/hreflang="(tr-TR|en-US)"/);
    expect(sm).not.toContain('/admin/');
    expect(sm).not.toContain('/blog/eski-adres/');
    expect(sm).not.toContain('404');
  });

  it('robots.txt allows all and points to the sitemap index', () => {
    const robots = read('robots.txt');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Disallow: /admin/');
    expect(robots).toContain('Sitemap: https://example.com/sitemap-index.xml');
  });

  it('home page carries the Search Console verification meta', () => {
    const meta = loadPage('/').querySelector('meta[name="google-site-verification"]');
    expect(meta?.getAttribute('content')).toBe('test-code');
  });
});
