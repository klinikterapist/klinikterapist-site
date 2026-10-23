import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { join } from 'node:path';
import { allPages, DIST, DIST_SAMPLES, distFile, loadPage } from './load';
import { ADMIN_CONFIG } from '../../src/admin/config';
import { CONTACT_TOPICS } from '../../src/lib/contact-form';

const STATIC_PAGES = [
  '/',
  '/hakkimda/',
  '/kaynaklar/',
  '/iletisim/',
  '/seans-randevusu/',
  '/aydinlatma-metni/',
  '/gizlilik/',
  '/en/',
  '/en/about/',
  '/en/resources/',
  '/en/contact/',
  '/en/appointment/',
  '/en/privacy-notice/',
  '/en/privacy-policy/',
  '/sik-sorulan-sorular/',
  '/en/faq/',
  '/404.html',
  '/blog/populer/',
  '/en/blog/popular/',
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
      expect(d.textContent, p).not.toMatch(/Lefkoşa|İstanbul|NFC/i);
      // The booking forms name face-to-face therapy only as "not available now" (owner's design); no other page mentions it.
      if (!['/seans-randevusu/', '/on-gorusme/'].includes(p)) expect(d.textContent, p).not.toMatch(/yüz yüze/i);
    }
  });

  it('FAQ pages list answered questions only, with FAQPage JSON-LD', () => {
    const tr = loadPage('/sik-sorulan-sorular/');
    expect(tr.querySelector('h1')?.text).toBe('Sık Sorulan Sorular');
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

  it('the free intro call is offered on the start page and exists in both languages', () => {
    expect(loadPage('/randevu-al/').querySelector('a[href="/on-gorusme/"]')).not.toBeNull();
    expect(loadPage('/en/book/').querySelector('a[href="/en/intro-call/"]')).not.toBeNull();
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
    expect(loadPage('/').querySelector('#top-cta')?.getAttribute('href')).toBe('/randevu-al/');
    // English booking closed (booking.json intake): the button leads straight to the page that says so.
    expect(loadPage('/en/').querySelector('#top-cta')?.getAttribute('href')).toBe('/en/appointment/');
    expect(loadPage('/en/appointment/').querySelector('meta[name=description]')?.getAttribute('content')).toBe('Booking is closed at the moment. You can reach me by e-mail.');
  });

  it.each(['/on-gorusme/', '/en/intro-call/'])('%s marks its questions as FAQPage, the same ones the page shows', (p) => {
    const d = loadPage(p);
    const ld = d
      .querySelectorAll('script[type="application/ld+json"]')
      .map((s) => JSON.parse(s.text))
      .find((x) => x['@type'] === 'FAQPage');
    const shown = d.querySelectorAll('.pc-faq summary').map((s) => s.text.trim());
    expect(shown.length).toBeGreaterThan(0);
    expect(ld.mainEntity.map((q: { name: string }) => q.name)).toEqual(shown);
    expect(ld.mainEntity[0].acceptedAnswer.text.length).toBeGreaterThan(40);
  });

  it('home has the hreflang trio and Person + ProfessionalService JSON-LD', () => {
    const home = loadPage('/');
    expect(home.querySelector('link[hreflang=en]')?.getAttribute('href')).toBe('https://example.com/en/');
    expect(home.querySelector('link[hreflang=x-default]')).not.toBeNull();
    const types = home.querySelectorAll('script[type="application/ld+json"]').map((s) => JSON.parse(s.text)['@type']);
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

  it('booking pages hold the live form, with e-mail as the fallback and "Haber et" for a closed language', () => {
    const tr = loadPage('/seans-randevusu/');
    expect(tr.querySelector('h1')?.text).toBe('Seans Randevusu Al');
    expect(tr.querySelector('main [data-booking][data-lang="tr"]')).not.toBeNull();
    expect(tr.querySelector('main a[href="mailto:iletisim@example.com"]')).not.toBeNull();
    const en = loadPage('/en/appointment/');
    // English is closed in booking.json: the page's script opens on "Haber et" (booking-submit.ts).
    expect(JSON.parse(en.querySelector('main [data-booking]')!.getAttribute('data-config')!).intake ?? { en: false }).toMatchObject({ en: false });
    expect(en.querySelector('main [data-closed]')).not.toBeNull();
  });

  it('session form: a "Bilgilendirme" step after the type, per offered type, with "okudum" (owner, 2026-10-23)', () => {
    const d = loadPage('/seans-randevusu/');
    const steps = d.querySelectorAll('main [data-booking] [data-step]').map((s) => s.getAttribute('data-step'));
    expect(steps).toEqual(['1', '2', '3', '4', '5']);
    expect(d.querySelectorAll('main [data-booking] [data-step-dot]').map((s) => s.text.trim())).toEqual(['1Görüşme', '2Bilgilendirme', '3Tarih ve saat', '4Bilgileriniz', '5Onay']);
    const info = d.querySelector('main [data-step="2"]')!;
    const offered = d.querySelectorAll('main [data-step="1"] input[name="type"]:not([disabled])').map((i) => i.getAttribute('value'));
    expect(info.querySelectorAll('[data-info-for]').map((a) => a.getAttribute('data-info-for'))).toEqual(offered);
    const couple = info.querySelector('[data-info-for="couple"]');
    if (couple) expect(couple.text).toMatch(/birlikte katıl/);
    expect(info.text).not.toMatch(/Online Görüşme İçin Gerekenler/);
    expect(info.querySelector('input[name="infoRead"][required]')).not.toBeNull();
    expect(d.querySelector('main [data-step="3"]')?.getAttribute('data-need')).toBe('slot');
    expect(d.querySelector('main [data-step="4"][data-details]')).not.toBeNull();
    expect(d.querySelector('main .edit-link')?.getAttribute('data-goto')).toBe('4');
    expect(d.textContent).not.toMatch(/Aile ve [çÇ]ift/);
  });

  it('intro form asks how the call is held: by phone or video call, before the summary (owner, 2026-10-23)', () => {
    const d = loadPage('/on-gorusme/');
    const step = d.querySelector('main [data-step="4"]')!;
    expect(step.querySelector('h2')?.text).toBe('Ön Görüşmeyi Nasıl Gerçekleştirmek İstersiniz?');
    expect(step.querySelectorAll('input[name="via"][required]').map((i) => i.getAttribute('value'))).toEqual(['phone', 'video']);
    expect(step.text).toContain('Telefonla arayın');
    expect(step.text).toContain('Görüntülü görüşme');
    expect(d.querySelectorAll('main [data-step="5"] [data-sum="via"]')).toHaveLength(1);
    // No online work with children and teenagers (owner, 2026-10-23).
    const ages = d.querySelectorAll('main select[name="age"] option').map((o) => o.text);
    expect(ages[1]).toBe('18–24');
    expect(ages.join(' ')).not.toContain('12–17');
    expect(d.textContent).toContain('Ön görüşme ve seanslar 18 yaşından büyükler içindir.');
  });

  it('contact page has the form, the channels and the emergency note', () => {
    const d = loadPage('/iletisim/');
    expect(d.querySelectorAll('main form')).toHaveLength(1);
    expect(d.textContent).toContain('112');
    expect(d.querySelector('main a[href="/randevu-al/"]')).not.toBeNull();
  });

  it('contact form: fields, fixed topics, consent linking the privacy notice, honeypot, appointment note', () => {
    const squash = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    for (const [path, lang] of [
      ['/iletisim/', 'tr'],
      ['/en/contact/', 'en'],
    ] as const) {
      const d = loadPage(path);
      const form = d.querySelector('main form[data-contact-form]')!;
      expect(form, path).toBeTruthy();
      // Posts to the panel's Apps Script URL (the shared value, not a copy).
      expect(form.getAttribute('data-endpoint')).toBe(ADMIN_CONFIG.apiUrl);
      expect(form.getAttribute('data-lang')).toBe(lang);
      // POST, never GET: even a native submit (no script yet) cannot put personal data in a URL.
      expect(form.getAttribute('method')).toBe('post');
      expect(form.hasAttribute('action')).toBe(false);
      for (const name of ['name', 'email', 'message', 'consent']) {
        const el = form.querySelector(`[name="${name}"]`)!;
        expect(el, `${path} ${name}`).toBeTruthy();
        expect(el.hasAttribute('required'), name).toBe(true);
        expect(form.querySelector(`label[for="${el.getAttribute('id')}"]`)?.text.trim(), name).toBeTruthy();
        expect(form.querySelector(`#${el.getAttribute('aria-describedby')}[data-error-for="${name}"]`), name).toBeTruthy();
      }
      expect(form.querySelector('[name=email]')?.getAttribute('type')).toBe('email');
      expect(form.querySelector('[name=name]')?.getAttribute('maxlength')).toBe('100');
      expect(form.querySelector('[name=message]')?.getAttribute('maxlength')).toBe('5000');
      // The topics as cards (owner's choice B, 2026-10-23): one radio group, required, with its error line.
      const group = form.querySelector('fieldset[data-group=topic]')!;
      expect(group.querySelector('legend')?.text.trim()).toBeTruthy();
      expect(form.querySelector(`#${group.getAttribute('aria-describedby')}[data-error-for="topic"]`)).toBeTruthy();
      const radios = group.querySelectorAll('input[type=radio][name=topic]');
      expect(radios.map((r) => r.getAttribute('value'))).toEqual(CONTACT_TOPICS.map((t) => t.id));
      expect(radios[0].hasAttribute('required')).toBe(true);
      expect(group.querySelectorAll('.topic-name').map((n) => n.text.trim())).toEqual(CONTACT_TOPICS.map((t) => t[lang]));
      expect(form.querySelector('select')).toBeNull();
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
      expect(d.querySelector('main .contact-form .note a')?.getAttribute('href')).toBe(lang === 'tr' ? '/randevu-al/' : '/en/appointment/');
    }
    expect(squash(loadPage('/iletisim/').querySelector('main .contact-form .note')?.text)).toBe('Randevu ve seanslarla ilgili sorularınız için Randevu sayfasını kullanın.');
    expect(squash(loadPage('/en/contact/').querySelector('main .contact-form .note')?.text)).toBe(
      'For questions about appointments and sessions, please use the Appointment page.',
    );
    expect(squash(loadPage('/iletisim/').querySelector('main .consent label')?.text)).toBe('Aydınlatma metnini okudum.');
    expect(squash(loadPage('/en/contact/').querySelector('main .consent label')?.text)).toBe('I have read the privacy notice.');
    // The direct e-mail row and the emergency box stay, below the form.
    const html = loadPage('/iletisim/').querySelector('main')!.innerHTML;
    expect(html.indexOf('data-contact-form')).toBeLessThan(html.lastIndexOf('href="mailto:iletisim@example.com"'));
    expect(html.lastIndexOf('href="mailto:iletisim@example.com"')).toBeGreaterThan(html.indexOf('</form>'));
    expect(html.indexOf('data-contact-form')).toBeLessThan(html.indexOf('emergency-box'));
  });

  it('contact page: one row of ways to reach me lists every social link in file order', () => {
    const links = JSON.parse(readFileSync('tests/fixtures/data/links.json', 'utf8')) as { label: string; icon: string }[];
    const names = loadPage('/iletisim/')
      .querySelectorAll('main .reach a.soc')
      .map((n) => n.getAttribute('aria-label'));
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
    const who = loadPage('/hakkimda/').querySelector('#panel-story .md')!;
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
    expect(
      loadPage('/hakkimda/')
        .querySelectorAll('.period')
        .map((p) => p.text),
    ).toContain('Devam ediyor');
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
      loadPage(path)
        .querySelectorAll(`.site-header a[href="${href}"]`)
        .map((a) => a.getAttribute('aria-current'));
    expect(navBlog('/blog/', '/blog/')).toEqual(['page']);
    expect(navBlog('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/', '/blog/')).toEqual(['true']);
    expect(navBlog('/en/blog/category/mental-health/', '/en/blog/')).toEqual(['true']);
  });
});

describe('page shell (every page but home)', () => {
  const pages = allPages().filter((p) => p !== '/' && p !== '/en/');
  const isPost = (p: string) => /^\/(en\/)?blog\/[^/]+\/$/.test(p);
  const langOf = (p: string) => (p.startsWith('/en/') ? 'en' : 'tr');
  // No bottom bar on the client's page, the start page and the forms themselves.
  const NO_CTA = ['/randevum/', '/en/my-appointment/', '/randevu-al/', '/en/book/', '/bilgi-al/', '/en/information/', '/seans-randevusu/', '/on-gorusme/'];

  /** All CSS a built page loads: its stylesheet links and inline <style> blocks. */
  const pageCss = (p: string) => {
    const d = loadPage(p);
    const linked = d.querySelectorAll('link[rel=stylesheet]').map((l) => readFileSync(join(DIST, l.getAttribute('href')!.replace(/^\//, '')), 'utf8'));
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
    expect(d.querySelector('.page-end')?.text).not.toContain('112');

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
    expect(sticky[0].querySelector('a')?.getAttribute('href')).toBe('/randevu-al/');
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
  const squash = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

  it('about: intro card with the greeting, photo, name, title, membership, lead and facts', () => {
    const d = loadPage('/hakkimda/');
    const intro = d.querySelector('main .about > section.about-intro')!;
    // No greeting in the fixture: the heading is the page title.
    expect(intro.querySelector('h1.hello')?.text).toBe('Hakkımda');
    expect(intro.querySelector('.kicker')?.text).toBe('Hakkımda');
    expect(intro.querySelector('.portrait img')).toBeTruthy();
    expect(squash(intro.querySelector('.who-line .who-name')?.text)).toBe('Osman Güneş Özkurt');
    expect(squash(intro.querySelector('.who-line .who-role')?.text)).toBe('Psikolog');
    expect(squash(intro.querySelector('.tpd')?.text)).toBe('Türk Psikologlar Derneği üyesi');
    expect(squash(intro.querySelector('.lead')?.text)).toBe(fixture('about.json').lead.tr);
    // "{hours}" shows the theory total of the education cards (96), rounded down with a "+".
    expect(intro.querySelectorAll('.facts li').map((li) => squash(li.text))).toEqual(["2023'ten beri online terapi", '96+ saat eğitim']);
    expect(intro.querySelector('a.intro-cta')?.getAttribute('href')).toBe('/randevu-al/');
    expect(squash(loadPage('/en/about/').querySelector('.about-intro .tpd')?.text)).toBe('Member of the Turkish Psychological Association');
    // Phones book from the sticky bar: the card's own button shows from 768 px only.
    const src = readFileSync('src/views/AboutView.astro', 'utf8');
    expect(src.slice(0, src.indexOf('@media (min-width: 768px)'))).toMatch(/\.intro-cta\s*\{\s*display:\s*none/);
  });

  it('about: three tabs (hidden until the script runs) for the story, how I work, education and career', () => {
    for (const [path, labels] of [
      ['/hakkimda/', ['Hikayem', 'Nasıl Çalışırım', 'Eğitim ve Kariyer']],
      ['/en/about/', ['My Story', 'How I Work', 'Education and Career']],
    ] as const) {
      const d = loadPage(path);
      const bar = d.querySelector('main .about-tabs')!;
      expect(bar.hasAttribute('hidden'), path).toBe(true);
      const tabs = bar.querySelectorAll('[role="tab"]');
      expect(
        tabs.map((x) => x.text.trim()),
        path,
      ).toEqual([...labels]);
      expect(tabs.map((x) => x.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
      const panels = d.querySelectorAll('main .about-panel[role="tabpanel"]');
      expect(panels.map((p) => p.id)).toEqual(['panel-story', 'panel-how', 'panel-education']);
      tabs.forEach((x, i) => expect(x.getAttribute('aria-controls')).toBe(panels[i].id));
      // Without JavaScript every panel shows.
      panels.forEach((p) => expect(p.hasAttribute('hidden')).toBe(false));
    }
  });

  it('about: the story keeps the quote; the education panel shows the timeline, the counters and the cards', () => {
    const d = loadPage('/hakkimda/');
    expect(d.querySelector('#panel-story blockquote')?.text).toContain('kendi hikayesinin uzmanıdır');
    expect(d.querySelector('#panel-story .read-more')?.hasAttribute('hidden')).toBe(true);
    const edu = d.querySelector('#panel-education')!;
    expect(edu.querySelectorAll('.timeline li')).toHaveLength(4);
    expect(edu.querySelectorAll('.counter b').map((b) => squash(b.text))).toEqual(['96+ saat', '70+ saat']);
    expect(squash(edu.querySelector('.ledger .intro')?.text)).toBe('Dersler de eğitimdir.');
    expect(edu.querySelectorAll('.group-title').map((h) => squash(h.text))).toEqual(['Lisans', 'Uygulama']);
    // A card with lines opens like an FAQ box; one without stays plain.
    const open = edu.querySelector('details.card')!;
    expect(open.querySelectorAll('.line').map((l) => [l.childNodes[0].text?.trim(), squash(l.querySelector('.line-hours')?.text)])).toEqual([
      ['Psikopatoloji', '48 sa. teorik'],
      ['Klinik Psikoloji', '48 sa. teorik'],
    ]);
    expect(edu.querySelectorAll('div.card')).toHaveLength(1);
    expect(squash(loadPage('/en/about/').querySelector('#panel-education .counter b')?.text)).toBe('96+ hours');
  });

  it('about: work areas and approaches as coloured cards, topics as chips, and links to booking and contact', () => {
    const d = loadPage('/hakkimda/');
    const how = d.querySelector('#panel-how')!;
    expect(how.querySelectorAll('.area-cards li b').map((t) => t.text.trim())).toEqual(fixture('about.json').areas.map((a: { label: { tr: string } }) => a.label.tr));
    expect(how.querySelectorAll('.how-title').map((h) => h.text)).toEqual(['Çalışma Alanlarım', 'Yaklaşımlar', 'Konular']);
    // An approach that is only a short name shows it in its tile, once.
    expect(how.querySelectorAll('.appr-cards .appr-abbr').map((t) => t.text.trim())).toEqual(['BDT']);
    expect(how.querySelectorAll('.appr-cards small')).toHaveLength(0);
    const cta = d.querySelector('main .about-cta')!;
    expect(cta.querySelector('a.cta-book')?.getAttribute('href')).toBe('/randevu-al/');
    expect(cta.querySelector('a.cta-contact[href="/iletisim/"]')?.text).toContain('Benimle iletişime geç');
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
    expect(
      loadPage('/en/resources/')
        .querySelectorAll('main .type-tiles > li')
        .map((li) => li.text.trim()),
    ).toEqual(['Books', 'Articles', 'Scales', 'Videos', 'Podcasts', 'Guides']);
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
    const mail = d.querySelector('main .reach a[href="mailto:iletisim@example.com"]')!;
    expect(mail.text.trim()).toBe('iletisim@example.com');
  });

  it('contact: the response time in the row; no "Online görüşme" box, social accordion or membership (owner’s choice B, 2026-10-23)', () => {
    const d = loadPage('/iletisim/');
    expect(d.querySelectorAll('main .reach span').map((s) => squash(s.text))).toContain(fixture('contact.json').responseTime.tr);
    expect(d.querySelector('main .facts')).toBeNull();
    expect(d.querySelector('main details.social')).toBeNull();
    expect(d.querySelector('main .membership')).toBeNull();
    const en = loadPage('/en/contact/');
    expect(en.querySelectorAll('main .reach span').map((s) => squash(s.text))).toContain(fixture('contact.json').responseTime.en);
  });

  it('contact: emergency note in a short, token-coloured box', () => {
    for (const [path, lang] of [
      ['/iletisim/', 'tr'],
      ['/en/contact/', 'en'],
    ] as const) {
      const box = loadPage(path).querySelector('main .emergency-box')!;
      expect(squash(box.text), path).toBe(fixture('contact.json').emergencyNote[lang]);
    }
    const src = readFileSync('src/views/ContactView.astro', 'utf8');
    expect(src).toMatch(/\.emergency-box\s*\{[^}]*background:\s*var\(--surface\)/);
    expect(src).not.toMatch(/#f3e3dc|#6b2f1f/i);
  });

  it('appointment, legal and 404 keep their content in the new look', () => {
    const appt = loadPage('/seans-randevusu/');
    expect(appt.querySelector('main .page-head h1')?.text).toBe('Seans Randevusu Al');
    // The live booking form, without the dev server's preview note.
    expect(appt.querySelector('main [data-booking][data-endpoint]')).toBeTruthy();
    expect(appt.querySelector('main .preview-note')).toBeNull();
    expect(loadPage('/on-gorusme/').querySelector('main [data-preconsult] .preview-note')).toBeNull();
    expect(loadPage('/gizlilik/').querySelector('main article.legal.legal-page')).toBeTruthy();
    const nf = loadPage('/404.html');
    expect(nf.querySelector('main .not-found svg.sun-mark')).toBeTruthy();
    expect(nf.querySelector('main a.list-item[href="/"]')).toBeTruthy();
    expect(nf.querySelector('main a[href="/en/"]')).toBeTruthy();
  });

  it("the client's own page: both languages, noindex, out of the sitemap, no page counter, no booking bar, no personal data", () => {
    const sm = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    for (const [path, title] of [
      ['/randevum/', 'Randevularım'],
      ['/en/my-appointment/', 'My Appointments'],
    ] as const) {
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

  it('the booking start page: three ways (intro call recommended), each a link to its own page, in search now that booking is live', () => {
    const sm = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    for (const [path, intro, appt, info] of [
      ['/randevu-al/', '/on-gorusme/', '/seans-randevusu/', '/bilgi-al/'],
      ['/en/book/', '/en/intro-call/', '/en/appointment/', '/en/information/'],
    ] as const) {
      const d = loadPage(path);
      expect(d.querySelectorAll('main .way').length, path).toBe(3);
      expect(d.querySelector('main .way.is-recommended a')?.getAttribute('href'), path).toBe(intro);
      expect(d.querySelector(`main .way a[href="${appt}"]`), path).not.toBeNull();
      // "Önce bilgi almak istiyorum" opens its own page like the other two (owner's note 2026-10-22).
      expect(d.querySelector(`main .way a[href="${info}"]`), path).not.toBeNull();
      expect(d.querySelector('main details'), path).toBeNull();
      expect(d.querySelector('main form'), path).toBeNull();
      expect(d.querySelector('meta[name=robots]'), path).toBeNull();
      expect(sm).toContain(path);
      expect(d.querySelector('.sticky-cta'), path).toBeNull();
    }
    // With the forms live, "Randevu Al" opens the start page and the intro button leaves the home page.
    expect(loadPage('/').querySelector('#top-cta')?.getAttribute('href')).toBe('/randevu-al/');
    expect(loadPage('/').querySelector('a.pre-cta')).toBeNull();
  });

  it('the information page: the topic form with its e-mail check and consent, a way back, no booking bar', () => {
    const sm = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    for (const [path, start] of [
      ['/bilgi-al/', '/randevu-al/'],
      ['/en/information/', '/en/book/'],
    ] as const) {
      const d = loadPage(path);
      expect(d.querySelectorAll('h1'), path).toHaveLength(1);
      expect(d.querySelector(`main a[href="${start}"]`), path).not.toBeNull();
      const form = d.querySelector('main form[data-info]')!;
      expect(form.querySelectorAll('input[name="info-topic"]').length, path).toBeGreaterThan(3);
      expect(form.querySelector('input[name="info-email2"]'), path).not.toBeNull();
      expect(form.querySelector('input[name="info-consent"]'), path).not.toBeNull();
      // No fee amount in the answers offered.
      expect(d.textContent, path).not.toMatch(/\d+\s*(TL|₺|€|\$)/);
      expect(d.querySelector('meta[name=robots]'), path).toBeNull();
      expect(sm).toContain(path);
      expect(d.querySelector('.sticky-cta'), path).toBeNull();
    }
  });

  it('the client’s own page and the booking pages load no Google Analytics, even where the site has it (real data build)', () => {
    const home = loadPage('/', DIST_SAMPLES).toString();
    expect(home).toContain('googletagmanager');
    for (const path of [
      '/randevum/',
      '/en/my-appointment/',
      '/randevu-al/',
      '/en/book/',
      '/bilgi-al/',
      '/en/information/',
      '/seans-randevusu/',
      '/en/appointment/',
      '/on-gorusme/',
      '/en/intro-call/',
    ]) {
      const d = loadPage(path, DIST_SAMPLES);
      expect(d.toString(), path).not.toContain('googletagmanager');
      expect(d.querySelector('[data-consent-bar]'), path).toBeNull();
    }
    // The site's own cookieless counter stays on the booking pages, as on the home page.
    expect(loadPage('/seans-randevusu/', DIST_SAMPLES).toString().includes('stats.hit')).toBe(home.includes('stats.hit'));
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
    metas(lang)
      .filter(pick)
      .map((m) => `${prefix[lang]}${m.slug}/`)
      .sort();
  const postLinks = (path: string, lang: 'tr' | 'en') => {
    const re = new RegExp(`^${prefix[lang]}[a-z0-9-]+/$`);
    return [
      ...new Set(
        sample(path)
          .querySelectorAll('main a')
          .map((a) => a.getAttribute('href') ?? '')
          .filter((h) => re.test(h) && !/\/(kategori|category)\//.test(h) && !/^\/(en\/)?blog\/(populer|popular|konular|topics)\/$/.test(h)),
      ),
    ].sort();
  };

  it('the blog list links every post that exists, in each language', () => {
    expect(postLinks('/blog/', 'tr')).toEqual(hrefs('tr'));
    expect(postLinks('/en/blog/', 'en')).toEqual(hrefs('en'));
  });

  // pickPopular: featured posts, newest first, at most four on the blog page and twelve on the popular
  // page (read counts are stubbed to none).
  const popular = (lang: 'tr' | 'en', n = 4) =>
    metas(lang)
      .filter((m) => m.featured)
      .sort((x, y) => y.at - x.at)
      .slice(0, n)
      .map((m) => `${prefix[lang]}${m.slug}/`)
      .sort();
  const popularPage = { tr: '/blog/populer/', en: '/en/blog/popular/' } as const;

  it('the popular tiles open the popular page, #popular follows the featured posts, all absent when none is featured', () => {
    for (const [path, lang] of [
      ['/', 'tr'],
      ['/en/', 'en'],
    ] as const) {
      const tile = sample(path)
        .querySelectorAll('.home-phone .tile-pair a.tile')
        .filter((a) => a.getAttribute('href') === popularPage[lang]);
      expect(tile.length > 0, path).toBe(popular(lang).length > 0);
    }
    for (const [path, lang] of [
      ['/blog/', 'tr'],
      ['/en/blog/', 'en'],
    ] as const) {
      const listed = sample(path)
        .querySelectorAll('section#popular a.list-item')
        .map((a) => a.getAttribute('href') ?? '')
        .sort();
      expect(listed, path).toEqual(popular(lang));
      const more = sample(path).querySelector('section#popular a.more');
      if (listed.length > 0) expect(more?.getAttribute('href'), path).toBe(popularPage[lang]);
      expect(sample(path).querySelectorAll('.blog-phone .topic-pair a.tile').length > 0, path).toBe(listed.length > 0);
      const chips = sample(path)
        .querySelectorAll('.blog-filters nav.category-nav a')
        .map((a) => a.getAttribute('href'));
      expect(chips.includes(popularPage[lang]), path).toBe(listed.length > 0);
      expect(chips, path).not.toContain('#popular');
    }
  });

  it('the popular page lists the popular set, or a short note and a link to all posts', () => {
    for (const lang of ['tr', 'en'] as const) {
      const d = sample(popularPage[lang]);
      const expected = popular(lang, 12);
      const rows = d
        .querySelectorAll('main .post-rows a.list-item')
        .map((a) => a.getAttribute('href') ?? '')
        .sort();
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
    for (const [path, lang] of [
      ['/blog/', 'tr'],
      ['/en/blog/', 'en'],
    ] as const) {
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
    for (const [faq, home] of [
      ['/sik-sorulan-sorular/', '/'],
      ['/en/faq/', '/en/'],
    ] as const) {
      const items = sample(faq).querySelectorAll('main details');
      for (const it of items) expect(it.text.trim().length).toBeGreaterThan(0);
      // Questions set to the FAQ page only (`pages`) are not in the home accordion.
      const faqOnly = (JSON.parse(readFileSync('src/data/faq.json', 'utf8')) as { pages?: string[] }[]).filter((f) => f.pages && f.pages.includes('faq') && !f.pages.includes('home')).length;
      expect(sample(home).querySelectorAll('.home-phone details.faq details.faq-item')).toHaveLength(items.length - faqOnly);
      const ld = sample(faq)
        .querySelectorAll('script[type="application/ld+json"]')
        .map((s) => JSON.parse(s.text))
        .find((d) => d['@type'] === 'FAQPage');
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

describe('moved pages (owner, 2026-10-23)', () => {
  it('the old /randevu/ address leads on to "Seans Randevusu Al", with its query and anchor', () => {
    const html = loadPage('/randevu/').toString();
    expect(html).toContain('location.replace(to + location.search + location.hash)');
    expect(html).toContain('url=/seans-randevusu/');
  });
});
