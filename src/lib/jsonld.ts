import type { Lang } from './settings';
import { getLinks, getProfile, getSeo } from './settings';
import type { PostEntry } from './posts';
import { pathFor, postPath } from '../i18n/routes';
import { absoluteUrl } from './seo';

const CONTEXT = 'https://schema.org';

const personId = () => `${absoluteUrl('/')}#person`;

export function personLd(lang: Lang) {
  const profile = getProfile();
  return {
    '@context': CONTEXT,
    '@type': 'Person',
    '@id': personId(),
    name: profile.name,
    jobTitle: profile.title[lang],
    description: profile.intro[lang],
    url: absoluteUrl(pathFor('home', lang)),
    ...(profile.photo ? { image: absoluteUrl(profile.photo) } : {}),
    sameAs: getLinks().map((l) => l.url).filter((url) => /^https?:\/\//.test(url)),
  };
}

/** Online-only service: deliberately no `address` (no office, no city). */
export function professionalServiceLd(lang: Lang) {
  const profile = getProfile();
  const seo = getSeo();
  return {
    '@context': CONTEXT,
    '@type': 'ProfessionalService',
    name: seo.siteName[lang],
    description: seo.defaultDescription[lang],
    url: absoluteUrl(pathFor('home', lang)),
    image: absoluteUrl(seo.ogImage),
    areaServed: 'Online',
    availableChannel: {
      '@type': 'ServiceChannel',
      name: lang === 'tr' ? 'Online görüşme' : 'Online session',
      serviceUrl: absoluteUrl(pathFor('appointment', lang)),
    },
    provider: { '@type': 'Person', '@id': personId(), name: profile.name },
  };
}

/** `cover` is an Astro image (`{ src }`) once built, or absent. */
function coverSrc(cover: unknown): string | undefined {
  const src = (cover as { src?: unknown } | undefined)?.src;
  return typeof src === 'string' ? src : undefined;
}

export function blogPostingLd(post: PostEntry, translationUrl: string) {
  const { data } = post;
  const url = absoluteUrl(postPath(data.slug, post.lang));
  return {
    '@context': CONTEXT,
    '@type': 'BlogPosting',
    headline: data.title,
    description: data.description,
    inLanguage: post.lang,
    url,
    mainEntityOfPage: url,
    datePublished: data.publishedAt.toISOString(),
    dateModified: (data.updatedAt ?? data.publishedAt).toISOString(),
    image: absoluteUrl(coverSrc(data.cover) ?? getSeo().ogImage),
    keywords: data.focusKeyword,
    author: { '@type': 'Person', '@id': personId(), name: getProfile().name },
    workTranslation: { '@id': translationUrl },
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
