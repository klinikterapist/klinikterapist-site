import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { keywordCount, runSeoChecks, type SeoCheck } from '../../../src/admin/lib/seo-check';
import { titlePixelWidth, truncateToWidth } from '../../../src/admin/lib/text-width';
import type { LangFields } from '../../../src/admin/api/types';
import type { Lang } from '../../../src/lib/schemas';

const text = (t: string, marks?: JSONContent['marks']): JSONContent => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const para = (...c: JSONContent[]): JSONContent => ({ type: 'paragraph', content: c });
const h = (level: 2 | 3, t: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [text(t)] });
const link = (label: string, href: string) => text(label, [{ type: 'link', attrs: { href } }]);
const fig = (alt: string): JSONContent => ({ type: 'figure', attrs: { src: './a.webp', alt, caption: '' } });
const words = (n: number, word = 'sakin') => Array.from({ length: n }, (_, i) => (i % 12 === 11 ? `${word}.` : word)).join(' ');
const STARTS = ['Bugün', 'Bazen', 'Sonra', 'Ayrıca', 'Belki', 'Yine', 'Şimdi', 'Elbette', 'Çoğu', 'Ardından'];
/** `n` paragraphs of `per` ten-word sentences, each starting with a different word. */
const prose = (n: number, per = 5): JSONContent[] =>
  Array.from({ length: n }, (_, p) =>
    para(text(Array.from({ length: per }, (_, i) => `${STARTS[(p * per + i) % STARTS.length]} ${words(9, 'sakin').replace(/\.$/, '')}.`).join(' '))),
  );

/** A post that passes every check (TR). */
function good(): LangFields {
  return {
    title: 'Kaygı ile yaşamak: Günlük hayatta küçük adımlarla başa çıkmak',
    seoTitle: '',
    slug: 'kaygi-ile-yasamak',
    slugTouched: true,
    description:
      'Kaygı herkesin yaşadığı bir duygudur. Bu yazıda kaygıyı tanımayı, bedendeki izlerini fark etmeyi ve günlük hayatta uygulanabilir adımları ele alıyoruz.',
    focusKeyword: 'kaygı',
    coverAlt: 'Yaprak',
    doc: {
      type: 'doc',
      content: [
        para(text('Kaygı bazen bir uyarı işaretidir. '), link('Hakkımda', '/hakkimda/'), text(' sayfasında yaklaşımımı anlatıyorum.')),
        h(2, 'Kaygının bedendeki izleri'),
        ...prose(6),
        fig('Nefes egzersizi çizimi'),
        h(3, 'Küçük adımlar'),
        para(text('Ayrıca bir kaynak önerisi: '), link('APA', 'https://www.apa.org/topics/anxiety')),
        ...prose(6),
        para(text('Kaygı geçicidir. Kaygı bir sinyaldir. Bu yüzden kaygı ile barışmak mümkün.')),
      ],
    },
  };
}

const run = (fields: LangFields, lang: Lang = 'tr', extra: { hasCover?: boolean; otherKeywords?: string[] } = {}) =>
  runSeoChecks({ lang, fields, hasCover: extra.hasCover ?? true, otherKeywords: extra.otherKeywords ?? [] });
const level = (checks: SeoCheck[], id: string) => checks.find((c) => c.id === id)?.level;

describe('runSeoChecks', () => {
  it('the good post is all green with score 100, and every check has a Turkish label and tip', () => {
    const { checks, score } = run(good());
    expect(checks.filter((c) => c.level !== 'green').map((c) => `${c.id}: ${c.tip}`)).toEqual([]);
    expect(score).toBe(100);
    for (const c of checks) {
      expect(c.label.length).toBeGreaterThan(3);
      expect(c.tip.length).toBeGreaterThan(3);
    }
  });

  it('keyword checks go red when the keyword is missing from that place', () => {
    const f = good();
    f.title = 'Günlük hayatta küçük adımlarla başa çıkmak üzerine bir yazı';
    f.slug = 'kucuk-adimlar';
    f.description = 'Bu yazıda bedendeki izleri fark etmeyi ve günlük hayatta uygulanabilir adımları ele alıyoruz, adım adım ve sakin bir dille.';
    f.doc.content![0] = para(text('Bazen bir uyarı işaretidir. '), link('Hakkımda', '/hakkimda/'));
    f.doc.content![1] = h(2, 'Bedendeki izler');
    const { checks } = run(f);
    for (const id of ['kw-title', 'kw-slug', 'kw-description', 'kw-first-paragraph']) expect(level(checks, id), id).toBe('red');
    expect(level(checks, 'kw-subheading')).toBe('red');
  });

  it('no subheadings at all is only yellow', () => {
    const f = good();
    f.doc.content = f.doc.content!.filter((n) => n.type !== 'heading');
    expect(level(run(f).checks, 'kw-subheading')).toBe('yellow');
  });

  it('an empty keyword turns the keyword checks red', () => {
    const f = good();
    f.focusKeyword = '';
    expect(level(run(f).checks, 'kw-title')).toBe('red');
  });

  it('density: too often is red, a little high is yellow', () => {
    const f = good();
    f.doc.content!.push(para(text(Array(40).fill('kaygı').join(' '))));
    expect(level(run(f).checks, 'kw-density')).toBe('red');
    const g = good();
    g.doc.content!.push(para(text(Array(12).fill('kaygı').join(' '))));
    expect(level(run(g).checks, 'kw-density')).toBe('yellow');
  });

  it('title and description lengths', () => {
    const f = good();
    f.seoTitle = 'Kaygı ile yaşamak: Günlük hayatta küçük adımlarla başa çıkmanın yolları ve öneriler';
    expect(level(run(f).checks, 'title-length')).toBe('red');
    f.seoTitle = '';
    f.description = 'Kaygı üzerine kısa bir yazı.';
    expect(level(run(f).checks, 'description-length')).toBe('red');
    f.description = 'Kaygı herkesin yaşadığı bir duygudur. Bu yazıda kaygıyı tanımayı ve günlük adımları ele alıyoruz biraz.';
    expect(level(run(f).checks, 'description-length')).toBe('yellow');
  });

  it('word count: under 600 is yellow, under 300 red', () => {
    const f = good();
    f.doc.content = [para(text(`Kaygı ${words(400)}`))];
    expect(level(run(f).checks, 'word-count')).toBe('yellow');
    f.doc.content = [para(text(`Kaygı ${words(100)}`))];
    expect(level(run(f).checks, 'word-count')).toBe('red');
  });

  it('an H3 before any H2 is a hierarchy warning', () => {
    const f = good();
    f.doc.content!.splice(1, 0, h(3, 'Erken alt başlık'));
    expect(level(run(f).checks, 'headings')).toBe('yellow');
  });

  it('images: missing alt is red, no images yellow', () => {
    const f = good();
    f.doc.content!.push(fig(''));
    expect(level(run(f).checks, 'image-alt')).toBe('red');
    f.doc.content = f.doc.content!.filter((n) => n.type !== 'figure');
    expect(level(run(f).checks, 'image-alt')).toBe('yellow');
  });

  it('links: internal accepts the full site address; missing links are yellow', () => {
    const f = good();
    f.doc.content![0] = para(text('Kaygı bazen bir uyarıdır. '), link('Blog', 'https://klinikterapist.com/blog/'));
    expect(level(run(f).checks, 'internal-link')).toBe('green');
    f.doc.content![0] = para(text('Kaygı bazen bir uyarıdır.'));
    expect(level(run(f).checks, 'internal-link')).toBe('yellow');
    f.doc.content = f.doc.content!.filter((n) => !JSON.stringify(n).includes('apa.org'));
    expect(level(run(f).checks, 'external-link')).toBe('yellow');
  });

  it('readability: long sentences, long paragraphs and repeated sentence starts', () => {
    const f = good();
    f.doc.content!.push(para(text(Array(40).fill(`${words(25, 'uzun').replace(/\./g, '')}.`).join(' '))));
    const checks = run(f).checks;
    expect(level(checks, 'sentence-length')).not.toBe('green');
    expect(level(checks, 'paragraph-length')).toBe('yellow');
    const g = good();
    g.doc.content!.push(para(text('Sonra yürüdüm. Sonra durdum. Sonra baktım.')));
    expect(level(run(g).checks, 'sentence-starts')).toBe('yellow');
  });

  it('a keyword used by another post is a warning, ignoring case', () => {
    expect(level(run(good(), 'tr', { otherKeywords: ['KAYGI'] }).checks, 'kw-unique')).toBe('yellow');
  });

  it('a missing cover is a warning for the social preview', () => {
    expect(level(run(good(), 'tr', { hasCover: false }).checks, 'cover')).toBe('yellow');
  });

  it('score: mean of green 1, yellow 0.5, red 0', () => {
    const f = good();
    f.focusKeyword = '';
    const { checks, score } = run(f);
    const v = { green: 1, yellow: 0.5, red: 0 } as const;
    expect(score).toBe(Math.round((100 * checks.reduce((s, c) => s + v[c.level], 0)) / checks.length));
  });
});

describe('keywordCount (Turkish suffixes and dotted I)', () => {
  it('matches Turkish suffixes and apostrophes', () => {
    expect(keywordCount('Kaygının bedeni ve kaygı', 'kaygı', 'tr')).toBe(2);
    expect(keywordCount("Kaygı'nın izleri", 'kaygı', 'tr')).toBe(1);
    expect(keywordCount('İlişkiler zordur', 'ilişki', 'tr')).toBe(1);
    expect(keywordCount('ilişkiler zordur', 'İlişki', 'tr')).toBe(1);
    expect(keywordCount('KAYGI', 'kaygı', 'tr')).toBe(1);
  });
  it('matches phrases word by word and needs a word start', () => {
    expect(keywordCount('Küçük adımlarla ilerlemek', 'küçük adım', 'tr')).toBe(1);
    expect(keywordCount('anksiyete', 'yete', 'tr')).toBe(0);
  });
  it('English allows plurals only', () => {
    expect(keywordCount('Habits and a habit', 'habit', 'en')).toBe(2);
    expect(keywordCount('habitat', 'habit', 'en')).toBe(0);
  });
});

describe('titlePixelWidth', () => {
  it('a typical 60-character title fits, a 75-character one does not', () => {
    const t60 = 'Kaygı ile yaşamak: Günlük hayatta küçük adımlarla başa çıkma';
    expect(t60.length).toBe(60);
    expect(titlePixelWidth(t60)).toBeLessThanOrEqual(580);
    expect(titlePixelWidth(`${t60} yolları üzerine`)).toBeGreaterThan(650);
  });
  it('truncateToWidth adds an ellipsis only when needed', () => {
    expect(truncateToWidth('Kısa', 580)).toBe('Kısa');
    const cut = truncateToWidth('a'.repeat(200), 100);
    expect(cut.endsWith('…')).toBe(true);
    expect(titlePixelWidth(cut)).toBeLessThanOrEqual(100);
  });
});
