import type { Category, Lang, RouteKey, PAGE_KEYS } from '../lib/settings';

export type { RouteKey };

/** Route keys that map to one fixed page. `category` and `post` need a slug: use `categoryPath` / `postPath`. */
export type PageKey = (typeof PAGE_KEYS)[number];

const PAGES: Record<PageKey, Record<Lang, string>> = {
  home: { tr: '/', en: '/en/' },
  about: { tr: '/hakkimda/', en: '/en/about/' },
  blog: { tr: '/blog/', en: '/en/blog/' },
  resources: { tr: '/kaynaklar/', en: '/en/resources/' },
  contact: { tr: '/iletisim/', en: '/en/contact/' },
  appointment: { tr: '/randevu/', en: '/en/appointment/' },
  privacyNotice: { tr: '/aydinlatma-metni/', en: '/en/privacy-notice/' },
  privacyPolicy: { tr: '/gizlilik/', en: '/en/privacy-policy/' },
};

export function pathFor(key: PageKey, lang: Lang): string {
  return PAGES[key][lang];
}

/**
 * The FAQ page (spec §10). Its page and route key arrive with Plan F Task 6; until then the home page
 * and the header link to it from here, and Task 6 turns this into `pathFor('faq', lang)`.
 */
export function faqPath(lang: Lang): string {
  return lang === 'tr' ? '/sik-sorulan-sorular/' : '/en/faq/';
}

export function categoryPath(cat: Category, lang: Lang): string {
  return lang === 'tr' ? `/blog/kategori/${cat.slug.tr}/` : `/en/blog/category/${cat.slug.en}/`;
}

export function postPath(slug: string, lang: Lang): string {
  return `${pathFor('blog', lang)}${slug}/`;
}

export function otherLang(lang: Lang): Lang {
  return lang === 'tr' ? 'en' : 'tr';
}

/** Every fixed page path in both languages (redirect `from` values must not hit these). */
export function staticPagePaths(): string[] {
  return Object.values(PAGES).flatMap((p) => [p.tr, p.en]);
}
