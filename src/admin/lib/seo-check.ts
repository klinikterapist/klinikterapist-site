/**
 * Live SEO checks for one language of a post (spec §8.2). Each check is a light with a one-line
 * Turkish tip. Red lights never block publishing.
 */
import type { JSONContent } from '@tiptap/core';
import type { LangFields } from '../api/types';
import type { Lang } from '../../lib/schemas';
import { slugify } from '../../lib/slug';
import { titlePixelWidth } from './text-width';

export type SeoLevel = 'green' | 'yellow' | 'red';
export type SeoCheck = { id: string; level: SeoLevel; label: string; tip: string };

const SITE_HOST = 'https://klinikterapist.com';
const LONG_SENTENCE: Record<Lang, number> = { tr: 16, en: 20 };
const LONG_PARAGRAPH: Record<Lang, number> = { tr: 120, en: 150 };

const lower = (s: string, lang: Lang) => s.toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US').replace(/i̇/g, 'i');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Occurrences of the focus keyword, allowing Turkish suffixes (`kaygının`) or English plurals. */
export function keywordCount(text: string, keyword: string, lang: Lang): number {
  const words = lower(keyword, lang).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const suffix = lang === 'tr' ? "(?:\\p{L}*(?:['’]\\p{L}+)?)" : "(?:s|es|'s|’s)?";
  const body = words.map((w) => escapeRe(w) + suffix).join('\\s+');
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'gu');
  return lower(text, lang).match(re)?.length ?? 0;
}

type Analysis = {
  paragraphs: string[];
  headings: { level: number; text: string }[];
  figures: { alt: string }[];
  links: string[];
  text: string;
};

function textOf(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  return (node.content ?? []).map(textOf).join('');
}

function analyse(doc: JSONContent): Analysis {
  const a: Analysis = { paragraphs: [], headings: [], figures: [], links: [], text: '' };
  const walk = (n: JSONContent) => {
    if (n.type === 'paragraph') {
      const t = textOf(n).trim();
      if (t) a.paragraphs.push(t);
    } else if (n.type === 'heading') {
      a.headings.push({ level: Number(n.attrs?.level ?? 2), text: textOf(n) });
    } else if (n.type === 'figure') {
      a.figures.push({ alt: String(n.attrs?.alt ?? '') });
    }
    if (n.type === 'text') {
      for (const m of n.marks ?? []) if (m.type === 'link' && m.attrs?.href) a.links.push(String(m.attrs.href));
    }
    n.content?.forEach(walk);
  };
  walk(doc);
  a.text = [...a.headings.map((h) => h.text), ...a.paragraphs].join(' ');
  return a;
}

const wordsIn = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const sentencesIn = (s: string) => s.split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter((x) => wordsIn(x).length > 0);

const VALUE: Record<SeoLevel, number> = { green: 1, yellow: 0.5, red: 0 };

export function runSeoChecks(input: { lang: Lang; fields: LangFields; hasCover: boolean; otherKeywords: string[] }): {
  checks: SeoCheck[];
  score: number;
} {
  const { lang, fields: f } = input;
  const a = analyse(f.doc);
  const kw = f.focusKeyword.trim();
  const seoTitle = (f.seoTitle || f.title).trim();
  const checks: SeoCheck[] = [];
  const add = (id: string, level: SeoLevel, label: string, tip: string) => checks.push({ id, level, label, tip });
  const has = (s: string) => !!kw && keywordCount(s, kw, lang) > 0;
  const noKw = 'Önce bir odak kelime yazın.';

  // Focus keyword placement.
  add('kw-title', has(seoTitle) ? 'green' : 'red', 'Odak kelime başlıkta', !kw ? noKw : has(seoTitle) ? 'Başlık odak kelimeyi içeriyor.' : 'Odak kelimeyi SEO başlığına ekleyin.');
  const kwSlug = slugify(kw, lang);
  const inSlug = !!kwSlug && f.slug.includes(kwSlug);
  add('kw-slug', inSlug ? 'green' : 'red', "Odak kelime URL'de", !kw ? noKw : inSlug ? 'URL odak kelimeyi içeriyor.' : `URL kısa adına "${kwSlug}" ekleyin.`);
  add(
    'kw-description',
    has(f.description) ? 'green' : 'red',
    'Odak kelime meta açıklamada',
    !kw ? noKw : has(f.description) ? 'Meta açıklama odak kelimeyi içeriyor.' : 'Odak kelimeyi meta açıklamaya ekleyin.',
  );
  const first = a.paragraphs[0] ?? '';
  add(
    'kw-first-paragraph',
    has(first) ? 'green' : 'red',
    'Odak kelime ilk paragrafta',
    !kw ? noKw : has(first) ? 'İlk paragraf odak kelimeyle başlıyor.' : 'Odak kelimeyi ilk paragrafta kullanın.',
  );
  const subs = a.headings.filter((h) => h.level === 2 || h.level === 3);
  const inSub = subs.some((h) => has(h.text));
  add(
    'kw-subheading',
    inSub ? 'green' : subs.length === 0 ? 'yellow' : 'red',
    'Odak kelime bir alt başlıkta',
    !kw ? noKw : inSub ? 'En az bir alt başlık odak kelimeyi içeriyor.' : subs.length === 0 ? 'Yazıya alt başlıklar (H2) ekleyin.' : 'Alt başlıklardan birinde odak kelimeyi kullanın.',
  );

  const total = wordsIn(a.text).length;
  const kwWords = kw ? kw.split(/\s+/).length : 0;
  const density = total ? (keywordCount(a.text, kw, lang) * kwWords * 100) / total : 0;
  const dLevel: SeoLevel = density >= 0.5 && density <= 2.5 ? 'green' : (density >= 0.2 && density < 0.5) || (density > 2.5 && density <= 3.5) ? 'yellow' : 'red';
  add(
    'kw-density',
    kw ? dLevel : 'red',
    `Odak kelime yoğunluğu (%${density.toFixed(1).replace(".", ",")})`,
    !kw ? noKw : dLevel === 'green' ? 'Yoğunluk makul.' : density < 0.5 ? 'Odak kelimeyi metinde biraz daha sık kullanın.' : 'Odak kelimeyi daha az tekrarlayın; doğal yazın.',
  );

  // Lengths.
  const px = titlePixelWidth(seoTitle);
  const tLevel: SeoLevel = !seoTitle ? 'red' : px >= 400 && px <= 580 ? 'green' : (px >= 300 && px < 400) || (px > 580 && px <= 650) ? 'yellow' : 'red';
  add(
    'title-length',
    tLevel,
    `SEO başlığı uzunluğu (${seoTitle.length} karakter)`,
    tLevel === 'green' ? 'Başlık uzunluğu iyi.' : !seoTitle ? 'Bir başlık yazın.' : px < 400 ? 'Başlığı biraz uzatın (yaklaşık 50–60 karakter).' : 'Başlığı kısaltın; Google sonunu kesecek.',
  );
  const dl = f.description.trim().length;
  const descLevel: SeoLevel = dl >= 120 && dl <= 158 ? 'green' : (dl >= 70 && dl < 120) || (dl > 158 && dl <= 175) ? 'yellow' : 'red';
  add(
    'description-length',
    descLevel,
    `Meta açıklama uzunluğu (${dl} karakter)`,
    descLevel === 'green' ? 'Açıklama uzunluğu iyi.' : dl < 120 ? 'Açıklamayı 120–158 karaktere uzatın.' : 'Açıklamayı 158 karakterin altına indirin.',
  );
  add(
    'word-count',
    total >= 600 ? 'green' : total >= 300 ? 'yellow' : 'red',
    `Yazı uzunluğu (${total} kelime)`,
    total >= 600 ? 'Yazı yeterince kapsamlı.' : 'En az 600 kelimelik yazılar aramalarda daha iyi sonuç verir.',
  );

  // Structure.
  const firstH2 = a.headings.findIndex((h) => h.level === 2);
  const earlyH3 = a.headings.findIndex((h) => h.level === 3);
  const badOrder = earlyH3 !== -1 && (firstH2 === -1 || earlyH3 < firstH2);
  add('headings', badOrder ? 'yellow' : 'green', 'Başlık sırası', badOrder ? 'H3 alt başlıktan önce bir H2 kullanın.' : 'Başlıklar doğru sırada.');
  const noAlt = a.figures.filter((x) => !x.alt.trim()).length;
  add(
    'image-alt',
    a.figures.length === 0 ? 'yellow' : noAlt ? 'red' : 'green',
    'Görsel alt metinleri',
    a.figures.length === 0 ? 'Bir görsel eklemek okumayı kolaylaştırır.' : noAlt ? `${noAlt} görselin alt metni yok; ekleyin.` : 'Bütün görsellerin alt metni var.',
  );
  const internal = a.links.some((h) => h.startsWith('/') || h.startsWith(SITE_HOST));
  const external = a.links.some((h) => /^https?:\/\//.test(h) && !h.startsWith(SITE_HOST));
  add('internal-link', internal ? 'green' : 'yellow', 'Site içi bağlantı', internal ? 'Site içinde başka bir sayfaya bağlantı var.' : 'Sitenizdeki başka bir yazıya ya da sayfaya bağlantı verin.');
  add('external-link', external ? 'green' : 'yellow', 'Dış kaynak bağlantısı', external ? 'Güvenilir bir kaynağa bağlantı var.' : 'Güvenilir bir dış kaynağa (araştırma, kurum) bağlantı verin.');

  // Readability.
  const sentences = a.paragraphs.flatMap(sentencesIn);
  const long = sentences.filter((s) => wordsIn(s).length > LONG_SENTENCE[lang]).length;
  const share = sentences.length ? long / sentences.length : 0;
  add(
    'sentence-length',
    share <= 0.25 ? 'green' : share <= 0.35 ? 'yellow' : 'red',
    'Cümle uzunluğu',
    share <= 0.25 ? 'Cümleler okunaklı uzunlukta.' : `Cümlelerin %${Math.round(share * 100)}'i uzun (${LONG_SENTENCE[lang]}+ kelime); bazılarını bölün.`,
  );
  const longParas = a.paragraphs.filter((p) => wordsIn(p).length > LONG_PARAGRAPH[lang]).length;
  add(
    'paragraph-length',
    longParas ? 'yellow' : 'green',
    'Paragraf uzunluğu',
    longParas ? `${longParas} paragraf çok uzun (${LONG_PARAGRAPH[lang]}+ kelime); bölün.` : 'Paragraflar okunaklı uzunlukta.',
  );
  let run = 1;
  let repeated = false;
  for (let i = 1; i < sentences.length; i++) {
    const firstWord = (s: string) => lower(wordsIn(s)[0] ?? '', lang).replace(/[^\p{L}\p{N}]/gu, '');
    run = firstWord(sentences[i]) && firstWord(sentences[i]) === firstWord(sentences[i - 1]) ? run + 1 : 1;
    if (run >= 3) repeated = true;
  }
  add('sentence-starts', repeated ? 'yellow' : 'green', 'Cümle başları', repeated ? 'Art arda üç cümle aynı kelimeyle başlıyor; çeşitlendirin.' : 'Cümle başları çeşitli.');

  const used = !!kw && input.otherKeywords.some((o) => lower(o.trim(), lang) === lower(kw, lang));
  add('kw-unique', used ? 'yellow' : 'green', 'Odak kelime daha önce kullanılmamış', used ? 'Bu odak kelimeyi başka bir yazıda da kullandınız; iki yazı birbiriyle yarışır.' : 'Bu odak kelime yeni.');
  add('cover', input.hasCover ? 'green' : 'yellow', 'Kapak görseli', input.hasCover ? 'Paylaşımlarda kapak görseli görünecek.' : 'Bir kapak görseli ekleyin; paylaşımlarda daha çok tıklanır.');

  const score = Math.round((100 * checks.reduce((s, c) => s + VALUE[c.level], 0)) / checks.length);
  return { checks, score };
}
