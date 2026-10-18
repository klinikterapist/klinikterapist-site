import { describe, it, expect } from 'vitest';
import { pathFor, categoryPath, postPath, otherLang } from '../../src/i18n/routes';
import { t } from '../../src/i18n/ui';
import { getCategories } from '../../src/lib/settings';

describe('routes', () => {
  it('builds page paths from the route map', () => {
    expect(pathFor('about', 'en')).toBe('/en/about/');
    expect(pathFor('home', 'tr')).toBe('/');
    expect(pathFor('home', 'en')).toBe('/en/');
    expect(pathFor('appointment', 'tr')).toBe('/randevu/');
    expect(pathFor('appointment', 'en')).toBe('/en/appointment/');
    expect(pathFor('privacyNotice', 'tr')).toBe('/aydinlatma-metni/');
    expect(pathFor('privacyPolicy', 'en')).toBe('/en/privacy-policy/');
    expect(pathFor('faq', 'tr')).toBe('/sik-sorulan-sorular/');
    expect(pathFor('faq', 'en')).toBe('/en/faq/');
  });

  it('builds post and category paths', () => {
    expect(postPath('kaygi-ile-yasamak', 'tr')).toBe('/blog/kaygi-ile-yasamak/');
    expect(postPath('living-with-anxiety', 'en')).toBe('/en/blog/living-with-anxiety/');
    const cat = getCategories().find((c) => c.id === 'zihinsel-saglik')!;
    expect(categoryPath(cat, 'tr')).toBe('/blog/kategori/zihinsel-saglik/');
    expect(categoryPath(cat, 'en')).toBe('/en/blog/category/mental-health/');
  });

  it('every page path ends with a trailing slash', () => {
    const keys = ['home', 'about', 'blog', 'resources', 'contact', 'appointment', 'privacyNotice', 'privacyPolicy', 'faq'] as const;
    for (const k of keys) for (const l of ['tr', 'en'] as const) expect(pathFor(k, l)).toMatch(/\/$/);
  });

  it('otherLang flips the language', () => {
    expect(otherLang('tr')).toBe('en');
    expect(otherLang('en')).toBe('tr');
  });
});

describe('ui strings', () => {
  it('returns the string for each language', () => {
    expect(t('tr', 'bookSession')).toBe('Randevu Al');
    expect(t('en', 'bookSession')).toBe('Book a Session');
    expect(t('tr', 'minRead')).toBe('dk okuma');
    expect(t('en', 'minRead')).toBe('min read');
    expect(t('tr', 'allPosts')).toBe('Tüm Yazılar');
    expect(t('en', 'allPosts')).toBe('All Posts');
    expect(t('tr', 'backToTop')).toBe('Başa Dön');
  });
});
