import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allPages, distFile, loadPage } from './load';

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

  it('home has one dominant booking CTA', () => {
    expect(loadPage('/').querySelector('a.cta-primary')?.getAttribute('href')).toBe('/randevu/');
    expect(loadPage('/').querySelectorAll('a.cta-primary').length).toBe(1);
    expect(loadPage('/en/').querySelector('a.cta-primary')?.getAttribute('href')).toBe('/en/appointment/');
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

  it('home shows the visible cards, not Medium/Substack as cards, and the newest posts', () => {
    const home = loadPage('/');
    const cards = home.querySelectorAll('.link-card');
    expect(cards.map((c) => c.getAttribute('href'))).toEqual(['/hakkimda/', '/blog/', '/kaynaklar/', '/iletisim/']);
    expect(home.querySelectorAll('.link-card').some((c) => /Medium|Substack/.test(c.text))).toBe(false);
    expect(home.querySelectorAll('.post-card').length).toBeGreaterThan(0);
    expect(home.querySelector('a[href="/blog/"]')).not.toBeNull();
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
    expect(navBlog('/blog/', '/blog/')).toEqual(['page', 'page']);
    expect(navBlog('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/', '/blog/')).toEqual(['true', 'true']);
    expect(navBlog('/en/blog/category/mental-health/', '/en/blog/')).toEqual(['true', 'true']);
  });
});
