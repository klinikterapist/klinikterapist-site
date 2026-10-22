/**
 * Headings in title case (owner's decision 2026-10-22: "Tüm sitede başlıklar kelimenin baş harflerini büyük").
 * Every word starts with a capital, in the page language (i → İ in Turkish), except short joining words after the
 * first word (ve, ile, ya da… / and, of, the…). The rest of a word is left as written ("BDT", "Instagram'da"), and the
 * brand name "klinikterapist" keeps its lower case.
 */
import type { Lang } from './settings';

const SMALL: Record<Lang, Set<string>> = {
  tr: new Set(['ve', 'ile', 'ya', 'da', 'de', 'ki', 'veya', 'yahut', 'mi', 'mı', 'mu', 'mü']),
  en: new Set(['a', 'an', 'the', 'and', 'or', 'nor', 'but', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'as', 'vs']),
};
const KEEP = new Set(['klinikterapist']);

export function titleCase(text: string, lang: Lang): string {
  const locale = lang === 'tr' ? 'tr-TR' : 'en-GB';
  let first = true;
  return text.replace(/[^\s]+/g, (word) => {
    const bare = word.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '').toLocaleLowerCase(locale);
    const wasFirst = first;
    if (/[\p{L}\d]/u.test(word)) first = false;
    if (!bare || KEEP.has(bare) || (!wasFirst && SMALL[lang].has(bare))) return word;
    return word.replace(/\p{L}/u, (ch) => ch.toLocaleUpperCase(locale));
  });
}

/**
 * Title-cases the text of every <h1>–<h4> in a page of HTML, leaving tags, attributes and entities alone. Headings inside
 * a blog post's body (`<div class="prose">`) are the author's own and stay as written.
 */
export function titleCaseHeadings(html: string, lang: Lang): string {
  const proseStart = html.indexOf('<div class="prose"');
  const proseEnd = proseStart >= 0 ? html.indexOf('</article>', proseStart) : -1;
  return html.replace(/<(h[1-4])\b([^>]*)>([\s\S]*?)<\/\1>/g, (whole, tag: string, attrs: string, inner: string, at: number) => {
    if (proseStart >= 0 && at > proseStart && (proseEnd < 0 || at < proseEnd)) return whole;
    // Only text between tags changes. Entities (&amp;, &#39;) are swapped for placeholders meanwhile, so "I&#39;m" stays
    // one word and the entity itself is never touched.
    const out = inner.replace(/(^|>)([^<]+)/g, (_m: string, gt: string, text: string) => {
      const entities: string[] = [];
      const plain = text.replace(/&[#\w]+;/g, (e) => String.fromCharCode(0xe000 + entities.push(e) - 1));
      return gt + titleCase(plain, lang).replace(/[-]/g, (c) => entities[c.charCodeAt(0) - 0xe000]);
    });
    return `<${tag}${attrs}>${out}</${tag}>`;
  });
}
