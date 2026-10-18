import type { Lang } from './settings';
import { getSeo } from './settings';
import { SITE } from './site';
import { pathFor, type PageKey } from '../i18n/routes';

export type Meta = {
  title: string;
  description: string;
  canonical: string;
  alternates: { hreflang: string; href: string }[];
  og: Record<string, string>;
  author?: string;
};

export type MetaInput = {
  lang: Lang;
  title: string;
  description: string;
  path: string;
  alternates: { tr: string; en: string };
  image?: string;
  type?: 'website' | 'article';
  /** Author line (`name, title`) for the `author` meta; posts only. */
  author?: string;
};

const OG_LOCALE: Record<Lang, string> = { tr: 'tr_TR', en: 'en_US' };
const HOME_PATHS = new Set(['/', '/en/']);

/** Absolute URL on this site (from `SITE`); already-absolute URLs pass through. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return SITE + (pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`);
}

export function buildMeta(input: MetaInput): Meta {
  const seo = getSeo();
  const siteName = seo.siteName[input.lang];
  const title = HOME_PATHS.has(input.path) ? siteName : `${input.title} | ${siteName}`;
  const canonical = absoluteUrl(input.path);
  const other: Lang = input.lang === 'tr' ? 'en' : 'tr';
  return {
    title,
    description: input.description,
    canonical,
    ...(input.author ? { author: input.author } : {}),
    alternates: [
      { hreflang: 'tr', href: absoluteUrl(input.alternates.tr) },
      { hreflang: 'en', href: absoluteUrl(input.alternates.en) },
      { hreflang: 'x-default', href: absoluteUrl(input.alternates.tr) },
    ],
    og: {
      'og:title': title,
      'og:description': input.description,
      'og:url': canonical,
      'og:image': absoluteUrl(input.image ?? seo.ogImage),
      'og:type': input.type ?? 'website',
      'og:locale': OG_LOCALE[input.lang],
      'og:locale:alternate': OG_LOCALE[other],
      'og:site_name': siteName,
      'twitter:card': 'summary_large_image',
    },
  };
}

/** Meta and language-switch paths for a fixed page (one route key, both languages). */
export function pageMeta(key: PageKey, lang: Lang, title: string, description: string) {
  const alternatePaths = { tr: pathFor(key, 'tr'), en: pathFor(key, 'en') };
  const meta = buildMeta({ lang, title, description, path: alternatePaths[lang], alternates: alternatePaths });
  return { meta, alternatePaths };
}
