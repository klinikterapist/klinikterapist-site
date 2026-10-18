import { describe, it, expect } from 'vitest';
import { buildMeta, pageMeta } from '../../src/lib/seo';
import { personLd, professionalServiceLd, blogPostingLd, breadcrumbLd } from '../../src/lib/jsonld';
import type { PostEntry } from '../../src/lib/posts';
import { getProfile, getSeo } from '../../src/lib/settings';

const about = {
  lang: 'tr' as const, title: 'Hakkımda', description: 'd', path: '/hakkimda/',
  alternates: { tr: '/hakkimda/', en: '/en/about/' },
};

describe('site name', () => {
  it('uses the full professional name', () => {
    expect(getSeo().siteName.tr).toBe('Psikolog Osman Güneş Özkurt');
    expect(getSeo().siteName.en).toBe('Psychologist Osman Güneş Özkurt');
  });
});

describe('buildMeta', () => {
  it('builds canonical, hreflang alternates and default og image', () => {
    const m = buildMeta({ lang:'tr', title:'Hakkımda', description:'d', path:'/hakkimda/', alternates:{ tr:'/hakkimda/', en:'/en/about/' } });
    expect(m.canonical).toBe('https://example.com/hakkimda/');
    expect(m.alternates).toEqual([
      { hreflang:'tr', href:'https://example.com/hakkimda/' },
      { hreflang:'en', href:'https://example.com/en/about/' },
      { hreflang:'x-default', href:'https://example.com/hakkimda/' }]);
    expect(m.og['og:image']).toBe('https://example.com/og-default.jpg'); // fallback when no image
  });

  it('formats the title with the site name; home uses the site name alone', () => {
    expect(buildMeta(about).title).toBe('Hakkımda | Psikolog Osman Güneş Özkurt');
    const home = buildMeta({ ...about, title: 'Ana Sayfa', path: '/', alternates: { tr: '/', en: '/en/' } });
    expect(home.title).toBe('Psikolog Osman Güneş Özkurt');
    const homeEn = buildMeta({ ...about, lang: 'en', title: 'Home', path: '/en/', alternates: { tr: '/', en: '/en/' } });
    expect(homeEn.title).toBe('Psychologist Osman Güneş Özkurt');
  });

  it('fills og and twitter tags', () => {
    const m = buildMeta({ ...about, lang: 'en', path: '/en/about/', image: '/images/x.jpg', type: 'article' });
    expect(m.og).toEqual({
      'og:title': 'Hakkımda | Psychologist Osman Güneş Özkurt',
      'og:description': 'd',
      'og:url': 'https://example.com/en/about/',
      'og:image': 'https://example.com/images/x.jpg',
      'og:type': 'article',
      'og:locale': 'en_US',
      'og:locale:alternate': 'tr_TR',
      'og:site_name': 'Psychologist Osman Güneş Özkurt',
      'twitter:card': 'summary_large_image',
    });
    expect(buildMeta(about).og['og:type']).toBe('website');
    expect(buildMeta(about).og['og:locale']).toBe('tr_TR');
  });

  it('keeps absolute image URLs as they are', () => {
    expect(buildMeta({ ...about, image: 'https://cdn.test/a.jpg' }).og['og:image']).toBe('https://cdn.test/a.jpg');
  });
});

describe('jsonld', () => {
  it('professional service is online only, with no address', () => {
    const ld = professionalServiceLd('tr');
    expect(JSON.stringify(professionalServiceLd('tr'))).not.toContain('address');
    expect(ld).toMatchObject({ '@type': 'ProfessionalService', areaServed: 'Online' });
    expect(ld.availableChannel).toMatchObject({ '@type': 'ServiceChannel', serviceUrl: 'https://example.com/randevu/' });
  });

  it('person uses the profile title and public links', () => {
    const ld = personLd('en');
    expect(ld).toMatchObject({ '@type': 'Person', name: 'Osman Güneş Özkurt', jobTitle: getProfile().title.en, url: 'https://example.com/en/' });
    expect(ld.sameAs).toContain('https://instagram.com/klinikterapist');
    expect(ld.sameAs).toContain('https://www.tiktok.com/@klinikterapist');
    expect(JSON.stringify(ld.sameAs)).not.toContain('mailto:');
  });

  it('blog posting links to its translation and falls back to the default image', () => {
    const post = {
      id: 'kaygi/tr', key: 'kaygi', lang: 'tr', readingMinutes: 5, body: '',
      data: {
        title: 'Kaygı', description: 'açıklama', slug: 'kaygi', focusKeyword: 'kaygı', category: 'duygular',
        publishedAt: new Date('2026-09-01T00:00:00Z'), updatedAt: new Date('2026-09-05T00:00:00Z'),
      },
    } as PostEntry;
    expect(blogPostingLd(post, 'https://example.com/en/blog/anxiety/')).toMatchObject({
      '@type': 'BlogPosting', headline: 'Kaygı', description: 'açıklama', inLanguage: 'tr-TR',
      url: 'https://example.com/blog/kaygi/', datePublished: '2026-09-01T00:00:00.000Z',
      dateModified: '2026-09-05T00:00:00.000Z', image: 'https://example.com/og-default.jpg',
      workTranslation: { '@id': 'https://example.com/en/blog/anxiety/' },
    });
  });

  it('breadcrumb numbers its items', () => {
    expect(breadcrumbLd([
      { name: 'Ana Sayfa', url: 'https://example.com/' },
      { name: 'Blog', url: 'https://example.com/blog/' },
    ])).toEqual({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: 'https://example.com/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://example.com/blog/' },
      ],
    });
  });
});

describe('pageMeta', () => {
  it('builds meta and alternate paths for a fixed page from its route key', () => {
    const { meta, alternatePaths } = pageMeta('about', 'en', 'About Me', 'd');
    expect(alternatePaths).toEqual({ tr: '/hakkimda/', en: '/en/about/' });
    expect(meta.canonical).toBe('https://example.com/en/about/');
    expect(meta.title).toBe('About Me | Psychologist Osman Güneş Özkurt');
    expect(meta.description).toBe('d');
  });
});
