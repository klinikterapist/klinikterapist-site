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
    expect(tr.querySelector('.byline a.byline-author')?.getAttribute('href')).toBe('/hakkimda/');
    expect(tr.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article');
    // the cover's share image carries its real size, so cards show it without fetching it first
    const ogW = Number(tr.querySelector('meta[property="og:image:width"]')?.getAttribute('content'));
    const ogH = Number(tr.querySelector('meta[property="og:image:height"]')?.getAttribute('content'));
    expect(ogW).toBeGreaterThan(0); expect(ogW).toBeLessThanOrEqual(1200); expect(ogH).toBeGreaterThan(0);
    expect(tr.querySelector('meta[property="og:image:alt"]')?.getAttribute('content')).toBeTruthy();
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
    expect(tr.querySelector('section.references details summary .title')?.text).toBe('Kaynakça');
    const items = tr.querySelectorAll('section.references details ol.references-list li');
    expect(items).toHaveLength(2);
    expect(items[0].text).toMatch(/^Ray, O\./);
    expect(items[1].text).toMatch(/^Smith, J\. ve Lee, K\./);
    expect(tr.querySelector('section.references')?.text).not.toContain('Uncited');
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe('https://doi.org/10.1037/0003-066X.59.1.29');

    const en = loadPage('/en/blog/small-steps-towards-a-better-life/');
    expect(en.querySelector('.prose cite')?.text).toBe('(Ray, 2004)');
    expect(en.querySelector('section.references details summary .title')?.text).toBe('References');
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
    expect(noCover.querySelectorAll('.related a.list-item').length).toBeGreaterThan(0);
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

  it('heading is "Blog" with a short description in both languages (also with no posts)', () => {
    for (const d of [tr(), loadPage('/blog/', DIST_NO_POSTS)]) {
      expect(d.querySelector('h1')?.text.trim()).toBe('Blog');
      expect(d.querySelector('.page-head .lead')?.text.trim()).toBe('Kaygı, ilişkiler ve kendini anlamak üzerine yazılar.');
    }
    for (const d of [en(), loadPage('/en/blog/', DIST_NO_POSTS)]) {
      expect(d.querySelector('h1')?.text.trim()).toBe('Blog');
      expect(d.querySelector('.page-head .lead')?.text.trim()).toBe('Writing on anxiety, relationships and understanding yourself.');
    }
    expect(tr().querySelector('title')?.text).toMatch(/^Blog \|/);
    // The longer text stays the meta description.
    expect(tr().querySelector('meta[name=description]')?.getAttribute('content')).toMatch(/^Psikoloji, zihinsel sağlık/);
  });

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

  it('topics page: one tile per topic with its icon, name and post count, linking to the category', () => {
    const d = loadPage('/blog/konular/');
    expect(d.querySelector('h1')?.text).toBe('Konular');
    const tiles = d.querySelectorAll('main .topic-grid .topic');
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile.querySelector('svg.icon')).toBeTruthy();
      expect(tile.querySelector('b')?.text.trim()).toBeTruthy();
      expect(tile.querySelector('small')?.text).toMatch(/^\d+ yazı$|^Henüz yazı yok$/);
      // A topic with posts is a link to its category page; an empty one is faded and not a link.
      if (tile.tagName === 'A') expect(tile.getAttribute('href')).toMatch(/^\/blog\/kategori\/[a-z0-9-]+\/$/);
      else expect(tile.classList.contains('topic--empty')).toBe(true);
    }
    const en = loadPage('/en/blog/topics/');
    expect(en.querySelector('h1')?.text).toBe('Topics');
    expect(en.querySelector('main .topic-grid a.topic')?.getAttribute('href')).toMatch(/^\/en\/blog\/category\//);
    expect(en.text).not.toMatch(/yazı|undefined/);
  });

  it('phone: "Konular" spans the row when no post is featured and there are no counts', () => {
    for (const d of [tr(), en()]) {
      const pair = d.querySelector('.blog-phone .topic-pair')!;
      expect(pair.classList.contains('single')).toBe(true);
      // The only tile is "Konular", a link to the topics page (no drop-down any more).
      expect(pair.querySelectorAll('a.tile')).toHaveLength(1);
      expect(pair.querySelector('details')).toBeNull();
      expect(d.querySelector('#popular')).toBeNull();
    }
    const topics = tr().querySelector('.blog-phone a.tile.topics')!;
    expect(topics.getAttribute('href')).toBe('/blog/konular/');
    expect(topics.text).toContain('Konular');
    expect(en().querySelector('.blog-phone a.tile.topics')?.getAttribute('href')).toBe('/en/blog/topics/');
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

  it('popular page: own title, description, canonical and hreflang pair; empty state without a list, noindex and out of the sitemap', () => {
    const pages = { tr: '/blog/populer/', en: '/en/blog/popular/' } as const;
    for (const lang of ['tr', 'en'] as const) {
      const d = loadPage(pages[lang]);
      expect(d.querySelector('h1')?.text).toBe(lang === 'tr' ? 'Popüler yazılar' : 'Popular posts');
      expect(d.querySelector('title')?.text).toMatch(lang === 'tr' ? /^Popüler yazılar \| / : /^Popular posts \| /);
      expect(d.querySelector('meta[name=description]')?.getAttribute('content')).toBe(
        lang === 'tr'
          ? 'Psikoloji ve daha iyi bir yaşam üzerine en çok okunan ve öne çıkan yazılar.'
          : 'The most read and featured posts on psychology and a better life.',
      );
      expect(d.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe(`https://example.com${pages[lang]}`);
      expect(d.querySelector('link[hreflang=tr]')?.getAttribute('href')).toBe('https://example.com/blog/populer/');
      expect(d.querySelector('link[hreflang=en]')?.getAttribute('href')).toBe('https://example.com/en/blog/popular/');
      expect(d.querySelector('a.lang-switch')?.getAttribute('href')).toBe(lang === 'tr' ? pages.en : pages.tr);
      // The fixtures feature no post: a note and a link to all posts, no empty list frame, kept out of search.
      expect(d.querySelector('main .popular-empty')?.text).toContain(lang === 'tr' ? 'Henüz öne çıkan bir yazı yok' : 'There are no featured posts yet');
      expect(d.querySelector('main .popular-empty a')?.getAttribute('href')).toBe(lang === 'tr' ? '/blog/' : '/en/blog/');
      expect(d.querySelector('main .post-rows, main .post-grid')).toBeNull();
      expect(d.querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex');
    }
    // Every noindex page (this one, the empty categories) is left out of the sitemap; the others stay.
    const sm = distText('sitemap-0.xml');
    expect(sm).not.toContain('https://example.com/blog/populer/');
    expect(sm).not.toContain('https://example.com/en/blog/popular/');
    expect(sm).not.toContain('https://example.com/blog/kategori/arastirma/');
    expect(sm).not.toContain('https://example.com/en/blog/category/research/');
    expect(sm).toContain('https://example.com/blog/kategori/zihinsel-saglik/');
    expect(sm).toContain('https://example.com/blog/');
    for (const p of allPages().filter((p) => p !== '/404.html')) {
      const noindex = loadPage(p).querySelector('meta[name=robots]')?.getAttribute('content')?.includes('noindex') ?? false;
      expect(sm.includes(`<loc>https://example.com${p}</loc>`), p).toBe(!noindex);
    }
    // With featured posts (the samples build) the page is indexed and listed.
    const samples = readFileSync(join('dist-test-samples', 'sitemap-0.xml'), 'utf8');
    const listed = loadPage('/blog/populer/', 'dist-test-samples').querySelectorAll('main .post-rows a').length > 0;
    expect(samples.includes('/blog/populer/</loc>')).toBe(listed);
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

describe('post page redesign (spec §5.8)', () => {
  const POST = '/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/';
  const EN_POST = '/en/blog/small-steps-towards-a-better-life/';

  it('byline is left-aligned: the author photo, name · title, without the membership', () => {
    const by = loadPage(POST).querySelector('.post-head .byline')!;
    expect(by.classList.contains('byline--left')).toBe(true);
    expect(by.querySelector('.byline-name')?.text.replace(/\s+/g, ' ').trim()).toBe('Osman Güneş Özkurt · Psikolog');
    expect(by.text).not.toContain('Türk Psikologlar');
    // The author's round photo in place of the sun (the sun only stands in without a photo).
    const img = by.querySelector('.portrait img')!;
    expect(img.getAttribute('width')).toBe('36');
    expect(img.getAttribute('alt')).toBe('');
    expect(by.querySelector('svg.sun-mark')).toBeNull();
    expect(by.querySelector('a.byline-author')?.text).toBe('Osman Güneş Özkurt');
    expect(loadPage(EN_POST).querySelector('.byline a.byline-author')?.getAttribute('href')).toBe('/en/about/');
    expect(loadPage(EN_POST).querySelector('.byline-name')?.text.replace(/\s+/g, ' ').trim()).toBe('Osman Güneş Özkurt · Psychologist');
  });

  it('meta line: date and reading time; no read count while there is no data', () => {
    const meta = loadPage(POST).querySelector('.byline .byline-meta')!;
    expect(meta.querySelector('time')?.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(meta.text).toMatch(/\d+ dk okuma/);
    expect(meta.text).not.toMatch(/okunma|null|undefined|NaN/);
    expect(meta.querySelector('.reads')).toBeNull();
    expect(loadPage(EN_POST).querySelector('.byline-meta')?.text).toMatch(/\d+ min read/);
    expect(loadPage(EN_POST).querySelector('.byline-meta')?.text).not.toMatch(/reads|null|undefined/);
  });

  it('16:9 cover keeps the .cover class and loads first, eager and high priority', () => {
    const img = loadPage(POST).querySelector('main img.cover')!;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(img.getAttribute('src')).toMatch(/^\/_astro\//);
  });

  it('Kaynakça is an accordion holding the references list, closed by default, above the share buttons', () => {
    const d = loadPage(POST);
    const acc = d.querySelector('section.references details.acc')!;
    expect(acc.hasAttribute('open')).toBe(false);
    expect(d.querySelector('section.references script')).toBeNull();
    const end = d.querySelector('.post-end')!.innerHTML;
    expect(end.indexOf('class="references"')).toBeLessThan(end.indexOf('data-share'));
    expect(acc.querySelector('summary')?.text).toContain('Kaynakça');
    expect(acc.querySelector('summary .subtitle')?.text.trim()).toBe('2 kaynak');
    expect(acc.querySelectorAll('ol.references-list li')).toHaveLength(2);
    expect(loadPage(EN_POST).querySelector('section.references summary .subtitle')?.text.trim()).toBe('2 references');
  });

  it('story image waits for the heading font with the title as sample text (latin-ext subset)', () => {
    const src = readFileSync('src/components/post/ShareButtons.astro', 'utf8');
    expect(src).toMatch(/fonts\.load\("500 96px 'Fraunces Variable'", box\.dataset\.title/);
  });

  it('share: Instagram story, copy link and WhatsApp side by side, with a live status region', () => {
    const squash = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    for (const [path, lang] of [[POST, 'tr'], [EN_POST, 'en']] as const) {
      const d = loadPage(path);
      const box = d.querySelector('.share[data-share]')!;
      expect(box.getAttribute('role')).toBe('group');
      expect(box.getAttribute('aria-label')).toBe(lang === 'tr' ? 'Yazıyı paylaş' : 'Share this post');
      const items = box.querySelectorAll('.share-row > li');
      expect(items.map((li) => squash(li.querySelector('.label')?.text))).toEqual(
        lang === 'tr'
          ? ['Instagram hikâyesinde paylaş', 'Bağlantıyı kopyala', "WhatsApp'ta paylaş"]
          : ['Share to Instagram story', 'Copy link', 'Share on WhatsApp'],
      );
      // The two script buttons wait (hidden) for the script; WhatsApp is a plain link.
      expect(items.slice(0, 2).every((li) => li.hasAttribute('hidden'))).toBe(true);
      expect(items[0].querySelector('button[type=button][data-share-story]')).toBeTruthy();
      expect(items[1].querySelector('button[type=button][data-share-copy]')).toBeTruthy();
      const wa = items[2].querySelector('a')!;
      const url = box.getAttribute('data-url')!;
      expect(url).toBe(`https://example.com${path}`);
      expect(wa.getAttribute('href')).toBe(`https://wa.me/?text=${encodeURIComponent(`${box.getAttribute('data-title')} ${url}`)}`);
      expect(wa.getAttribute('target')).toBe('_blank');
      expect(wa.getAttribute('rel')).toContain('noopener');
      expect(JSON.parse(box.getAttribute('data-texts')!)).toEqual(
        lang === 'tr'
          ? { copied: 'Kopyalandı', downloaded: "Görsel indirildi; Instagram'da hikâyene ekleyebilirsin." }
          : { copied: 'Copied', downloaded: 'Image downloaded; you can add it to your Instagram story.' },
      );
      expect(box.querySelector('[data-share-status][role=status][aria-live="polite"]')).toBeTruthy();
    }
  });

  it('post end: no second author line, then one Randevu Al after the share buttons', () => {
    for (const path of allPages().filter((p) => /^\/(en\/)?blog\/[^/]+\/$/.test(p) && !/\/(kategori|category)\//.test(p))) {
      const d = loadPage(path);
      if (!d.querySelector('article')) continue;
      expect(d.querySelector('a.author-line, .author-box'), path).toBeNull();
      const end = d.querySelector('.post-end')!;
      expect(end.querySelectorAll('a[href$="/randevu/"], a[href$="/appointment/"]'), path).toHaveLength(1);
      expect(end.innerHTML.indexOf('data-share')).toBeLessThan(end.innerHTML.indexOf('post-cta'));
    }
    expect(loadPage(POST).querySelector('.post-cta')?.text).toContain('Randevu Al');
  });

  it('similar posts: a reader invitation and up to two rows', () => {
    const rel = loadPage(POST).querySelector('.related')!;
    expect(rel.querySelector('h2')?.text).toBe('Bunları da okumanızı öneririm');
    expect(rel.querySelector('h2 + p.related-lead')?.text).toBe('Aynı konuda yazdığım birkaç yazı daha.');
    const rows = rel.querySelectorAll('a.list-item');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(2);
    expect(loadPage(EN_POST).querySelector('.related h2')?.text).toBe('You might also enjoy reading');
    expect(loadPage(EN_POST).querySelector('.related .related-lead')?.text).toBe('A few more posts on the same topic.');
  });

  it('prose: the drop-cap colour hook and the quote box use tokens', () => {
    const css = readFileSync('src/styles/prose.css', 'utf8');
    expect(css).toContain('var(--dropcap)');
    expect(css).toMatch(/\.prose blockquote\s*\{[^}]*border-left:[^;]*var\(--quote-rule\)[^}]*background:\s*var\(--surface\)/);
    expect(css).toMatch(/'SOFT' 50/);
  });
});
