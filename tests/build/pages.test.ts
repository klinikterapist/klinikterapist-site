import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { join } from 'node:path';
import { allPages, DIST, DIST_SAMPLES, distFile, loadPage } from './load';
import { ADMIN_CONFIG } from '../../src/admin/config';
import { CONTACT_TOPICS } from '../../src/lib/contact-form';

const STATIC_PAGES = [
  '/', '/hakkimda/', '/kaynaklar/', '/iletisim/', '/randevu/', '/aydinlatma-metni/', '/gizlilik/',
  '/en/', '/en/about/', '/en/resources/', '/en/contact/', '/en/appointment/',
  '/en/privacy-notice/', '/en/privacy-policy/', '/sik-sorulan-sorular/', '/en/faq/', '/404.html',
  '/blog/populer/', '/en/blog/popular/',
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

  it('FAQ pages list answered questions only, with FAQPage JSON-LD', () => {
    const tr = loadPage('/sik-sorulan-sorular/');
    expect(tr.querySelector('h1')?.text).toBe('Sık sorulan sorular');
    expect(tr.querySelectorAll('main details').length).toBe(3);
    expect(tr.querySelector('main details#ilk-gorusme')).not.toBeNull();
    expect(tr.textContent).not.toContain('Randevuyu iptal edebilir miyim?');
    const ld = tr.querySelectorAll('script[type="application/ld+json"]').map((s) => JSON.parse(s.text));
    const faq = ld.find((d) => d['@type'] === 'FAQPage');
    expect(faq.mainEntity).toHaveLength(3);
    const en = loadPage('/en/faq/');
    expect(en.querySelectorAll('main details').length).toBe(2);
    const enLd = en.querySelectorAll('script[type="application/ld+json"]').map((s) => JSON.parse(s.text));
    expect(enLd.find((d) => d['@type'] === 'FAQPage').mainEntity).toHaveLength(2);
  });

  it('home links to the free intro call page, which exists in both languages', () => {
    expect(loadPage('/').querySelector('a[href="/on-gorusme/"]')).not.toBeNull();
    expect(loadPage('/en/').querySelector('a[href="/en/intro-call/"]')).not.toBeNull();
    expect(loadPage('/on-gorusme/').querySelector('h1')?.text).toBe('Ücretsiz Ön Görüşme');
    expect(loadPage('/en/intro-call/').querySelector('h1')?.text).toBe('Free Intro Call');
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
    // English booking closed (booking.json intake): the button still leads to the page that says so.
    expect(loadPage('/en/').querySelector('#top-cta')?.getAttribute('href')).toBe('/en/appointment/');
    expect(loadPage('/en/appointment/').querySelector('.lead')?.text).toBe('Booking is closed at the moment. You can reach me by e-mail.');
    expect(loadPage('/randevu/').querySelector('.lead')?.text).toContain('çok yakında');
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

  it('contact page has the form, the channels and the emergency note', () => {
    const d = loadPage('/iletisim/');
    expect(d.querySelectorAll('main form')).toHaveLength(1);
    expect(d.textContent).toContain('112');
    expect(d.querySelector('main a[href="/randevu/"]')).not.toBeNull();
  });

  it('contact form: fields, fixed topics, consent linking the privacy notice, honeypot, appointment note', () => {
    const squash = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    for (const [path, lang] of [['/iletisim/', 'tr'], ['/en/contact/', 'en']] as const) {
      const d = loadPage(path);
      const form = d.querySelector('main form[data-contact-form]')!;
      expect(form, path).toBeTruthy();
      // Posts to the panel's Apps Script URL (the shared value, not a copy).
      expect(form.getAttribute('data-endpoint')).toBe(ADMIN_CONFIG.apiUrl);
      expect(form.getAttribute('data-lang')).toBe(lang);
      // POST, never GET: even a native submit (no script yet) cannot put personal data in a URL.
      expect(form.getAttribute('method')).toBe('post');
      expect(form.hasAttribute('action')).toBe(false);
      for (const name of ['name', 'email', 'topic', 'message', 'consent']) {
        const el = form.querySelector(`[name="${name}"]`)!;
        expect(el, `${path} ${name}`).toBeTruthy();
        expect(el.hasAttribute('required'), name).toBe(true);
        expect(form.querySelector(`label[for="${el.getAttribute('id')}"]`)?.text.trim(), name).toBeTruthy();
        expect(form.querySelector(`#${el.getAttribute('aria-describedby')}[data-error-for="${name}"]`), name).toBeTruthy();
      }
      expect(form.querySelector('[name=email]')?.getAttribute('type')).toBe('email');
      expect(form.querySelector('[name=name]')?.getAttribute('maxlength')).toBe('100');
      expect(form.querySelector('[name=message]')?.getAttribute('maxlength')).toBe('5000');
      const options = form.querySelectorAll('select[name=topic] option').filter((o) => o.getAttribute('value')).map((o) => o.text.trim());
      expect(options).toEqual(CONTACT_TOPICS.map((t) => t[lang]));
      const consent = form.querySelector('.consent label')!;
      expect(consent.querySelector('a')?.getAttribute('href')).toBe(lang === 'tr' ? '/aydinlatma-metni/' : '/en/privacy-notice/');
      const hp = form.querySelector('.hp')!;
      expect(hp.getAttribute('aria-hidden')).toBe('true');
      const trap = hp.querySelector('input[name=hp_field]')!;
      expect(trap.getAttribute('tabindex')).toBe('-1');
      expect(trap.getAttribute('autocomplete')).toBe('off');
      expect(form.querySelector('[name=website]')).toBeNull();
      expect(form.querySelector('[data-failure] a[href="mailto:iletisim@example.com"]')).toBeTruthy();
      expect(form.querySelector('[data-success]')?.hasAttribute('hidden')).toBe(true);
      // Disabled until the script runs (it enables it); the shown message gets focus, not a live region.
      expect(form.querySelector('button[type=submit]')?.hasAttribute('disabled')).toBe(true);
      expect(form.querySelector('.result')?.hasAttribute('aria-live')).toBe(false);
      expect(form.querySelector('.result')?.hasAttribute('role')).toBe(false);
      expect(d.querySelector('main .contact-form .note a')?.getAttribute('href')).toBe(lang === 'tr' ? '/randevu/' : '/en/appointment/');
    }
    expect(squash(loadPage('/iletisim/').querySelector('main .contact-form .note')?.text)).toBe(
      'Randevu ve seanslarla ilgili sorularınız için Randevu sayfasını kullanın.',
    );
    expect(squash(loadPage('/en/contact/').querySelector('main .contact-form .note')?.text)).toBe(
      'For questions about appointments and sessions, please use the Appointment page.',
    );
    expect(squash(loadPage('/iletisim/').querySelector('main .consent label')?.text)).toBe(
      'Aydınlatma metnini okudum.',
    );
    expect(squash(loadPage('/en/contact/').querySelector('main .consent label')?.text)).toBe(
      'I have read the privacy notice.',
    );
    // The direct e-mail row and the emergency box stay, below the form.
    const html = loadPage('/iletisim/').querySelector('main')!.innerHTML;
    expect(html.indexOf('data-contact-form')).toBeLessThan(html.lastIndexOf('href="mailto:iletisim@example.com"'));
    expect(html.lastIndexOf('href="mailto:iletisim@example.com"')).toBeGreaterThan(html.indexOf('</form>'));
    expect(html.indexOf('data-contact-form')).toBeLessThan(html.indexOf('emergency-box'));
  });

  it('contact page: the social accordion lists every social link in file order', () => {
    const links = JSON.parse(readFileSync('tests/fixtures/data/links.json', 'utf8')) as { label: string; icon: string }[];
    const names = loadPage('/iletisim/').querySelectorAll('details.social a.soc .soc-name').map((n) => n.text.trim());
    const social = links.filter((l) => l.icon !== 'email').map((l) => l.label);
    expect(names).toEqual(social);
    expect(social).toEqual(expect.arrayContaining(['TikTok', 'X (Twitter)', 'Threads']));
  });

  it('resources page has type anchors', () => {
    const d = loadPage('/kaynaklar/');
    expect(d.querySelector('a[href="#tur-book"]')).not.toBeNull();
    expect(d.querySelector('#tur-book')).not.toBeNull();
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
    const who = loadPage('/hakkimda/').querySelector('details.who .md')!;
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
  const NO_CTA = ['/randevum/', '/en/my-appointment/', '/randevu-al/', '/en/book/'];

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

  it.each(pages)('%s has one phone top bar, the desktop header, one page end and an always-on sticky CTA (none on the client page or while booking is closed)', (p) => {
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

    // The client's own page is for people already in therapy: no "Randevu Al" bar (checked below).
    if (NO_CTA.includes(p)) return;
    // English booking closed (booking.json intake): no bar, and the header's button is muted.
    if (lang === 'en') {
      expect(d.querySelector('.sticky-cta')).toBeNull();
      expect(d.querySelector('header.site-header a.book.is-closed')?.getAttribute('aria-label')).toBe('Book a Session: Bookings closed');
      return;
    }
    expect(d.querySelector('header.site-header a.btn.book')).toBeTruthy();
    const sticky = d.querySelectorAll('.sticky-cta');
    expect(sticky).toHaveLength(1);
    expect(sticky[0].getAttribute('data-mode')).toBe('always');
    expect(sticky[0].getAttribute('aria-hidden')).toBeUndefined();
    expect(sticky[0].querySelector('a')?.getAttribute('href')).toBe('/randevu/');
    expect(sticky[0].text).toContain('Randevu Al');
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

describe('inner pages redesign (spec §5.9)', () => {
  const fixture = (file: string) => JSON.parse(readFileSync(join('tests/fixtures/data', file), 'utf8'));
  const summaries = (path: string) =>
    loadPage(path).querySelectorAll('main details.acc > summary .title').map((t) => t.text.trim());
  const squash = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

  it('about: heading on top, then photo, name and title under it, membership line and lead', () => {
    const d = loadPage('/hakkimda/');
    // Owner's review 2026-10-19: the page title is first, centred at the top.
    expect(d.querySelector('main .about > header.about-top h1')?.text).toBe('Hakkımda');
    const head = d.querySelector('main .side-head')!;
    expect(head.querySelector('.portrait img')).toBeTruthy();
    // Owner's review 2026-10-19: the title on its own line under the name.
    expect(squash(head.querySelector('.who-line .who-name')?.text)).toBe('Osman Güneş Özkurt');
    expect(squash(head.querySelector('.who-line .who-role')?.text)).toBe('Psikolog');
    expect(squash(head.querySelector('.tpd')?.text)).toBe('Türk Psikologlar Derneği üyesi');
    expect(squash(head.querySelector('.lead')?.text)).toBe(fixture('about.json').lead.tr);
    expect(squash(loadPage('/en/about/').querySelector('.side-head .tpd')?.text)).toBe(
      'Member of the Turkish Psychological Association',
    );
  });

  it('about: desktop has a sticky side column (portrait, name, memberships, Randevu Al) beside the open CV sections', () => {
    for (const [path, appt] of [['/hakkimda/', '/randevu/'], ['/en/about/', '/en/appointment/']] as const) {
      const d = loadPage(path);
      const about = d.querySelector('main .about')!;
      const [top, side, main, cv] = about.childNodes.filter((n) => n.nodeType === 1) as unknown as HTMLElement[];
      expect(top.classList.contains('about-top'), path).toBe(true);
      expect(side.classList.contains('about-side'), path).toBe(true);
      expect(main.classList.contains('about-main'), path).toBe(true);
      expect(cv.classList.contains('about-cv'), path).toBe(true);
      // The CV: every section open (no accordions), a label beside its content.
      expect(cv.querySelectorAll('details')).toHaveLength(0);
      expect(cv.querySelectorAll('.cv-row > h2.cv-label').length, path).toBe(4);
      expect(cv.querySelector('.cv-areas li')).toBeTruthy();
      expect(cv.querySelectorAll('.timeline li')).toHaveLength(4);
      expect(cv.querySelector('blockquote')).toBeTruthy();
      expect(top.querySelector('h1')).toBeTruthy();
      expect(side.querySelector('.side-head .who-line')).toBeTruthy();
      expect(side.querySelector('.side-head .tpd')).toBeTruthy();
      expect(side.querySelector('a.side-cta')?.getAttribute('href')).toBe(appt);
      // Desktop: a large framed portrait (phones fetch nothing for it) in place of the small round one.
      const big = side.querySelector('picture.cv-photo')!;
      expect(big.querySelector('source')?.getAttribute('media')).toBe('(min-width: 768px)');
      expect(big.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\//);
      expect(side.querySelector('.portrait.phone-only img')).toBeTruthy();
      expect(main.querySelectorAll('details.acc').length).toBeGreaterThan(0);
      expect(main.querySelector('a.list-item[href$="/iletisim/"], a.list-item[href$="/contact/"]')).toBeTruthy();
    }
    const src = readFileSync('src/views/AboutView.astro', 'utf8');
    const desk = src.slice(src.indexOf('@media (min-width: 768px)'));
    expect(desk).toMatch(/\.about\s*\{[^}]*display:\s*grid/);
    // Sticky only on windows tall enough for the whole side column.
    expect(desk).toMatch(/@media \(min-height: 700px\)\s*\{\s*\.about-side\s*\{[^}]*position:\s*sticky/);
    expect(desk.replace(/@media \(min-height: 700px\)\s*\{\s*\.about-side\s*\{[^}]*\}/, '')).not.toMatch(/sticky/);
    expect(desk).toMatch(/\.side-cta\s*\{[^}]*display:\s*flex/);
    // Phones: the side button is hidden (the sticky booking bar does that job).
    expect(src.slice(0, src.indexOf('@media (min-width: 768px)'))).toMatch(/\.side-cta,\s*\.about-cv,\s*\.cv-photo\s*\{\s*display:\s*none/);
  });

  it('about: accordions in order, the first one open', () => {
    expect(summaries('/hakkimda/')).toEqual(['Ben kimim?', 'Bu işi neden yapıyorum?', 'Eğitim ve deneyim']);
    expect(summaries('/en/about/')).toEqual(['Who am I?', 'Why do I do this work?', 'Education and experience']);
    const accs = loadPage('/hakkimda/').querySelectorAll('main details.acc');
    expect(accs[0].hasAttribute('open')).toBe(true);
    expect(accs[1].hasAttribute('open')).toBe(false);
    expect(accs[2].querySelectorAll('.timeline li')).toHaveLength(4);
    // The quote stays (no content is lost).
    expect(loadPage('/hakkimda/').querySelector('main blockquote')?.text).toContain('kendi hikâyesinin uzmanıdır');
  });

  it('about: work areas as tile pairs, and a link to contact', () => {
    const d = loadPage('/hakkimda/');
    expect(d.querySelectorAll('main .areas .tile-pair')).toHaveLength(2);
    expect(d.querySelectorAll('main .areas .tile').map((t) => t.text.trim())).toEqual(
      fixture('about.json').areas.map((a: { label: { tr: string } }) => a.label.tr),
    );
    expect(d.querySelector('main .areas h2')?.text).toBe('Çalışma alanlarım');
    const contact = d.querySelector('main a.list-item[href="/iletisim/"]')!;
    expect(contact.text).toContain('Benimle iletişime geç');
  });

  it('resources: title, note, featured card', () => {
    const d = loadPage('/kaynaklar/');
    expect(d.querySelector('h1')?.text).toBe('Kaynaklar');
    expect(squash(d.querySelector('.page-head .lead')?.text)).toBe(fixture('resources.json').myNote.tr);
    const feat = d.querySelector('main a.featured-card')!;
    expect(feat.getAttribute('href')).toBe('https://example.com/beck-cbt');
    expect(feat.getAttribute('target')).toBe('_blank');
    expect(squash(feat.querySelector('.label')?.text)).toBe('ÖNE ÇIKAN · KİTAP');
    expect(feat.querySelector('.title')?.text).toBe('Cognitive Behavior Therapy: Basics and Beyond');
    expect(feat.text).toContain('Judith S. Beck');
    expect(squash(loadPage('/en/resources/').querySelector('a.featured-card .label')?.text)).toBe('FEATURED · BOOK');
  });

  it('resources: six type tiles; those with resources link to per-type accordions with those ids', () => {
    const d = loadPage('/kaynaklar/');
    const all = d.querySelectorAll('main .type-tiles > li');
    expect(all.map((li) => li.text.trim())).toEqual(['Kitaplar', 'Makaleler', 'Ölçekler', 'Videolar', 'Podcastler', 'Rehberler']);
    expect(loadPage('/en/resources/').querySelectorAll('main .type-tiles > li').map((li) => li.text.trim())).toEqual([
      'Books', 'Articles', 'Scales', 'Videos', 'Podcasts', 'Guides',
    ]);
    // A type without resources is a muted tile, not a link (no dead anchor, no count).
    const empty = all.filter((li) => !li.querySelector('a'));
    expect(empty.map((li) => li.text.trim())).toEqual(['Videolar', 'Podcastler']);
    for (const li of empty) expect(li.querySelector('.tile-empty'), li.text).toBeTruthy();
    const tiles = d.querySelectorAll('main .type-tiles a');
    const present = ['book', 'article', 'scale', 'guide'];
    expect(tiles.map((a) => a.getAttribute('href'))).toEqual(present.map((t) => `#tur-${t}`));
    expect(tiles.map((a) => a.text.trim())).toEqual(['Kitaplar', 'Makaleler', 'Ölçekler', 'Rehberler']);
    for (const type of present) {
      const acc = d.querySelector(`details.acc#tur-${type}`)!;
      expect(acc, type).toBeTruthy();
      expect(acc.querySelectorAll('a.res').length, type).toBeGreaterThan(0);
    }
    expect(d.querySelector('#tur-book summary .subtitle')?.text.trim()).toBe('1 kaynak');
    expect(d.querySelector('#tur-book a.res')?.getAttribute('href')).toBe('https://example.com/beck-cbt');
    expect(d.querySelector('#tur-video')).toBeNull();
    expect(d.querySelector('details#tur-book')?.hasAttribute('open')).toBe(true);
    expect(loadPage('/en/resources/').querySelector('#tur-book summary .subtitle')?.text.trim()).toBe('1 resource');
  });

  it('contact: photo or sun, heading, intro and e-mail row', () => {
    const d = loadPage('/iletisim/');
    expect(d.querySelector('main .page-head .portrait')).toBeTruthy();
    expect(d.querySelector('main .page-head h1')?.text).toBe('İletişim');
    expect(squash(d.querySelector('main .page-head .lead')?.text)).toBe(fixture('contact.json').intro.tr);
    // The form is the page's main content; appointment questions go to the Randevu page via its note.
    expect(d.querySelector('main a.big-cta')).toBeNull();
    const mail = d.querySelector('main a.list-item[href="mailto:iletisim@example.com"]')!;
    expect(mail.querySelector('.title')?.text).toBe('E-posta gönder');
    expect(mail.querySelector('.subtitle')?.text).toBe('iletisim@example.com');
  });

  it('contact: "Online görüşme" / "Dönüş süresi" pair, social accordion, membership', () => {
    const d = loadPage('/iletisim/');
    const tiles = d.querySelectorAll('main .facts .tile');
    expect(tiles.map((t) => t.querySelector('.title')?.text)).toEqual(['Online görüşme', 'Dönüş süresi']);
    expect(tiles[0].querySelector('.subtitle')?.text).toBe(fixture('contact.json').workStyle.tr);
    expect(tiles[1].querySelector('.subtitle')?.text).toBe('24–48 saat.');
    expect(d.querySelector('main details.social summary')?.text).toContain('Sosyal medyada takip et');
    expect(squash(d.querySelector('main .membership .title')?.text)).toBe('Türk Psikologlar Derneği üyesi');
    const en = loadPage('/en/contact/');
    expect(en.querySelectorAll('main .facts .tile .title').map((t) => t.text)).toEqual(['Online sessions', 'Response time']);
    expect(en.querySelectorAll('main .facts .tile .subtitle')[1].text).toBe('24–48 hours.');
  });

  it('contact: emergency note in a dashed, token-coloured box', () => {
    for (const [path, lang] of [['/iletisim/', 'tr'], ['/en/contact/', 'en']] as const) {
      const box = loadPage(path).querySelector('main .emergency-box')!;
      expect(squash(box.text), path).toBe(fixture('contact.json').emergencyNote[lang]);
    }
    const src = readFileSync('src/views/ContactView.astro', 'utf8');
    expect(src).toMatch(/\.emergency-box\s*\{[^}]*border:\s*1px dashed var\(--line\)[^}]*background:\s*var\(--surface\)/);
    expect(src).not.toMatch(/#f3e3dc|#6b2f1f/i);
  });

  it('appointment, legal and 404 keep their content in the new look', () => {
    const appt = loadPage('/randevu/');
    expect(appt.querySelector('main .page-head h1')?.text).toBe('Randevu Al');
    expect(appt.querySelector('main a.list-item[href^="mailto:"]')).toBeTruthy();
    expect(loadPage('/gizlilik/').querySelector('main article.legal.legal-page')).toBeTruthy();
    const nf = loadPage('/404.html');
    expect(nf.querySelector('main .not-found svg.sun-mark')).toBeTruthy();
    expect(nf.querySelector('main a.list-item[href="/"]')).toBeTruthy();
    expect(nf.querySelector('main a[href="/en/"]')).toBeTruthy();
  });

  it("the client's own page: both languages, noindex, out of the sitemap, no page counter, no booking bar, no personal data", () => {
    const sm = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    for (const [path, title] of [['/randevum/', 'Randevularım'], ['/en/my-appointment/', 'My appointments']] as const) {
      const d = loadPage(path);
      expect(d.querySelector('h1')?.text).toBe(title);
      expect(d.querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex');
      expect(sm).not.toContain(path);
      expect(d.toString()).not.toContain('stats.hit');
      expect(d.querySelector('.sticky-cta')).toBeNull();
      const root = d.querySelector('[data-tracking]')!;
      expect(root.hasAttribute('data-demo')).toBe(false);
      expect(JSON.parse(root.getAttribute('data-messages')!).failures.link).toBeTruthy();
    }
  });

  it('the booking start page: three ways (intro call recommended), the info form, out of search until booking is live', () => {
    const sm = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    for (const [path, intro, appt] of [['/randevu-al/', '/on-gorusme/#pc-form', '/randevu/'], ['/en/book/', '/en/intro-call/#pc-form', '/en/appointment/']] as const) {
      const d = loadPage(path);
      expect(d.querySelectorAll('main .way').length, path).toBe(3);
      expect(d.querySelector('main .way.is-recommended a')?.getAttribute('href'), path).toBe(intro);
      expect(d.querySelector(`main .way a[href="${appt}"]`), path).not.toBeNull();
      const form = d.querySelector('main form[data-info]')!;
      expect(form.querySelectorAll('input[name="info-topic"]').length, path).toBeGreaterThan(3);
      expect(form.querySelector('input[name="info-email2"]'), path).not.toBeNull();
      expect(form.querySelector('input[name="info-consent"]'), path).not.toBeNull();
      // No fee amount in the answers offered.
      expect(d.textContent, path).not.toMatch(/\d+\s*(TL|₺|€|\$)/);
      expect(d.querySelector('meta[name=robots]')?.getAttribute('content'), path).toBe('noindex');
      expect(sm).not.toContain(path);
      expect(d.querySelector('.sticky-cta'), path).toBeNull();
    }
    // Until the forms are live, "Randevu Al" still goes to the booking page and the intro button stays on the home page.
    expect(loadPage('/').querySelector('#top-cta')?.getAttribute('href')).toBe('/randevu/');
    expect(loadPage('/').querySelector('a.pre-cta')).not.toBeNull();
  });

  it('the client’s own page and the booking pages load no Google Analytics, even where the site has it (real data build)', () => {
    const home = loadPage('/', DIST_SAMPLES).toString();
    expect(home).toContain('googletagmanager');
    for (const path of ['/randevum/', '/en/my-appointment/', '/randevu-al/', '/en/book/', '/randevu/', '/en/appointment/', '/on-gorusme/', '/en/intro-call/']) {
      const d = loadPage(path, DIST_SAMPLES);
      expect(d.toString(), path).not.toContain('googletagmanager');
      expect(d.querySelector('[data-consent-bar]'), path).toBeNull();
    }
    // The site's own cookieless counter stays on the booking pages, as on the home page.
    expect(loadPage('/randevu/', DIST_SAMPLES).toString().includes('stats.hit')).toBe(home.includes('stats.hit'));
  });
});

/**
 * The real posts and data, built as they are (see `test:build`). The owner edits and deletes the samples in the
 * panel, so these are structural checks derived from the content itself: no fixed counts, no fixed texts.
 */
describe('sample content (real posts and data)', () => {
  const sample = (path: string) => loadPage(path, DIST_SAMPLES);

  it('the production-like build has no UI-kit fixture pages (UI_KIT is only set for the fixture build)', () => {
    expect(existsSync(join(DIST_SAMPLES, 'ui-kit'))).toBe(false);
    expect(existsSync(join(DIST, 'ui-kit'))).toBe(true);
  });
  type Meta = { slug: string; featured: boolean; cover: boolean; at: number };
  const metas = (lang: 'tr' | 'en'): Meta[] =>
    readdirSync('src/content/posts')
      .filter((k) => existsSync(join('src/content/posts', k, `${lang}.md`)))
      .map((k) => {
        const raw = readFileSync(join('src/content/posts', k, `${lang}.md`), 'utf8').replace(/\r\n/g, '\n');
        const fm = parseYaml(/^---\n([\s\S]*?)\n---/.exec(raw)![1]);
        return { slug: fm.slug as string, featured: fm.featured === true, cover: Boolean(fm.cover), at: new Date(fm.publishedAt).getTime() };
      });
  const prefix = { tr: '/blog/', en: '/en/blog/' } as const;
  const hrefs = (lang: 'tr' | 'en', pick: (m: Meta) => boolean = () => true) =>
    metas(lang).filter(pick).map((m) => `${prefix[lang]}${m.slug}/`).sort();
  const postLinks = (path: string, lang: 'tr' | 'en') => {
    const re = new RegExp(`^${prefix[lang]}[a-z0-9-]+/$`);
    return [...new Set(sample(path).querySelectorAll('main a').map((a) => a.getAttribute('href') ?? '').filter((h) => re.test(h) && !/\/(kategori|category)\//.test(h) && !/^\/(en\/)?blog\/(populer|popular|konular|topics)\/$/.test(h)))].sort();
  };

  it('the blog list links every post that exists, in each language', () => {
    expect(postLinks('/blog/', 'tr')).toEqual(hrefs('tr'));
    expect(postLinks('/en/blog/', 'en')).toEqual(hrefs('en'));
  });

  // pickPopular: featured posts, newest first, at most four on the blog page and twelve on the popular
  // page (read counts are stubbed to none).
  const popular = (lang: 'tr' | 'en', n = 4) =>
    metas(lang).filter((m) => m.featured).sort((x, y) => y.at - x.at).slice(0, n).map((m) => `${prefix[lang]}${m.slug}/`).sort();
  const popularPage = { tr: '/blog/populer/', en: '/en/blog/popular/' } as const;

  it('the popular tiles open the popular page, #popular follows the featured posts, all absent when none is featured', () => {
    for (const [path, lang] of [['/', 'tr'], ['/en/', 'en']] as const) {
      const tile = sample(path).querySelectorAll('.home-phone .tile-pair a.tile').filter((a) => a.getAttribute('href') === popularPage[lang]);
      expect(tile.length > 0, path).toBe(popular(lang).length > 0);
    }
    for (const [path, lang] of [['/blog/', 'tr'], ['/en/blog/', 'en']] as const) {
      const listed = sample(path).querySelectorAll('section#popular a.list-item').map((a) => a.getAttribute('href') ?? '').sort();
      expect(listed, path).toEqual(popular(lang));
      const more = sample(path).querySelector('section#popular a.more');
      if (listed.length > 0) expect(more?.getAttribute('href'), path).toBe(popularPage[lang]);
      expect(sample(path).querySelectorAll('.blog-phone .topic-pair a.tile').length > 0, path).toBe(listed.length > 0);
      const chips = sample(path).querySelectorAll('.blog-filters nav.category-nav a').map((a) => a.getAttribute('href'));
      expect(chips.includes(popularPage[lang]), path).toBe(listed.length > 0);
      expect(chips, path).not.toContain('#popular');
    }
  });

  it('the popular page lists the popular set, or a short note and a link to all posts', () => {
    for (const lang of ['tr', 'en'] as const) {
      const d = sample(popularPage[lang]);
      const expected = popular(lang, 12);
      const rows = d.querySelectorAll('main .post-rows a.list-item').map((a) => a.getAttribute('href') ?? '').sort();
      expect(rows, lang).toEqual(expected);
      if (expected.length === 0) {
        expect(d.querySelector('main .popular-empty a')?.getAttribute('href')).toBe(prefix[lang]);
        expect(d.querySelector('main .post-rows, main .post-grid')).toBeNull();
      } else {
        expect(d.querySelector('main .popular-empty')).toBeNull();
      }
    }
  });

  it('a post with a cover renders it (optimised) and a post without one renders none', () => {
    for (const [path, lang] of [['/blog/', 'tr'], ['/en/blog/', 'en']] as const) {
      const d = sample(path);
      const imgs = d.querySelectorAll('img.cover, img.featured-cover, img.newest-cover, img.thumb').filter((i) => /^\/_astro\/.+\.webp/.test(i.getAttribute('src') ?? ''));
      // Each post's own page carries its cover when it has one, and no optimised image when not.
      for (const m of metas(lang)) {
        const post = sample(`${prefix[lang]}${m.slug}/`);
        const covers = post.querySelectorAll('figure.cover-wrap img').filter((i) => /^\/_astro\/.+\.webp/.test(i.getAttribute('src') ?? ''));
        expect(covers.length > 0, `${prefix[lang]}${m.slug}/`).toBe(m.cover);
        for (const i of covers) expect(i.hasAttribute('alt'), `${prefix[lang]}${m.slug}/`).toBe(true);
      }
      // The list shows optimised covers exactly when some post has one.
      expect(imgs.length > 0, path).toBe(metas(lang).some((m) => m.cover));
    }
  });

  it('every FAQ item shown has an answer, and the pages agree with the home accordion', () => {
    for (const [faq, home] of [['/sik-sorulan-sorular/', '/'], ['/en/faq/', '/en/']] as const) {
      const items = sample(faq).querySelectorAll('main details');
      for (const it of items) expect(it.text.trim().length).toBeGreaterThan(0);
      expect(sample(home).querySelectorAll('.home-phone details.faq details.faq-item')).toHaveLength(items.length);
      const ld = sample(faq).querySelectorAll('script[type="application/ld+json"]').map((s) => JSON.parse(s.text)).find((d) => d['@type'] === 'FAQPage');
      if (items.length > 0) expect(ld.mainEntity).toHaveLength(items.length);
    }
  });

  it('empty fields render nothing: no "undefined" or "null" artefacts on the sample pages', () => {
    for (const path of ['/', '/en/', '/blog/', '/en/blog/', '/sik-sorulan-sorular/', '/en/faq/']) {
      const d = sample(path);
      d.querySelectorAll('script, style').forEach((n) => n.remove());
      // Rendered artefacts only: an attribute or a whole text node that is literally undefined/null, never prose.
      expect(d.toString(), path).not.toMatch(/="(undefined|null)"|>\s*(undefined|null)\s*</);
    }
  });
});
