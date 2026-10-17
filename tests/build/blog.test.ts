import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allPages, DIST, loadPage } from './load';

// The brief reads `dist/…`; build tests read the fixture build in `DIST` (dist-test).
const distText = (file: string) => readFileSync(join(DIST, file), 'utf8');

describe('blog', () => {
  it('post page: hreflang, language switch, JSON-LD, author box, og, categories, RSS, redirects', () => {
    const tr = loadPage('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
    expect(tr.querySelector('link[hreflang=en]')?.getAttribute('href'))
      .toBe('https://example.com/en/blog/small-steps-towards-a-better-life/');
    expect(tr.querySelector('a.lang-switch')?.getAttribute('href'))
      .toBe('/en/blog/small-steps-towards-a-better-life/');
    const ld = tr.querySelectorAll('script[type="application/ld+json"]').map(s => JSON.parse(s.text));
    const bp = ld.find(x => x['@type'] === 'BlogPosting');
    expect(bp.author.name).toBe('Osman Güneş Özkurt');
    expect(bp.inLanguage).toBe('tr-TR');
    expect(bp.datePublished).toBeTruthy(); expect(bp.dateModified).toBeTruthy();
    expect(ld.some(x => x['@type'] === 'BreadcrumbList')).toBe(true);
    expect(tr.querySelector('.author-box')).not.toBeNull();
    expect(tr.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article');
    expect(loadPage('/blog/kategori/zihinsel-saglik/').querySelector('h1')).not.toBeNull();
    expect(loadPage('/en/blog/category/mental-health/').querySelector('html')?.getAttribute('lang')).toBe('en');
    expect(distText('rss.xml')).toContain('<language>tr</language>');
    expect(distText('en/rss.xml')).toContain('small-steps-towards-a-better-life');
    const r = loadPage('/blog/eski-adres/');
    expect(r.querySelector('meta[http-equiv=refresh]')?.getAttribute('content'))
      .toBe('0; url=/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
    // a post without cover still builds with the default og:image (second seed post, no cover)
    expect(loadPage('/blog/kapaksiz-ornek/').querySelector('meta[property="og:image"]')?.getAttribute('content'))
      .toBe('https://example.com/og-default.jpg');
  });

  it('standfirst shows the subtitle when set, the meta description stays the SEO text', () => {
    const tr = loadPage('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
    expect(tr.querySelector('.standfirst')?.text.trim()).toBe('Küçük adımlar, kalıcı değişim');
    expect(tr.querySelector('meta[name=description]')?.getAttribute('content')).toBe(
      'Büyük değişimler çoğu zaman küçük, tutarlı adımlarla başlar. Bu yazıda günlük hayatta uygulayabileceğiniz birkaç basit adımı ele alıyoruz.',
    );
  });

  it('strikethrough and highlight render as del and mark', () => {
    const tr = loadPage('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
    expect(tr.querySelector('.prose del')?.text).toBe('eski');
    expect(tr.querySelector('.prose mark')?.text).toBe('önemli');
  });

  it('EN post switches back to the TR translation', () => {
    const en = loadPage('/en/blog/no-cover-example/');
    expect(en.querySelector('a.lang-switch')?.getAttribute('href')).toBe('/blog/kapaksiz-ornek/');
    expect(en.querySelector('html')?.getAttribute('lang')).toBe('en');
  });

  it('post page shows the last update only when set, and related posts', () => {
    const noCover = loadPage('/blog/kapaksiz-ornek/');
    expect(noCover.textContent).toContain('Son güncelleme');
    expect(noCover.querySelectorAll('.related .post-card').length).toBeGreaterThan(0);
    expect(loadPage('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/').textContent).not.toContain('Son güncelleme');
  });

  it('blog list shows every post and links to every category', () => {
    const list = loadPage('/blog/');
    expect(list.querySelectorAll('.post-card').length).toBe(3);
    expect(list.querySelector('a[href="/blog/kategori/zihinsel-saglik/"]')).not.toBeNull();
    expect(list.querySelector('a[href="/blog/"][aria-current=page]')).not.toBeNull();
    expect(loadPage('/en/blog/').querySelector('a.lang-switch')?.getAttribute('href')).toBe('/blog/');
  });

  it('category pages exist for every category, highlight the current one and show an empty state', () => {
    const cat = loadPage('/blog/kategori/zihinsel-saglik/');
    expect(cat.querySelector('h1')?.text).toBe('Zihinsel Sağlık');
    expect(cat.querySelector('a[href="/blog/kategori/zihinsel-saglik/"][aria-current=page]')).not.toBeNull();
    expect(cat.querySelector('a.lang-switch')?.getAttribute('href')).toBe('/en/blog/category/mental-health/');
    const empty = loadPage('/blog/kategori/arastirma/');
    expect(empty.querySelectorAll('.post-card').length).toBe(0);
    expect(empty.textContent).toContain('Bu kategoride henüz yazı yok');
  });

  it('redirect pages are canonical to the target and noindex, and stay out of allPages and the sitemap', () => {
    const r = loadPage('/blog/eski-adres/');
    expect(r.querySelector('link[rel=canonical]')?.getAttribute('href'))
      .toBe('https://example.com/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
    expect(r.querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex');
    expect(allPages()).not.toContain('/blog/eski-adres/');
    expect(distText('sitemap-0.xml')).not.toContain('eski-adres');
  });

  it('redirect pages use the language of their target and show visible fallback text', () => {
    const tr = loadPage('/blog/eski-adres/');
    expect(tr.querySelector('html')?.getAttribute('lang')).toBe('tr');
    expect(tr.querySelector('body')?.textContent).toContain('Bu sayfa taşındı');
    expect(tr.querySelector('body a')?.getAttribute('href')).toBe('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
    const en = loadPage('/en/blog/old-address/');
    expect(en.querySelector('html')?.getAttribute('lang')).toBe('en');
    expect(en.querySelector('body')?.textContent).toContain('This page has moved');
    expect(en.querySelector('body a')?.getAttribute('href')).toBe('/en/blog/small-steps-towards-a-better-life/');
  });

  it('empty category pages are noindex, categories with posts are indexable', () => {
    expect(loadPage('/blog/kategori/arastirma/').querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex');
    expect(loadPage('/en/blog/category/research/').querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex');
    expect(loadPage('/blog/kategori/zihinsel-saglik/').querySelector('meta[name=robots]')).toBeNull();
    expect(loadPage('/blog/').querySelector('meta[name=robots]')).toBeNull();
  });

  it('author box shows the explicit short intro', () => {
    const intro = loadPage('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/').querySelector('.author-box .intro');
    expect(intro?.textContent).toBe('Kısa tanıtım: Uzm. Psk. olarak çalışıyorum.');
  });

  it('rich post body: captioned figure, callout box, click-to-load YouTube without an iframe', () => {
    for (const path of ['/blog/ornek-zengin/', '/en/blog/rich-example/']) {
      const d = loadPage(path);
      const fig = d.querySelector('.prose figure');
      expect(fig?.querySelector('img'), path).not.toBeNull();
      expect(fig?.querySelector('img')?.getAttribute('title'), path).toBeFalsy();
      expect(fig?.querySelector('figcaption')?.textContent.trim(), path).toMatch(/yaprak|leaf/i);
      expect(d.querySelector('.prose aside.callout p strong'), path).not.toBeNull();
      const yt = d.querySelector('.prose .youtube[data-id="dQw4w9WgXcQ"] a');
      expect(yt?.getAttribute('href'), path).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(d.toString(), path).not.toContain('<iframe');
    }
  });

  it('blog pages advertise their RSS feed', () => {
    expect(loadPage('/blog/').querySelector('link[type="application/rss+xml"]')?.getAttribute('href'))
      .toBe('https://example.com/rss.xml');
    expect(loadPage('/en/blog/').querySelector('link[type="application/rss+xml"]')?.getAttribute('href'))
      .toBe('https://example.com/en/rss.xml');
  });
});
