import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseFaq, getFaq,
  getProfile, getLinks, getHome, getAbout, getContact, getResources,
  getCategories, getSeo, getRedirects, parseProfile, parseLinks, parseHome,
  parseRedirects, parseCategories, parseResources, parseAbout, checkRedirectCollisions, slugSchema, periodText, parseContact, slugError,
} from '../../src/lib/settings';
import { staticPagePaths } from '../../src/i18n/routes';

describe('real seed files', () => {
  it('all parse', () => {
    expect(() => getProfile()).not.toThrow();
    expect(() => getLinks()).not.toThrow();
    expect(() => getHome()).not.toThrow();
    expect(() => getAbout()).not.toThrow();
    expect(() => getContact()).not.toThrow();
    expect(() => getResources()).not.toThrow();
    expect(() => getSeo()).not.toThrow();
    expect(getRedirects()).toEqual([]);
  });
  it('has the seed categories', () => {
    const ids = getCategories().map((c) => c.id);
    expect(ids).toContain('zihinsel-saglik');
    expect(ids).toHaveLength(6);
  });
  it('has no location wording', () => {
    const all = JSON.stringify([getProfile(), getAbout(), getContact()]);
    expect(all).not.toMatch(/yüz yüze|in-person/i);
  });
});

describe('validation errors name file and field', () => {
  it('profile', () => {
    expect(() => parseProfile({ name: 'x' })).toThrow(/profile\.json.*title/);
  });
  it('nested field path', () => {
    expect(() => parseLinks([{ id: 'a', label: 'a', url: 'u', icon: 'nope', inHero: true, inFooter: true }]))
      .toThrow(/links\.json.*0\.icon/);
  });
});

describe('home cards', () => {
  const card = (target: unknown) => ({
    cards: [{ id: 'c', target, title: { tr: 'a', en: 'a' }, subtitle: { tr: 'b', en: 'b' }, icon: 'user', visible: true }],
  });
  it('accept a fixed page or a url', () => {
    expect(() => parseHome(card({ page: 'about' }))).not.toThrow();
    expect(() => parseHome(card({ url: 'https://medium.com/' }))).not.toThrow();
  });
  it('reject category/post pages, which have no fixed path', () => {
    expect(() => parseHome(card({ page: 'post' }))).toThrow(/home\.json/);
    expect(() => parseHome(card({ page: 'category' }))).toThrow(/home\.json/);
  });
});

describe('redirects (I1)', () => {
  const r = (from: string, to: string) => ({ from, to });
  it('accept lowercase site-relative paths with a trailing slash', () => {
    expect(parseRedirects([r('/blog/eski/', '/blog/yeni/'), r('/eski-sayfa/', '/')])).toHaveLength(2);
    expect(parseRedirects([])).toEqual([]);
  });
  it('reject a from without trailing slash, with capitals, or not starting with /', () => {
    expect(() => parseRedirects([r('/blog/eski', '/blog/yeni/')])).toThrow(/redirects\.json.*0\.from/);
    expect(() => parseRedirects([r('/Blog/eski/', '/blog/yeni/')])).toThrow(/redirects\.json.*0\.from/);
    expect(() => parseRedirects([r('blog/eski/', '/blog/yeni/')])).toThrow(/redirects\.json.*0\.from/);
  });
  it('reject from "/" (the home page)', () => {
    expect(() => parseRedirects([r('/', '/blog/')])).toThrow(/redirects\.json.*0\.from.*ana sayfa/);
  });
  it('reject a to that is not a site-relative path', () => {
    expect(() => parseRedirects([r('/a/', 'javascript:alert(1)')])).toThrow(/redirects\.json.*0\.to/);
    expect(() => parseRedirects([r('/a/', 'https://example.org/')])).toThrow(/redirects\.json.*0\.to/);
    expect(() => parseRedirects([r('/a/', '/b')])).toThrow(/redirects\.json.*0\.to/);
  });
  it('reject duplicate from, from equal to to, and chains', () => {
    expect(() => parseRedirects([r('/a/', '/b/'), r('/a/', '/c/')])).toThrow(/redirects\.json.*1\.from.*\/a\//);
    expect(() => parseRedirects([r('/a/', '/a/')])).toThrow(/redirects\.json.*0\.to/);
    expect(() => parseRedirects([r('/a/', '/b/'), r('/b/', '/c/')])).toThrow(/redirects\.json.*0\.to.*\/c\//);
    expect(() => parseRedirects([r('/a/', '/b/'), r('/b/', '/a/')])).toThrow(/redirects\.json/);
  });
  it('fail when a from is a real page path', () => {
    const list = parseRedirects([r('/blog/eski/', '/blog/yeni/')]);
    expect(() => checkRedirectCollisions(list, ['/blog/yeni/', '/hakkimda/'])).not.toThrow();
    expect(() => checkRedirectCollisions(list, ['/blog/eski/']))
      .toThrow(/redirects\.json.*0\.from.*"\/blog\/eski\/".*gerçek bir sayfa/);
  });
  it('every static page path in both languages is a collision candidate', () => {
    const paths = staticPagePaths();
    for (const p of ['/', '/en/', '/hakkimda/', '/en/about/', '/blog/', '/en/blog/', '/gizlilik/', '/en/privacy-policy/']) {
      expect(paths).toContain(p);
    }
  });
});

describe('slugs (I2)', () => {
  it('slug schema accepts lowercase-dash slugs only', () => {
    for (const ok of ['a', 'kaygi-ile-yasamak', 'adim-3']) expect(slugSchema.safeParse(ok).success).toBe(true);
    for (const bad of ['', 'Kaygi', 'kaygı', 'a b', '-a', 'a-', 'a--b', 'a/b']) {
      expect(slugSchema.safeParse(bad).success).toBe(false);
    }
  });
  const cat = (id: string, tr: string, en: string) => ({ id, slug: { tr, en }, label: { tr: id, en: id } });
  it('category slugs must match the slug pattern in both languages', () => {
    expect(() => parseCategories([cat('a', 'Zihinsel Sağlık', 'mental')])).toThrow(/categories\.json.*0\.slug\.tr/);
    expect(() => parseCategories([cat('a', 'zihin', '')])).toThrow(/categories\.json.*0\.slug\.en/);
  });
  it('category slugs must be unique per language', () => {
    expect(() => parseCategories([cat('a', 'x', 'x-en'), cat('b', 'y', 'x-en')]))
      .toThrow(/categories\.json.*1\.slug\.en.*"x-en"/);
    expect(() => parseCategories([cat('a', 'x', 'x'), cat('b', 'y', 'y')])).not.toThrow();
  });
});

describe('url fields (M2)', () => {
  const link = (icon: string, url: string) => [{ id: 'l', label: 'L', url, icon, inHero: true, inFooter: true }];
  it('links: https for profiles, mailto for e-mail', () => {
    expect(() => parseLinks(link('instagram', 'https://instagram.com/x'))).not.toThrow();
    expect(() => parseLinks(link('email', 'mailto:a@b.co'))).not.toThrow();
    expect(() => parseLinks(link('tiktok', 'https://www.tiktok.com/@klinikterapist'))).not.toThrow();
    expect(() => parseLinks(link('threads', 'https://www.threads.com/@klinikterapist'))).not.toThrow();
    expect(() => parseLinks(link('instagram', 'instagram.com/x'))).toThrow(/links\.json.*0\.url.*https:\/\//);
    expect(() => parseLinks(link('instagram', 'javascript:alert(1)'))).toThrow(/links\.json.*0\.url/);
    expect(() => parseLinks(link('email', 'https://a.co/'))).toThrow(/links\.json.*0\.url.*mailto:/);
    expect(() => parseLinks(link('email', 'mailto:not-an-address'))).toThrow(/links\.json.*0\.url/);
  });
  it('home card url targets must be https', () => {
    const card = (url: string) => ({
      cards: [{ id: 'c', target: { url }, title: { tr: 'a', en: 'a' }, subtitle: { tr: 'b', en: 'b' }, icon: 'user', visible: true }],
    });
    expect(() => parseHome(card('instagram.com/x'))).toThrow(/home\.json/);
    expect(() => parseHome(card('javascript:alert(1)'))).toThrow(/home\.json/);
  });
  it('resource urls must be https', () => {
    const res = (url: string) => ({
      myNote: { tr: 'n', en: 'n' },
      items: [{ id: 'r', type: 'book', title: 'T', note: { tr: 'a', en: 'a' }, url, featured: false }],
    });
    expect(() => parseResources(res('https://a.co/b'))).not.toThrow();
    expect(() => parseResources(res('a.co/b'))).toThrow(/resources\.json.*items\.0\.url/);
  });
});

describe('resources note (myNote) and timeline period', () => {
  it('resources.json holds a localized owner note next to the items', () => {
    const res = getResources();
    expect(res.myNote.tr).toMatch(/kaynaklara yer veriyorum/);
    expect(res.myNote.en).toMatch(/resources/);
    expect(res.items.length).toBeGreaterThan(0);
    expect(() => parseResources({ items: [] })).toThrow(/resources\.json.*myNote/);
  });
  it('timeline period may be a plain string or localized', () => {
    const about = getAbout();
    const base = { ...about, timeline: [{ title: { tr: 'a', en: 'a' }, detail: { tr: 'd', en: 'd' }, period: '2016–2020' }] };
    expect(() => parseAbout(base)).not.toThrow();
    const loc = { ...base, timeline: [{ ...base.timeline[0], period: { tr: 'Devam ediyor', en: 'Ongoing' } }] };
    expect(() => parseAbout(loc)).not.toThrow();
    expect(periodText('2016–2020', 'en')).toBe('2016–2020');
    expect(periodText({ tr: 'Devam ediyor', en: 'Ongoing' }, 'en')).toBe('Ongoing');
  });
  it('the real seed has no Turkish-only period', () => {
    for (const item of getAbout().timeline) {
      if (typeof item.period === 'string') expect(item.period).toMatch(/^[\d–\-\s]+$/);
    }
  });
});

describe('Phase 2 hardening', () => {
  const contact = { intro: { tr: 'a', en: 'a' }, workStyle: { tr: 'a', en: 'a' }, responseTime: { tr: 'a', en: 'a' }, emergencyNote: { tr: 'a', en: 'a' } };
  it('contact e-mail must be an e-mail address', () => {
    expect(() => parseContact({ ...contact, email: 'not-an-email' })).toThrow(/contact\.json.*email/);
    expect(() => parseContact({ ...contact, email: 'merhaba@klinikterapist.com' })).not.toThrow();
  });
  it('reserved category base paths are not valid post slugs in their language', () => {
    expect(slugError('kategori', 'tr')).toMatch(/kategori/);
    expect(slugError('category', 'en')).toMatch(/category/);
    expect(slugError('populer', 'tr')).toMatch(/populer/);
    expect(slugError('popular', 'en')).toMatch(/popular/);
    expect(slugError('popular', 'tr')).toBeNull();
    expect(slugError('kategori', 'en')).toBeNull();
    expect(slugError('category', 'tr')).toBeNull();
    expect(slugError('', 'tr')).toBeTruthy();
    expect(slugError('Büyük-Harf', 'tr')).toBeTruthy();
    expect(slugError('kaygi-ile-yasamak', 'tr')).toBeNull();
  });
  it('profile accepts an optional short intro', () => {
    const p = getProfile();
    expect(() => parseProfile({ ...p, shortIntro: { tr: 'Kısa.', en: 'Short.' } })).not.toThrow();
    const { shortIntro: _omit, ...rest } = { ...p, shortIntro: undefined };
    expect(() => parseProfile(rest)).not.toThrow();
  });
});

describe('Plan E content fields', () => {
  it('current data still parses and the new optional fields are accepted', () => {
    const p = getProfile();
    expect(p.heroStyle).toBeUndefined();
    expect(p.memberships?.[0].org.tr).toBe('Türk Psikologlar Derneği');
    expect(p.photo).toMatch(/^\/images\/profil-[0-9a-f]{8}\.webp$/);
    expect(() => parseProfile({ ...p, heroStyle: 'round', memberships: [{ org: { tr: 'a', en: 'b' }, number: '12' }] })).not.toThrow();
    expect(() => parseProfile({ ...p, heroStyle: 'background' })).not.toThrow();
  });
  it('rejects an unknown heroStyle', () => {
    expect(() => parseProfile({ ...getProfile(), heroStyle: 'x' })).toThrow(/profile\.json.*heroStyle/);
  });
  it('links accept a note; Medium has one', () => {
    expect(getLinks().find((l) => l.id === 'medium')?.note).toEqual({ tr: 'İngilizce', en: 'In English' });
    const l = getLinks()[0];
    expect(() => parseLinks([{ ...l, note: { tr: 'n', en: 'n' } }])).not.toThrow();
  });
  it('home accepts up to three process steps', () => {
    const h = getHome();
    const step = { title: { tr: 'a', en: 'a' }, text: { tr: 'b', en: 'b' } };
    expect(() => parseHome({ ...h, process: [step, step, step] })).not.toThrow();
    expect(() => parseHome({ ...h, process: [step, step, step, step] })).toThrow(/home\.json.*process/);
  });
  it('faq: questions with no answer in either language show nothing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'faq-'));
    const prev = process.env.DATA_DIR;
    try {
      const faq = JSON.parse(readFileSync('tests/fixtures/data/faq.json', 'utf8')).map((f: object) => ({ ...f, a: { tr: '', en: '' } }));
      expect(parseFaq(faq)).toHaveLength(4);
      writeFileSync(join(dir, 'faq.json'), JSON.stringify(faq));
      process.env.DATA_DIR = dir;
      expect(getFaq('tr')).toEqual([]);
      expect(getFaq('en')).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = prev;
      rmSync(dir, { recursive: true });
    }
  });
  it('faq: ids must be unique', () => {
    const item = (id: string) => ({ id, q: { tr: 'a', en: 'a' }, a: { tr: '', en: '' } });
    expect(() => parseFaq([item('ucret'), item('ucret')])).toThrow(/faq\.json.*1\.id.*"ucret"/);
    expect(() => parseFaq([item('ucret'), item('sure')])).not.toThrow();
  });
  it('faq: only items answered in the language are returned', () => {
    const dir = mkdtempSync(join(tmpdir(), 'faq-'));
    const prev = process.env.DATA_DIR;
    try {
      const faq = JSON.parse(readFileSync('tests/fixtures/data/faq.json', 'utf8')).map((f: object) => ({ ...f, a: { tr: '', en: '' } }));
      faq[2].a.tr = 'Ücret görüşmede paylaşılır.';
      writeFileSync(join(dir, 'faq.json'), JSON.stringify(faq));
      process.env.DATA_DIR = dir;
      expect(getFaq('tr')).toEqual([{ id: 'ucret', q: 'Ücret ne kadar, nasıl ödenir?', a: 'Ücret görüşmede paylaşılır.' }]);
      expect(getFaq('en')).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = prev;
      rmSync(dir, { recursive: true });
    }
  });
  it('faq ids must be slug-like', () => {
    expect(() => parseFaq([{ id: 'Not Slug', q: { tr: 'a', en: 'a' }, a: { tr: '', en: '' } }])).toThrow(/faq\.json/);
  });
});
