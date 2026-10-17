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

/** A citation names a reference the post does not have. */
export class UnknownReferenceError extends Error {
  constructor(readonly id: string) {
    super(`Metindeki bir atıf, referans listesinde olmayan "${id}" referansına işaret ediyor.`);
    this.name = 'UnknownReferenceError';
  }
}

/**
 * The safety boundary for citation items from a draft (Drive JSON is not shape-checked): an invalid
 * id throws; a locator with an unknown kind or a non-string value is left out; forbidden characters
 * are dropped from the value and an emptied locator is left out.
 */
export function sanitizeCiteItems(items: CiteItem[]): CiteItem[] {
  return items.map((item) => {
    const id: unknown = item?.id;
    if (typeof id !== 'string' || !ID.test(id)) throw new Error(`Geçersiz referans kimliği: "${String(id)}"`);
    const loc: unknown = item.locator;
    if (!loc || typeof loc !== 'object') return { id };
    const { kind, value } = loc as { kind?: unknown; value?: unknown };
    if (typeof kind !== 'string' || !KINDS.includes(kind as LocatorKind) || typeof value !== 'string') return { id };
    const clean = value.replace(FORBIDDEN, '').trim();
    return clean ? { id, locator: { kind: kind as LocatorKind, value: clean } } : { id };
  });
}

/** The `data-refs` value, from sanitized items. */
export function writeCiteAttr(items: CiteItem[]): string {
  return sanitizeCiteItems(items)
    .map((item) => (item.locator ? `${item.id}~${item.locator.kind}~${item.locator.value}` : item.id))
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
export function renderReferencesSection(refs: Reference[], cited: Set<string>, lang: Lang, headingId = 'references-title'): string {
  const bib = bibliography(refs, cited, lang);
  if (!bib.length) return '';
  const items = bib.map((r) => `<li>${formatReferenceHtml(r, bib, lang)}</li>`).join('');
  return (
    `<section class="references" aria-labelledby="${headingId}">` +
    `<h2 id="${headingId}">${t(lang, 'references')}</h2>` +
    `<ol class="references-list">${items}</ol></section>`
  );
}
