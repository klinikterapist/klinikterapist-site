import type { Lang } from './settings';
import { getFaq, getLinks, getProfile, getSeo } from './settings';
import type { PostEntry } from './posts';
import { pathFor, postPath } from '../i18n/routes';
import { absoluteUrl } from './seo';

const CONTEXT = 'https://schema.org';

const personId = () => `${absoluteUrl('/')}#person`;

export function personLd(lang: Lang) {
  const profile = getProfile();
  const memberOf = (profile.memberships ?? [])
    .map((m) => m.org[lang].trim())
    .filter(Boolean)
    .map((name) => ({ '@type': 'Organization', name }));
  return {
    '@context': CONTEXT,
    '@type': 'Person',
    '@id': personId(),
    name: profile.name,
    ...(profile.title[lang].trim() ? { jobTitle: profile.title[lang].trim() } : {}),
    description: profile.intro[lang],
    url: absoluteUrl(pathFor('home', lang)),
    ...(profile.photo ? { image: absoluteUrl(profile.photo) } : {}),
    ...(memberOf.length > 0 ? { memberOf } : {}),
    sameAs: getLinks().map((l) => l.url).filter((url) => /^https?:\/\//.test(url)),
  };
}

/**
 * The About page as the person's profile page: the same person as the home page (same `@id`), with
 * the work areas listed on the page as `knowsAbout`.
 */
export function profilePageLd(lang: Lang, areas: string[]) {
  const { '@context': _context, ...person } = personLd(lang);
  const knowsAbout = areas.map((a) => a.trim()).filter(Boolean);
  return {
    '@context': CONTEXT,
    '@type': 'ProfilePage',
    url: absoluteUrl(pathFor('about', lang)),
    inLanguage: lang,
    mainEntity: { ...person, ...(knowsAbout.length > 0 ? { knowsAbout } : {}) },
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
  const profile = getProfile();
  const jobTitle = profile.title[post.lang].trim();
  const url = absoluteUrl(postPath(data.slug, post.lang));
  return {
    '@context': CONTEXT,
    '@type': 'BlogPosting',
    headline: data.title,
    description: data.description,
    inLanguage: post.lang === 'tr' ? 'tr-TR' : 'en-US',
    url,
    mainEntityOfPage: url,
    datePublished: data.publishedAt.toISOString(),
    dateModified: (data.updatedAt ?? data.publishedAt).toISOString(),
    image: absoluteUrl(coverSrc(data.cover) ?? getSeo().ogImage),
    keywords: data.focusKeyword,
    author: {
      '@type': 'Person',
      '@id': personId(),
      name: profile.name,
      ...(jobTitle ? { jobTitle } : {}),
      url: absoluteUrl(pathFor('about', post.lang)),
    },
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

/** FAQPage for the answered questions in `lang`; null when none is answered (no empty markup). */
export function faqPageLd(lang: Lang) {
  const faq = getFaq(lang);
  if (faq.length === 0) return null;
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
