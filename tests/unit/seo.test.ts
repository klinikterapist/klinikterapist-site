import { describe, it, expect } from 'vitest';
import { buildMeta, pageMeta } from '../../src/lib/seo';
import { personLd, professionalServiceLd, blogPostingLd, breadcrumbLd, faqPageLd } from '../../src/lib/jsonld';
import type { PostEntry } from '../../src/lib/posts';
import { getFaq, getProfile, getSeo } from '../../src/lib/settings';
import { useFixtureData } from '../helpers/fixture-data';

// Texts below come from the data readers, never from the owner's real src/data, which the panel edits and deploy.yml
// runs this suite against (see tests/helpers/fixture-data.ts).
useFixtureData();
const site = (lang: 'tr' | 'en') => getSeo().siteName[lang];

const about = {
  lang: 'tr' as const, title: 'Hakkımda', description: 'd', path: '/hakkimda/',
  alternates: { tr: '/hakkimda/', en: '/en/about/' },
};

describe('site name', () => {
  it('is set in both languages', () => {
    expect(site('tr').trim()).not.toBe('');
    expect(site('en').trim()).not.toBe('');
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
    expect(buildMeta(about).title).toBe(`Hakkımda | ${site('tr')}`);
    const home = buildMeta({ ...about, title: 'Ana Sayfa', path: '/', alternates: { tr: '/', en: '/en/' } });
    expect(home.title).toBe(site('tr'));
    const homeEn = buildMeta({ ...about, lang: 'en', title: 'Home', path: '/en/', alternates: { tr: '/', en: '/en/' } });
    expect(homeEn.title).toBe(site('en'));
  });

  it('fills og and twitter tags', () => {
    const m = buildMeta({ ...about, lang: 'en', path: '/en/about/', image: '/images/x.jpg', type: 'article' });
    expect(m.og).toEqual({
      'og:title': `Hakkımda | ${site('en')}`,
      'og:description': 'd',
      'og:url': 'https://example.com/en/about/',
      'og:image': 'https://example.com/images/x.jpg',
      'og:image:alt': 'Hakkımda',
      'og:type': 'article',
      'og:locale': 'en_US',
      'og:locale:alternate': 'tr_TR',
      'og:site_name': site('en'),
      'twitter:card': 'summary_large_image',
    });
    expect(buildMeta(about).og['og:type']).toBe('website');
    expect(buildMeta(about).og['og:locale']).toBe('tr_TR');
  });

  it('gives the default image its size and the site name as alt text', () => {
    const og = buildMeta(about).og;
    expect(og['og:image:width']).toBe('1200');
    expect(og['og:image:height']).toBe('630');
    expect(og['og:image:alt']).toBe(site('tr'));
  });

  it('passes a given image size and alt text through; no size when unknown', () => {
    const og = buildMeta({ ...about, image: '/c.jpg', imageSize: { width: 1200, height: 800 }, imageAlt: 'Kapak' }).og;
    expect(og).toMatchObject({ 'og:image:width': '1200', 'og:image:height': '800', 'og:image:alt': 'Kapak' });
    const unknown = buildMeta({ ...about, image: '/c.jpg', imageAlt: '  ' }).og;
    expect(unknown['og:image:width']).toBeUndefined();
    expect(unknown['og:image:alt']).toBe('Hakkımda');
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
    expect(ld.availableChannel).toMatchObject({ '@type': 'ServiceChannel', serviceUrl: 'https://example.com/seans-randevusu/' });
  });

  it('person uses the profile title and public links', () => {
    const ld = personLd('en');
    expect(ld).toMatchObject({ '@type': 'Person', name: getProfile().name, jobTitle: getProfile().title.en, url: 'https://example.com/en/' });
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

  it('post author carries the job title and the about page', () => {
    const post = {
      lang: 'en',
      data: { slug: 'a', title: 'T', description: 'd', focusKeyword: 'k', publishedAt: new Date('2026-09-01T00:00:00Z') },
    } as PostEntry;
    const author = (blogPostingLd(post, 'https://example.com/x/') as { author: Record<string, string> }).author;
    expect(author.jobTitle).toBe(getProfile().title.en);
    expect(author.url).toBe('https://example.com/en/about/');
  });

  it('the person is a member of the listed organisations', () => {
    expect(personLd('tr')).toMatchObject({ memberOf: [{ '@type': 'Organization', name: 'Türk Psikologlar Derneği' }] });
    expect(personLd('en')).toMatchObject({ memberOf: [{ name: 'Turkish Psychological Association' }] });
  });

  it('FAQPage mirrors the answered questions, or is absent when there are none', () => {
    for (const lang of ['tr', 'en'] as const) {
      const answered = getFaq(lang);
      const ld = faqPageLd(lang);
      if (answered.length === 0) expect(ld).toBeNull();
      else {
        expect(ld!['@type']).toBe('FAQPage');
        expect(ld!.mainEntity.map((q) => q.name)).toEqual(answered.map((f) => f.q));
        expect(ld!.mainEntity[0]).toMatchObject({ '@type': 'Question', acceptedAnswer: { '@type': 'Answer', text: answered[0].a } });
      }
    }
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

describe('author meta', () => {
  it('buildMeta carries an author when given', () => {
    expect(buildMeta({ ...about, author: 'A, B' }).author).toBe('A, B');
    expect(buildMeta(about).author).toBeUndefined();
  });
});

describe('pageMeta', () => {
  it('builds meta and alternate paths for a fixed page from its route key', () => {
    const { meta, alternatePaths } = pageMeta('about', 'en', 'About Me', 'd');
    expect(alternatePaths).toEqual({ tr: '/hakkimda/', en: '/en/about/' });
    expect(meta.canonical).toBe('https://example.com/en/about/');
    expect(meta.title).toBe(`About Me | ${site('en')}`);
    expect(meta.description).toBe('d');
  });
});
