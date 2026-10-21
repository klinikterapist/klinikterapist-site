import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { HTMLElement } from 'node-html-parser';
import { DIST_NO_POSTS, loadPage } from './load';

const tr = () => loadPage('/');
const en = () => loadPage('/en/');
const fixtureLinks = JSON.parse(readFileSync('tests/fixtures/data/links.json', 'utf8')) as { label: string; icon: string }[];

/** Position of the first element matching `sel` in document order (-1 when missing). */
function order(root: HTMLElement, sel: string): number {
  const el = root.querySelector(sel);
  return el ? root.querySelectorAll('*').indexOf(el) : -1;
}

describe('home (phone)', () => {
  it('phone home order', () => {
    const d = tr();
    const sels = [
      '.home-phone #top-cta',
      '.home-phone details.social',
      '.home-phone .new-post',
      '.home-phone .tile-pair',
      '.home-phone details.faq',
      '.home-phone a.list-item[href="/hakkimda/"]',
      '.home-phone a.list-item[href="/kaynaklar/"]',
      '.home-phone a.list-item.newsletter',
    ];
    const at = sels.map((s) => order(d, s));
    for (const [i, s] of sels.entries()) expect(at[i], s).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    // The contact card is not a home list item; "Randevu Al" and the social box do its job.
    expect(d.querySelector('.home-phone a.list-item[href="/iletisim/"]')).toBeNull();
    expect(d.querySelector('#top-cta')?.getAttribute('href')).toBe('/randevu/');
  });

  it('shows name, title with "Online görüşme", the TPD line and the intro', () => {
    const pf = tr().querySelector('.home-phone .profile')!;
    expect(pf.querySelector('.name')?.text).toBe('Osman Güneş Özkurt');
    expect(pf.querySelector('.role')?.text).toBe('Psikolog · Online görüşme');
    expect(pf.querySelector('.tpd')?.text.trim()).toBe('Türk Psikologlar Derneği üyesi');
    expect(en().querySelector('.home-phone .profile .tpd')?.text.trim()).toBe('Member of the Turkish Psychological Association');
    expect(tr().querySelector('.home-phone .intro')?.text).toContain('Kendini anlamak');
  });

  it('social accordion lists every non-email link with notes', () => {
    const acc = tr().querySelector('.home-phone details.social')!;
    const names = acc.querySelectorAll('a.soc .soc-name').map((n) => n.text.trim());
    expect(names).toEqual(fixtureLinks.filter((l) => l.icon !== 'email').map((l) => l.label));
    expect(names).toContain('X (Twitter)');
    expect(acc.querySelector('a[href^="mailto:"]')).toBeNull();
    const medium = acc.querySelectorAll('a.soc').find((a) => a.text.includes('Medium'))!;
    const note = medium.querySelector('.note')!;
    expect(note.text.trim()).toBe('İngilizce');
    expect(note.querySelector('svg.flag')).toBeTruthy();
    // A note that is empty in this language renders nothing (Threads has an empty note in the fixture).
    expect(acc.querySelectorAll('.note')).toHaveLength(1);
    const enNote = en().querySelector('.home-phone details.social .note')!;
    expect(enNote.text.trim()).toBe('In English');
    expect(acc.querySelector('a.soc svg')?.getAttribute('width')).toBe('26');
  });

  it('newest post card shows the newest post, its reading time and no empty read count', () => {
    const card = tr().querySelector('.home-phone .new-post')!;
    expect(card.text).toContain('YENİ YAZI');
    expect(card.getAttribute('href')).toMatch(/^\/blog\/[a-z0-9-]+\/$/);
    expect(card.text).toMatch(/\d+ dk okuma/);
    expect(card.text).not.toMatch(/okunma|null|undefined/);
  });

  it('popular tile hidden with no featured and no counts', () => {
    for (const d of [tr(), en()]) {
      const pair = d.querySelector('.home-phone .tile-pair')!;
      expect(pair.classList.contains('single')).toBe(true);
      expect(pair.querySelectorAll('a.tile')).toHaveLength(1);
    }
    expect(tr().querySelector('.home-phone .tile-pair a.tile')?.getAttribute('href')).toBe('/blog/');
    expect(tr().textContent).not.toContain('Popüler yazılar');
  });

  it('FAQ accordion nests one details per question answered in the page language', () => {
    const faq = tr().querySelector('.home-phone details.faq')!;
    const qs = faq.querySelectorAll('details.faq-item summary').map((s) => s.text.trim());
    expect(qs).toEqual(['İlk görüşme nasıl geçer?', 'Konuştuklarım gizli kalır mı?', 'Ücret ne kadar, nasıl ödenir?']);
    const enQs = en().querySelectorAll('.home-phone details.faq details.faq-item summary').map((s) => s.text.trim());
    expect(enQs).toEqual(['What is the first session like?', 'Will what I share stay confidential?']);
  });

  it('newsletter item goes to the Substack link', () => {
    expect(tr().querySelector('.home-phone a.list-item.newsletter')?.getAttribute('href')).toBe('https://substack.com/');
  });

  it('portrait styles', () => {
    expect(loadPage('/ui-kit/portrait/background/').querySelector('.portrait-hero--background img')).toBeTruthy();
    expect(loadPage('/ui-kit/portrait/round/').querySelector('.portrait-hero--round picture + .sun-badge')).toBeTruthy();
    // Phones only: the photo sits in a <source> for < 768 px; desktops get the inline placeholder and fetch nothing.
    for (const path of ['/ui-kit/portrait/background/', '/ui-kit/portrait/round/', '/']) {
      const pic = loadPage(path).querySelector('.portrait-hero picture')!;
      expect(pic.querySelector('source')?.getAttribute('media'), path).toBe('(max-width: 767px)');
      expect(pic.querySelector('source')?.getAttribute('srcset'), path).toBeTruthy();
      expect(pic.querySelector('img')?.getAttribute('src'), path).toMatch(/^data:image\//);
    }
    const none = loadPage('/ui-kit/portrait/none/').querySelector('.portrait-hero--none')!;
    expect(none.querySelector('svg.sun-mark')).toBeTruthy();
    expect(none.querySelector('img')).toBeNull();
    // The fixture profile (photo + heroStyle background) gives the home page the background style, loaded eagerly.
    const img = tr().querySelector('.portrait-hero--background img')!;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('alt')).toBe("Osman Güneş Özkurt'un portresi");
  });

  it('no posts: no new-post card', () => {
    const d = loadPage('/', DIST_NO_POSTS);
    expect(d.querySelector('.home-phone .new-post')).toBeNull();
    expect(d.querySelector('.home-phone .tile-pair a.tile[href="/blog/"]')).toBeTruthy();
    expect(d.querySelector('.home-desk .latest .post-card')).toBeNull();
  });

  it('EN home', () => {
    const d = en();
    expect(d.querySelector('.home-phone details.social summary')?.text).toContain('Follow on social media');
    const sw = d.querySelector('.home-phone a.lang-switch')!;
    expect(sw.text.trim()).toBe('TR');
    expect(sw.querySelector('svg.flag')).toBeTruthy();
    // English booking closed (booking.json intake, owner 2026-10-21): "Book a Session" is muted with a
    // "Bookings closed" badge and leads to the booking page, which says so.
    const cta = d.querySelector('#top-cta')!;
    expect(cta.classList.contains('is-closed')).toBe(true);
    expect(cta.getAttribute('href')).toBe('/en/appointment/');
    expect(cta.text).toContain('Bookings closed');
    expect(d.querySelector('.home-desk a.book.is-closed')?.text).toContain('Bookings closed');
    expect(d.textContent).not.toContain('Coming soon');
    expect(d.querySelector('.sticky-cta')).toBeNull();
    expect(d.querySelector('.home-phone .role')?.text).toBe('Psychologist · Online sessions');
    expect(d.textContent).not.toMatch(/undefined|Sosyal medyada/);
  });

  it('sticky CTA', () => {
    expect(tr().querySelectorAll('[data-mode="afterTopCta"]')).toHaveLength(1);
    expect(tr().querySelector('#top-cta.is-closed')).toBeNull();
    expect(tr().querySelector('[data-mode="always"]')).toBeNull();
    // No booking in English yet: no bottom bar on the English home.
    expect(en().querySelector('.sticky-cta')).toBeNull();
  });
});

describe('home (desktop)', () => {
  it('hero: the greeting as the one h1, the tagline, intro, booking and free intro call buttons', () => {
    const hero = tr().querySelector('.home-desk .desktop-hero')!;
    expect(tr().querySelectorAll('h1')).toHaveLength(1);
    // Owner's review 2026-10-19: a personal welcome is the headline; the tagline follows it.
    expect(hero.querySelector('p.welcome')?.text.trim()).toBe('Hoş geldiniz');
    // Owner's choice E (2026-10-19): "Merhaba 👋", then "Ben … ." on its own line, both in the h1.
    expect(hero.querySelector('h1.greeting .hi')?.text).toContain('Merhaba');
    expect(hero.querySelector('h1.greeting .me')?.text).toBe('Ben Psikolog Osman Güneş Özkurt.');
    expect(en().querySelector('.home-desk .desktop-hero h1.greeting .me')?.text).toBe("I'm Psychologist Osman Güneş Özkurt.");
    expect(hero.querySelector('p.tagline')?.text).toBe('Daha iyi bir yaşam mümkün.');
    expect(hero.text).toContain('Kendini anlamak');
    expect(hero.querySelector('a.btn[href="/randevu/"]')).toBeTruthy();
    // Owner's review 2026-10-19: "Ön Görüşme" with a "Ücretsiz" tag replaces "İlk görüşme nasıl geçer?".
    expect(hero.querySelector('a[href="/on-gorusme/"]')?.text).toContain('Ön Görüşme');
    expect(hero.querySelector('a[href="/on-gorusme/"] .pre-sub')?.text).toBe('Ücretsiz · Online');
    expect(en().querySelector('.home-desk .desktop-hero a[href="/en/intro-call/"]')).toBeTruthy();
    expect(hero.querySelector('a[href="/sik-sorulan-sorular/#ilk-gorusme"]')).toBeNull();
    // No membership / response-time line on the desktop hero (owner's review 2026-10-18).
    expect(hero.querySelector('.trust')).toBeNull();
    // The text stays first in the markup (reading order); CSS puts the photo on the left.
    expect(readFileSync('src/components/home/DesktopHero.astro', 'utf8')).toMatch(/\.art \{\s*order: -1;/);
    expect(hero.text).not.toContain('Dönüş süresi');
  });

  it('wordmark directly under the buttons (desktop) and the membership line (phone), decorative', () => {
    for (const d of [tr(), en()]) {
      const desk = d.querySelector('.home-desk .desktop-hero .actions')!.nextElementSibling!;
      expect(desk.classList.contains('hero-wordmark')).toBe(true);
      const phone = d.querySelector('.home-phone .profile .hero-wordmark')!;
      expect(phone).toBeTruthy();
      expect(phone.previousElementSibling?.classList.contains('tpd')).toBe(true);
      for (const svg of [desk.querySelector('svg.wordmark')!, phone.querySelector('svg.wordmark')!]) {
        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect(svg.hasAttribute('role')).toBe(false);
        expect(svg.hasAttribute('aria-label')).toBe(false);
        expect(svg.getAttribute('fill')).toBe('currentColor');
      }
    }
    // The phone top bar of inner pages shows the brand (sun, name, title), not the wordmark.
    const bar = loadPage('/hakkimda/').querySelector('.top-bar a.logo')!;
    expect(bar.getAttribute('href')).toBe('/');
    expect(bar.querySelector('svg.wordmark')).toBeNull();
    expect(bar.querySelector('svg.sun-mark')).toBeTruthy();
    expect(bar.querySelector('.brand-name')?.text).toBe('Osman Güneş Özkurt');
    expect(bar.querySelector('.brand-title')?.text).toBe('Psikolog');
    expect(loadPage('/en/about/').querySelector('.top-bar a.logo .brand-title')?.text).toBe('Psychologist');
  });

  it('hero portrait: framed photo for desktops only, with the flat sun at its corner, before the text', () => {
    for (const d of [tr(), en()]) {
      const hero = d.querySelector('.home-desk .desktop-hero')!;
      // heroStyle only picks the phone header: a profile with a photo always gets the framed photo on desktop.
      expect(hero.classList.contains('desktop-hero--photo')).toBe(true);
      const art = hero.querySelector('.art--photo')!;
      const source = art.querySelector('picture > source')!;
      expect(source.getAttribute('media')).toBe('(min-width: 768px)');
      expect(source.getAttribute('srcset')).toBeTruthy();
      const img = art.querySelector('picture > img.photo')!;
      // Phones get an inline placeholder (nothing fetched); the alt matches the phone portrait's.
      expect(img.getAttribute('src')).toMatch(/^data:image\//);
      expect(img.getAttribute('alt')).toBeTruthy();
      expect(img.getAttribute('alt')).toBe(d.querySelector('.home-phone .portrait-hero img')?.getAttribute('alt'));
      expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(img.getAttribute('height'))).toBeGreaterThan(0);
      expect(img.getAttribute('loading')).toBe('eager');
      const sun = art.querySelector('.sun > svg.sun-mark')!;
      expect(sun.getAttribute('aria-hidden')).toBe('true');
      expect(sun.hasAttribute('transform')).toBe(false);
      expect(art.querySelector('.sun-badge')).toBeNull();
      expect(art.querySelector('.signature')).toBeNull();
    }
  });

  it('hero without a photo: the big sun alone, no image', () => {
    const hero = loadPage('/ui-kit/portrait/none/').querySelector('.desktop-hero')!;
    expect(hero.classList.contains('desktop-hero--none')).toBe(true);
    expect(hero.querySelector('.art--none svg.sun-mark')).toBeTruthy();
    expect(hero.querySelector('img, picture')).toBeNull();
    for (const style of ['background', 'round']) {
      expect(loadPage(`/ui-kit/portrait/${style}/`).querySelector('.desktop-hero .art--photo picture img.photo')).toBeTruthy();
    }
  });

  it('latest three posts and the blog tiles', () => {
    const latest = tr().querySelector('.home-desk .latest')!;
    expect(latest.querySelectorAll('.post-card').length).toBeGreaterThan(0);
    expect(latest.querySelectorAll('.post-card').length).toBeLessThanOrEqual(3);
    expect(latest.querySelector('.tile-pair a.tile[href="/blog/"]')).toBeTruthy();
  });

  it('process steps skip a step that is empty in the page language', () => {
    expect(tr().querySelectorAll('.home-desk .process-steps li')).toHaveLength(3);
    const enSteps = en().querySelectorAll('.home-desk .process-steps li');
    expect(enSteps).toHaveLength(2);
    expect(en().querySelector('.home-desk .process-steps')?.text).not.toContain('At your own pace');
  });

  it('FAQ list next to the hello card that links to About', () => {
    const d = tr();
    expect(d.querySelectorAll('.home-desk .faq-list details.faq-item')).toHaveLength(3);
    const hello = d.querySelector('.home-desk .hello')!;
    expect(hello.text).toContain('Merhaba, ben Osman.');
    expect(hello.querySelector('a[href="/hakkimda/"]')).toBeTruthy();
    expect(en().querySelector('.home-desk .hello')?.text).toContain("Hi, I'm Osman.");
  });

  it('newsletter band links to Substack', () => {
    expect(tr().querySelector('.home-desk .newsletter-band a[href="https://substack.com/"]')).toBeTruthy();
  });
});

describe('desktop header and footer', () => {
  it('header has the sun, name and title, nav, segmented theme toggle, language switch and booking, no menu button', () => {
    const h = tr().querySelector('header.site-header')!;
    expect(h.querySelector('.brand svg.sun-mark')).toBeTruthy();
    expect(h.querySelector('.brand')?.text).toContain('Osman Güneş Özkurt');
    expect(h.querySelector('.brand')?.text).toContain('Psikolog');
    expect(h.querySelectorAll('nav a').map((a) => a.getAttribute('href'))).toEqual([
      '/hakkimda/', '/blog/', '/kaynaklar/', '/sik-sorulan-sorular/', '/iletisim/',
    ]);
    expect(h.querySelector('.theme-segmented')).toBeTruthy();
    expect(h.querySelector('a.lang-switch')).toBeTruthy();
    expect(h.querySelector('a.btn[href="/randevu/"]')).toBeTruthy();
    expect(h.querySelector('details')).toBeNull();
  });

  it('footer has the page end (112 and copyright) and the legal links', () => {
    const f = tr().querySelector('footer.site-footer')!;
    expect(f.querySelector('.page-end b')?.text).toBe('112');
    expect(f.text).toContain(`© ${new Date().getFullYear()} klinikterapist.com · Tüm hakları saklıdır.`);
    expect(f.querySelector('a[href="/aydinlatma-metni/"]')).toBeTruthy();
    expect(tr().querySelectorAll('.page-end')).toHaveLength(1);
  });
});

describe('hello card without answered questions', () => {
  it('the hello card shows alone and spans the row when no question is answered', () => {
    const block = loadPage('/ui-kit/tr/').querySelector('section.faq-block')!;
    expect(block.classList.contains('no-faq')).toBe(true);
    expect(block.querySelector('.faq-list')).toBeNull();
    expect(block.querySelector('.hello')?.text).toContain('Merhaba, ben Osman.');
    expect(block.querySelector('.hello a[href="/hakkimda/"]')).toBeTruthy();
  });

  it('with answered questions the home shows both columns', () => {
    const block = tr().querySelector('.home-desk section.faq-block')!;
    expect(block.classList.contains('no-faq')).toBe(false);
    expect(block.querySelector('.faq-list')).toBeTruthy();
  });
});
