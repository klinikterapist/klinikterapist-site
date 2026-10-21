import { describe, it, expect } from 'vitest';
import { answeredFaq, injectionFits, parseFaq, parseSeo } from '../../src/lib/schemas';
import { textBlocks } from '../../src/components/appointment/booking-info';

const q = (id: string, pages?: ('home' | 'faq' | 'booking')[]) => ({ id, q: { tr: `S ${id}`, en: `Q ${id}` }, a: { tr: 'C', en: 'A' }, ...(pages ? { pages } : {}) });

describe('questions per page (owner 2026-10-21)', () => {
  it('a question without pages shows on home and the FAQ page, not on booking', () => {
    const faq = parseFaq([q('a'), q('b', ['booking']), q('c', ['home'])]);
    expect(answeredFaq(faq, 'tr', 'home').map((f) => f.id)).toEqual(['a', 'c']);
    expect(answeredFaq(faq, 'tr', 'faq').map((f) => f.id)).toEqual(['a']);
    expect(answeredFaq(faq, 'tr', 'booking').map((f) => f.id)).toEqual(['b']);
  });

  it('an answer written in the panel becomes paragraphs, a list and a heading', () => {
    expect(textBlocks('Bir.\nİki.\n\n- a\n- b\n\n### Başlık')).toEqual(['Bir. İki.', { ul: ['a', 'b'] }, { h: 'Başlık' }]);
  });
});

describe('Gizlilik ve Analitik', () => {
  it('older seo.json files stay valid; the new settings are optional', () => {
    const base = { siteName: { tr: 'a', en: 'a' }, defaultDescription: { tr: 'b', en: 'b' }, ogImage: '/og.jpg' };
    expect(() => parseSeo(base)).not.toThrow();
    expect(parseSeo({ ...base, noindex: true, noindexPages: ['faq'], counter: false, inject: [{ id: 'k', label: 'x', where: 'head', pages: 'posts', code: '<meta>', enabled: true }] }).noindexPages).toEqual(['faq']);
  });

  it('added code goes only on the chosen pages', () => {
    expect(injectionFits('all', '/iletisim/')).toBe(true);
    expect(injectionFits('home', '/en/')).toBe(true);
    expect(injectionFits('home', '/blog/')).toBe(false);
    expect(injectionFits('blog', '/blog/kategori/yasam/')).toBe(true);
    expect(injectionFits('posts', '/blog/kaygi-ile-yasamak/')).toBe(true);
    expect(injectionFits('posts', '/blog/')).toBe(false);
    expect(injectionFits('posts', '/en/blog/category/life/')).toBe(false);
    expect(injectionFits('other', '/hakkimda/')).toBe(true);
    expect(injectionFits('other', '/blog/x/')).toBe(false);
  });
});
