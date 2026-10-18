import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, allPages, loadPage } from './load';

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

describe('author metadata and web app manifest', () => {
  it('post pages carry author meta and article:author', () => {
    const d = loadPage('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
    expect(d.querySelector('meta[name=author]')?.getAttribute('content')).toBe('Osman Güneş Özkurt, Psikolog');
    expect(d.querySelector('meta[property="article:author"]')?.getAttribute('content')).toBeTruthy();
    const ld = d.querySelectorAll('script[type="application/ld+json"]').map((s) => JSON.parse(s.text));
    const post = ld.find((x) => x['@type'] === 'BlogPosting');
    expect(post.author.jobTitle).toBe('Psikolog');
    expect(post.author.url).toMatch(/\/hakkimda\/$/);
  });

  it('the home person is a member of the association', () => {
    const ld = loadPage('/').querySelectorAll('script[type="application/ld+json"]').map((s) => JSON.parse(s.text));
    expect(ld.find((x) => x['@type'] === 'Person').memberOf[0].name).toBe('Türk Psikologlar Derneği');
  });

  it('RSS items include the author', () => {
    expect(read('rss.xml')).toContain('(Osman Güneş Özkurt, Psikolog)</author>');
    expect(read('en/rss.xml')).toContain('(Osman Güneş Özkurt, Psychologist)</author>');
  });

  it('manifest.webmanifest names the app and has a 512 maskable icon', () => {
    const m = JSON.parse(read('manifest.webmanifest'));
    expect(m.short_name).toBe('Güneş');
    expect(m.display).toBe('standalone');
    expect(m.theme_color).toBe('#FBF3E4');
    expect(m.background_color).toBe('#FBF3E4');
    expect(m.icons.some((i: { sizes: string; purpose?: string }) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
    for (const i of m.icons) expect(existsSync(join(DIST, i.src))).toBe(true);
  });

  it('every page links the manifest', () => {
    for (const p of allPages()) {
      expect(loadPage(p).querySelector('link[rel=manifest]')?.getAttribute('href'), p).toBe('/manifest.webmanifest');
    }
  });
});
