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
  appointment: { tr: '/seans-randevusu/', en: '/en/appointment/' },
  preConsult: { tr: '/on-gorusme/', en: '/en/intro-call/' },
  privacyNotice: { tr: '/aydinlatma-metni/', en: '/en/privacy-notice/' },
  privacyPolicy: { tr: '/gizlilik/', en: '/en/privacy-policy/' },
  faq: { tr: '/sik-sorulan-sorular/', en: '/en/faq/' },
  popular: { tr: '/blog/populer/', en: '/en/blog/popular/' },
  topics: { tr: '/blog/konular/', en: '/en/blog/topics/' },
};

export function pathFor(key: PageKey, lang: Lang): string {
  return PAGES[key][lang];
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

/** Fixed pages whose address changed; the old address leads on, so links in e-mails already sent keep working. */
export const MOVED_PAGES: { from: string; to: string }[] = [
  // Owner's review 2026-10-23: the session booking page is "Seans Randevusu Al".
  { from: '/randevu/', to: PAGES.appointment.tr },
];

/** Every fixed page path in both languages (redirect `from` values must not hit these). */
export function staticPagePaths(): string[] {
  return Object.values(PAGES).flatMap((p) => [p.tr, p.en]);
}
