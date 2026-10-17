/**
 * In-text citations in post Markdown, shared by the build and the admin panel. No `node:` imports.
 *
 * A citation is stored as `<cite data-refs="ray2004;smith2010~p~34" data-narrative>…</cite>`:
 * items are separated by `;`, each is `id` or `id~kind~value`; `data-narrative` only for narrative
 * citations. The inner text is generated from the references when the post is written.
 */
import { bibliography, formatReferenceHtml, type CiteItem, type LocatorKind, type Reference } from './apa';
import { t } from '../i18n/ui';
import type { Lang } from './schemas';

const ID = /^[A-Za-z0-9_-]+$/;
const KINDS: LocatorKind[] = ['p', 'pp', 'para', 'ch'];
/** Characters a locator value may not hold (they would break the attribute or the item syntax). */
const FORBIDDEN = /[;~"<>&\u0000-\u001f]/g;

/** The exact opening tag; anything else stays text. */
export const CITE_OPEN = /^<cite data-refs="([^"]*)"( data-narrative)?>$/;

export function parseCiteAttr(v: string): CiteItem[] | null {
  if (!v) return null;
  const items: CiteItem[] = [];
  for (const part of v.split(';')) {
    const bits = part.split('~');
    if (!ID.test(bits[0])) return null;
    if (bits.length === 1) {
      items.push({ id: bits[0] });
      continue;
    }
    const [id, kind, value] = bits;
    if (bits.length !== 3 || !KINDS.includes(kind as LocatorKind) || !value.trim() || value.search(FORBIDDEN) >= 0) return null;
    items.push({ id, locator: { kind: kind as LocatorKind, value } });
  }
  return items;
}

/** The `data-refs` value. Forbidden characters are dropped from locators; an emptied locator is left out. */
export function writeCiteAttr(items: CiteItem[]): string {
  return items
    .map((item) => {
      if (!ID.test(item.id)) throw new Error(`Geçersiz referans kimliği: "${item.id}"`);
      const value = item.locator?.value.replace(FORBIDDEN, '').trim();
      return item.locator && value ? `${item.id}~${item.locator.kind}~${value}` : item.id;
    })
    .join(';');
}

/** Opening cite tags that are not backslash-escaped. */
const CITE_TAG = /(?<=(?:^|[^\\])(?:\\\\)*)<cite data-refs="([^"]*)"( data-narrative)?>/g;

/** Ids cited anywhere in a post body. */
export function citedIds(markdown: string): Set<string> {
  const ids = new Set<string>();
  for (const m of markdown.matchAll(CITE_TAG)) {
    for (const item of parseCiteAttr(m[1]) ?? []) ids.add(item.id);
  }
  return ids;
}

/** Build check: every cited id must be in the post's reference list. */
export function validateCitations(body: string, refs: Reference[], file: string): void {
  const known = new Set(refs.map((r) => r.id));
  for (const id of citedIds(body)) {
    if (!known.has(id)) throw new Error(`${file}: metinde atıf yapılan "${id}" referansı kaynak listesinde yok.`);
  }
}

/** The Kaynakça / References section as HTML; empty when nothing is cited. */
export function renderReferencesSection(refs: Reference[], cited: Set<string>, lang: Lang): string {
  const bib = bibliography(refs, cited, lang);
  if (!bib.length) return '';
  const items = bib.map((r) => `<li>${formatReferenceHtml(r, bib, lang)}</li>`).join('');
  return (
    `<section class="references" aria-labelledby="references-title">` +
    `<h2 id="references-title">${t(lang, 'references')}</h2>` +
    `<ol class="references-list">${items}</ol></section>`
  );
}
