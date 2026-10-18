import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allPages, DIST, DIST_NO_POSTS, loadPage } from './load';

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

  it('citations render as cite text and the cited references as the Kaynakça', () => {
    const tr = loadPage('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
    const cites = tr.querySelectorAll('.prose cite');
    expect(cites.map((c) => c.text)).toEqual(['(Ray, 2004)', 'Smith ve Lee (2010)', '(Ray, 2004; Smith ve Lee, 2010, s. 34)']);
    expect(tr.querySelector('section.references h2')?.text).toBe('Kaynakça');
    const items = tr.querySelectorAll('section.references li');
    expect(items).toHaveLength(2);
    expect(items[0].text).toMatch(/^Ray, O\./);
    expect(items[1].text).toMatch(/^Smith, J\. ve Lee, K\./);
    expect(tr.querySelector('section.references')?.text).not.toContain('Uncited');
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe('https://doi.org/10.1037/0003-066X.59.1.29');

    const en = loadPage('/en/blog/small-steps-towards-a-better-life/');
    expect(en.querySelector('.prose cite')?.text).toBe('(Ray, 2004)');
    expect(en.querySelector('section.references h2')?.text).toBe('References');
    expect(en.querySelectorAll('section.references li')).toHaveLength(2);

    // A post without citations has no reference list.
    expect(loadPage('/blog/kapaksiz-ornek/').querySelector('section.references')).toBeNull();
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
    // Desktop: the newest post as the featured card, the others as cards. Phone: big card and rows.
    expect(list.querySelectorAll('.blog-desk [data-post]').length).toBe(3);
    expect(list.querySelectorAll('.blog-phone [data-post]').length).toBe(3);
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
    expect(empty.querySelectorAll('[data-post]').length).toBe(0);
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

describe('blog list redesign (spec §5.8)', () => {
  const tr = () => loadPage('/blog/');
  const en = () => loadPage('/en/blog/');

  it('phone: big newest-post card with cover, label, title and reading time', () => {
    const card = tr().querySelector('.blog-phone a.newest')!;
    expect(card.getAttribute('href')).toBe('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
    expect(card.text).toContain('YENİ YAZI');
    expect(card.querySelector('.newest-title')?.text).toBe('Daha İyi Bir Yaşam İçin Küçük Adımlar');
    expect(card.text).toMatch(/\d+ dk okuma/);
    // The cover goes through Astro's image service (R-F7).
    expect(card.querySelector('img')?.getAttribute('src')).toMatch(/^\/_astro\/.+\.webp$/);
    expect(en().querySelector('.blog-phone a.newest')?.text).toContain('NEW POST');
  });

  it('phone: "Konular" spans the row when no post is featured and there are no counts', () => {
    for (const d of [tr(), en()]) {
      const pair = d.querySelector('.blog-phone .topic-pair')!;
      expect(pair.classList.contains('single')).toBe(true);
      expect(pair.querySelector('a[href="#popular"]')).toBeNull();
      expect(pair.querySelector('details.topics')).toBeTruthy();
      expect(d.querySelector('#popular')).toBeNull();
    }
    const topics = tr().querySelector('.blog-phone details.topics')!;
    expect(topics.querySelector('summary')?.text).toContain('Konular');
    expect(topics.querySelector('a[href="/blog/kategori/yasam/"]')?.text.trim()).toBe('Yaşam');
    expect(en().querySelector('.blog-phone details.topics summary')?.text).toContain('Topics');
    expect(tr().textContent).not.toContain('Popüler');
    expect(en().textContent).not.toContain('Popular');
  });

  it('phone: other posts are list rows with category, reading time and an optimised thumbnail; no read count without data', () => {
    const rows = tr().querySelectorAll('.blog-phone .post-rows [data-post] a.list-item');
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/blog/kapaksiz-ornek/', '/blog/ornek-zengin/']);
    expect(rows[0].querySelector('.post-cat')?.text.trim()).toBe('Zihinsel Sağlık');
    expect(rows[0].querySelector('.subtitle')?.text).toMatch(/^\d+ dk okuma$/);
    // The stub has no counts: no "okunma", no empty eye icon, no "null".
    for (const d of [tr(), en()]) {
      d.querySelectorAll('script').forEach((s) => s.remove());
      expect(d.querySelector('main')?.textContent).not.toMatch(/okunma|\breads\b|null|undefined/);
      expect(d.querySelector('.reads')).toBeNull();
    }
  });

  it('phone: newsletter row goes to Substack', () => {
    const nl = tr().querySelector('.blog-phone a.list-item.newsletter')!;
    expect(nl.getAttribute('href')).toBe('https://substack.com/');
    expect(nl.text).toContain('Yeni yazılar e-postana gelsin');
    expect(en().querySelector('.blog-phone a.list-item.newsletter')?.text).toContain('Get new posts by e-mail');
  });

  it('desktop: search, topic chips, featured card, card grid and newsletter band', () => {
    const d = tr();
    const chips = d.querySelectorAll('.blog-filters nav.category-nav a').map((a) => a.text.trim());
    expect(chips[0]).toBe('Tümü');
    expect(chips).toContain('Zihinsel Sağlık');
    const feat = d.querySelector('.blog-desk article.featured')!;
    expect(feat.querySelector('h2')?.text.trim()).toBe('Daha İyi Bir Yaşam İçin Küçük Adımlar');
    expect(feat.querySelector('.tag')?.text).toContain('Yaşam');
    expect(feat.querySelector('img')?.getAttribute('srcset')).toBeTruthy();
    expect(d.querySelectorAll('.blog-desk .post-grid .post-card')).toHaveLength(2);
    expect(d.querySelector('.blog-desk .newsletter-band a')?.getAttribute('href')).toBe('https://substack.com/');
  });

  it('search box: labelled search field in both languages', () => {
    const form = tr().querySelector('form[data-blog-search]')!;
    const input = form.querySelector('input[type=search]')!;
    expect(input.getAttribute('placeholder')).toBe('Yazılarda ara…');
    const id = input.getAttribute('id');
    expect(form.querySelector(`label[for="${id}"]`)?.text.trim()).toBeTruthy();
    expect(en().querySelector('form[data-blog-search] input')?.getAttribute('placeholder')).toBe('Search posts…');
    // Every searchable post carries its title and category text.
    const item = tr().querySelector('.blog-phone [data-post][data-cat="zihinsel-saglik"]')!;
    expect(item.getAttribute('data-search')).toContain('Kapaksız Örnek');
    expect(item.getAttribute('data-search')).toContain('Zihinsel Sağlık');
  });

  it('popular section has the #popular anchor in both languages when posts qualify', () => {
    for (const path of ['/ui-kit/tr/', '/ui-kit/en/']) {
      const sec = loadPage(path).querySelector('section#popular')!;
      expect(sec, path).toBeTruthy();
      expect(sec.querySelectorAll('a.list-item').length, path).toBeGreaterThan(0);
    }
    expect(loadPage('/ui-kit/tr/').querySelector('#popular h2')?.text).toBe('Popüler yazılar');
    expect(loadPage('/ui-kit/en/').querySelector('#popular h2')?.text).toBe('Popular posts');
  });

  it('no posts: a friendly empty state, no search, no tiles, no broken cards', () => {
    for (const [path, text] of [
      ['/blog/', 'Henüz yazı yok'],
      ['/en/blog/', 'No posts yet'],
    ]) {
      const d = loadPage(path, DIST_NO_POSTS);
      expect(d.querySelector('.blog-empty')?.text, path).toContain(text);
      expect(d.querySelector('form[data-blog-search]'), path).toBeNull();
      expect(d.querySelector('.topic-pair'), path).toBeNull();
      expect(d.querySelectorAll('[data-post]'), path).toHaveLength(0);
      expect(d.querySelector('main')?.textContent, path).not.toMatch(/undefined|null|NaN/);
    }
  });
});
