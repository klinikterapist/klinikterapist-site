import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allPages, DIST, distFile, loadPage } from './load';

const STATIC_PAGES = [
  '/', '/hakkimda/', '/kaynaklar/', '/iletisim/', '/randevu/', '/aydinlatma-metni/', '/gizlilik/',
  '/en/', '/en/about/', '/en/resources/', '/en/contact/', '/en/appointment/',
  '/en/privacy-notice/', '/en/privacy-policy/', '/404.html',
];

describe('static pages', () => {
  it('builds every static page in both languages', () => {
    const pages = allPages();
    for (const p of STATIC_PAGES) expect(pages).toContain(p);
  });

  it('every page has one h1, title, description, canonical, alt texts and no location wording', () => {
    for (const p of allPages()) {
      const d = loadPage(p);
      expect(d.querySelectorAll('h1').length, p).toBe(1);
      expect(d.querySelector('title')?.text.length, p).toBeGreaterThan(0);
      expect(d.querySelector('meta[name=description]')?.getAttribute('content'), p).toBeTruthy();
      expect(d.querySelector('link[rel=canonical]')?.getAttribute('href'), p).toMatch(/^https:\/\//);
      // node-html-parser has no reliable :not([alt]); filter by hand.
      expect(d.querySelectorAll('img').filter((i) => !i.hasAttribute('alt')).length, p).toBe(0);
      expect(d.textContent, p).not.toMatch(/Lefkoşa|İstanbul|yüz yüze|NFC/i);
    }
  });

  it('sets the document language', () => {
    expect(loadPage('/').querySelector('html')?.getAttribute('lang')).toBe('tr');
    expect(loadPage('/en/').querySelector('html')?.getAttribute('lang')).toBe('en');
  });

  it('home head links the sun favicons and the apple touch icon', () => {
    const head = loadPage('/').querySelector('head')!;
    expect(head.querySelector('link[rel=icon][type="image/svg+xml"]')?.getAttribute('href')).toBe('/favicon.svg');
    expect(head.querySelector('link[rel=icon][sizes="32x32"]')?.getAttribute('href')).toBe('/favicon.ico');
    expect(head.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href')).toBe('/apple-touch-icon.png');
  });

  it('home has one top booking CTA', () => {
    expect(loadPage('/').querySelectorAll('#top-cta').length).toBe(1);
    expect(loadPage('/').querySelector('#top-cta')?.getAttribute('href')).toBe('/randevu/');
    expect(loadPage('/en/').querySelector('#top-cta')?.getAttribute('href')).toBe('/en/appointment/');
  });

  it('home has the hreflang trio and Person + ProfessionalService JSON-LD', () => {
    const home = loadPage('/');
    expect(home.querySelector('link[hreflang=en]')?.getAttribute('href')).toBe('https://example.com/en/');
    expect(home.querySelector('link[hreflang=x-default]')).not.toBeNull();
    const types = home
      .querySelectorAll('script[type="application/ld+json"]')
      .map((s) => JSON.parse(s.text)['@type']);
    expect(types).toEqual(expect.arrayContaining(['Person', 'ProfessionalService']));
  });

  it('home lists the visible cards except blog and contact, the blog card as a tile, and the newest posts', () => {
    const home = loadPage('/');
    const items = home.querySelectorAll('.home-phone .cards a.list-item');
    expect(items.map((c) => c.getAttribute('href'))).toEqual(['/hakkimda/', '/kaynaklar/']);
    expect(items.some((c) => /Medium|Substack/.test(c.text))).toBe(false);
    expect(home.querySelector('.home-phone .tile-pair a.tile')?.text).toContain('Blog Yazıları');
    expect(home.querySelectorAll('.post-card').length).toBeGreaterThan(0);
  });

  it('appointment page explains booking is coming soon and offers e-mail', () => {
    const tr = loadPage('/randevu/');
    expect(tr.querySelector('h1')?.text).toBe('Randevu Al');
    expect(tr.textContent).toContain('Online randevu sistemi çok yakında burada. Şimdilik e-posta ile ulaşabilirsiniz.');
    expect(tr.querySelector('main a[href^="mailto:"]')?.getAttribute('href')).toBe('mailto:iletisim@example.com');
    expect(tr.querySelector('main a[href="/iletisim/"]')).not.toBeNull();
    const en = loadPage('/en/appointment/');
    expect(en.querySelector('main a[href^="mailto:"]')).not.toBeNull();
    expect(en.querySelector('main a[href="/en/contact/"]')).not.toBeNull();
  });

  it('contact page has channels and the emergency note but no form', () => {
    const d = loadPage('/iletisim/');
    expect(d.querySelector('form')).toBeNull();
    expect(d.textContent).toContain('112');
    expect(d.querySelector('main a[href="/randevu/"]')).not.toBeNull();
  });

  it('contact page lists e-mail, every social link in file order, then Randevu', () => {
    const links = JSON.parse(readFileSync('tests/fixtures/data/links.json', 'utf8')) as { label: string; icon: string }[];
    const titles = loadPage('/iletisim/').querySelectorAll('ul.channels li').map((li) => li.querySelector('.title')?.text.trim() ?? '');
    const social = links.filter((l) => l.icon !== 'email').map((l) => l.label);
    expect(titles.length).toBe(social.length + 2);
    expect(titles.slice(1, -1)).toEqual(social);
    expect(social).toEqual(expect.arrayContaining(['TikTok', 'X (Twitter)', 'Threads']));
  });

  it('resources page has type filter anchors and the owner note', () => {
    const d = loadPage('/kaynaklar/');
    expect(d.querySelector('a[href="#book"]')).not.toBeNull();
    expect(d.querySelector('#book')).not.toBeNull();
    expect(d.textContent).toContain('Benim Notum');
  });

  it('legal pages render their markdown', () => {
    expect(loadPage('/aydinlatma-metni/').querySelector('h1')?.text).toBe('Aydınlatma Metni');
    expect(loadPage('/en/privacy-policy/').querySelector('h1')?.text).toBe('Privacy Policy');
  });

  it('404 links to both home pages', () => {
    expect(existsSync(distFile('/404.html'))).toBe(true);
    const d = loadPage('/404.html');
    expect(d.querySelector('main a[href="/"]')).not.toBeNull();
    expect(d.querySelector('main a[href="/en/"]')).not.toBeNull();
  });
});

describe('final-review fixes', () => {
  const fixture = (file: string) => JSON.parse(readFileSync(join('tests/fixtures/data', file), 'utf8'));

  it('about texts are rendered as Markdown, with raw HTML escaped (I3)', () => {
    const who = loadPage('/hakkimda/').querySelector('.who-text .md')!;
    expect(who.querySelectorAll('p')).toHaveLength(2);
    expect(who.querySelector('strong')?.text).toBe('Osman Güneş Özkurt');
    expect(who.querySelector('em')?.text).toBe('bilimsel temelli');
    expect(who.querySelector('a[href="/blog/"]')).not.toBeNull();
    expect(who.querySelector('script')).toBeNull();
    expect(who.text).toContain('<script>alert(1)</script>');
  });

  it('EN about shows the localized timeline period (M1)', () => {
    const en = loadPage('/en/about/');
    expect(en.textContent).not.toContain('Devam ediyor');
    expect(en.querySelectorAll('.period').map((p) => p.text)).toContain('Ongoing');
    expect(loadPage('/hakkimda/').querySelectorAll('.period').map((p) => p.text)).toContain('Devam ediyor');
  });

  it('footer e-mail link is labelled in the page language (M1)', () => {
    expect(loadPage('/en/').querySelector('.social a[href^="mailto:"]')?.getAttribute('aria-label')).toBe('E-mail');
    expect(loadPage('/').querySelector('.social a[href^="mailto:"]')?.getAttribute('aria-label')).toBe('E-posta');
  });

  it('resources owner note comes from resources.json (myNote)', () => {
    const { myNote } = fixture('resources.json');
    expect(loadPage('/kaynaklar/').textContent).toContain(myNote.tr);
    expect(loadPage('/en/resources/').textContent).toContain(myNote.en);
  });

  it('Blog nav item is aria-current="page" only on the blog page itself (M6)', () => {
    const navBlog = (path: string, href: string) =>
      loadPage(path).querySelectorAll(`.site-header a[href="${href}"]`).map((a) => a.getAttribute('aria-current'));
    expect(navBlog('/blog/', '/blog/')).toEqual(['page']);
    expect(navBlog('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/', '/blog/')).toEqual(['true']);
    expect(navBlog('/en/blog/category/mental-health/', '/en/blog/')).toEqual(['true']);
  });
});

describe('page shell (every page but home)', () => {
  const pages = allPages().filter((p) => p !== '/' && p !== '/en/');
  const isPost = (p: string) => /^\/(en\/)?blog\/[^/]+\/$/.test(p);
  const langOf = (p: string) => (p.startsWith('/en/') ? 'en' : 'tr');

  /** All CSS a built page loads: its stylesheet links and inline <style> blocks. */
  const pageCss = (p: string) => {
    const d = loadPage(p);
    const linked = d
      .querySelectorAll('link[rel=stylesheet]')
      .map((l) => readFileSync(join(DIST, l.getAttribute('href')!.replace(/^\//, '')), 'utf8'));
    return [...linked, ...d.querySelectorAll('style').map((s) => s.text)].join('\n');
  };

  it('covers the static pages, the blog list, categories and posts', () => {
    expect(pages).toEqual(expect.arrayContaining(['/hakkimda/', '/404.html', '/blog/', '/en/blog/category/therapy/']));
    expect(pages.filter(isPost).length).toBeGreaterThan(0);
  });

  it.each(pages)('%s has one phone top bar, the desktop header, one page end and an always-on sticky CTA', (p) => {
    const d = loadPage(p);
    const lang = langOf(p);
    const bars = d.querySelectorAll('.page-top .top-bar');
    expect(bars).toHaveLength(1);
    expect(d.querySelectorAll('.top-bar')).toHaveLength(1);
    // The phone top bar comes before the main content, after the skip link.
    const all = d.querySelectorAll('*');
    expect(all.indexOf(d.querySelector('.page-top')!)).toBeLessThan(all.indexOf(d.querySelector('main#main')!));
    expect(bars[0].querySelector('button.theme-chip')).toBeTruthy();
    expect(bars[0].querySelector('a.lang-switch')).toBeTruthy();
    if (!isPost(p)) {
      const logo = bars[0].querySelector('a.logo')!;
      expect(logo.getAttribute('href')).toBe(lang === 'en' ? '/en/' : '/');
      expect(logo.querySelector('svg')).toBeTruthy();
      expect(bars[0].querySelector('a.back')).toBeNull();
    }

    expect(d.querySelectorAll('header.site-header')).toHaveLength(1);

    expect(d.querySelectorAll('.page-end')).toHaveLength(1);
    expect(d.querySelector('.page-end b')?.text).toBe('112');

    const sticky = d.querySelectorAll('.sticky-cta');
    expect(sticky).toHaveLength(1);
    expect(sticky[0].getAttribute('data-mode')).toBe('always');
    expect(sticky[0].getAttribute('aria-hidden')).toBeUndefined();
    expect(sticky[0].querySelector('a')?.getAttribute('href')).toBe(lang === 'en' ? '/en/appointment/' : '/randevu/');
    expect(sticky[0].text).toContain(lang === 'en' ? 'Book a Session' : 'Randevu Al');
  });

  it.each(pages.filter(isPost))('post %s shows "← Blog" instead of the logo', (p) => {
    const bar = loadPage(p).querySelector('.page-top .top-bar')!;
    expect(bar.querySelector('a.logo')).toBeNull();
    const back = bar.querySelector('a.back')!;
    expect(back.getAttribute('href')).toBe(langOf(p) === 'en' ? '/en/blog/' : '/blog/');
    expect(back.text.trim()).toBe('Blog');
    expect(back.querySelector('svg')).toBeTruthy(); // the "←" arrow
  });

  it('the phone top bar hides from 768 px and the breadcrumb shows only from 768 px', () => {
    const css = pageCss('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
    expect(css).toMatch(/@media \(width>=768px\)\{[^@]*\.page-top\[data-astro-cid-\w+\]\{display:none\}/);
    expect(css).toMatch(/@media \(width<=767px\)\{[^@]*\.breadcrumb\[data-astro-cid-\w+\]\{display:none\}/);
  });
});
