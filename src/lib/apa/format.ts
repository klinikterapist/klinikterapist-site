/** APA 7 reference and in-text citation formatting, shared by the site build and the admin panel. */
import type { Lang } from '../settings';
import { SAFE_LINK } from '../safe-link';
import { directName, familyOf, foldAscii, invertedName } from './names';
import { TERMS, type Terms } from './terms';
import type { Citation, CiteItem, LocatorKind, Person, Reference, Year } from './types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dashRange = (s: string) => s.trim().replace(/(\d)\s*[-–—]\s*(\d)/g, '$1–$2');
const isRange = (s: string) => /\d\s*[-–—]\s*\d/.test(s);
const endsWithStop = (s: string) => /[.?!]$/.test(s);
const endDot = (s: string) => (endsWithStop(s) ? s : `${s}.`);

/* ---------- sentence case ---------- */

const lower = (s: string) => s.replace(/İ/g, 'i').toLowerCase();

/** `How the Mind Hurts: The Body and APA` -> `How the mind hurts: The body and APA`. Acronyms and mixed-case words stay. */
export function sentenceCase(title: string): string {
  const parts = title.split(/(\s+)/);
  let capitalise = true;
  return parts
    .map((part) => {
      if (!part.trim()) return part;
      const letters = part.replace(/[^\p{L}]/gu, '');
      let out = part;
      const acronym = letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
      const mixed = /\p{Lu}/u.test(letters.slice(1));
      if (!acronym && !mixed) {
        out = lower(part);
        if (capitalise) out = out.replace(/\p{L}/u, (c) => (c === 'i' ? 'I' : c.toUpperCase()));
      }
      capitalise = /[:?!]$/.test(part);
      return out;
    })
    .join('');
}

/* ---------- years, disambiguation ---------- */

const authorKey = (ref: Reference) => (ref.authors.length ? ref.authors.map(familyOf).join('|') : ref.title);
const sameAuthorYear = (a: Reference, b: Reference) => authorKey(a) === authorKey(b) && a.year === b.year;

/** `a`, `b`… when several references share first author(s) and year; ordered by title. */
function yearSuffix(ref: Reference, refs: Reference[], lang: Lang): string {
  const group = refs.filter((r) => sameAuthorYear(r, ref));
  if (group.length < 2 || !group.some((r) => r.id === ref.id)) return '';
  const sorted = [...group].sort((a, b) => a.title.localeCompare(b.title, lang) || a.id.localeCompare(b.id));
  const i = sorted.findIndex((r) => r.id === ref.id);
  return i >= 0 && i < 26 ? String.fromCharCode(97 + i) : '';
}

function yearLabel(ref: Reference, refs: Reference[], lang: Lang): string {
  const t = TERMS[lang];
  const sfx = yearSuffix(ref, refs, lang);
  if (ref.year === 'nd') return sfx ? `${t.nd}-${sfx}` : t.nd;
  if (ref.year === 'inpress') return sfx ? `${t.inpress}-${sfx}` : t.inpress;
  return `${ref.year}${sfx}`;
}

/* ---------- in-text citations ---------- */

function citeAuthor(ref: Reference, t: Terms, narrative: boolean): string {
  const n = ref.authors.length;
  if (n === 0) return ref.title;
  if (n === 1) return familyOf(ref.authors[0]);
  if (n === 2) {
    return `${familyOf(ref.authors[0])} ${narrative ? t.andNarrative : t.and} ${familyOf(ref.authors[1])}`;
  }
  return `${familyOf(ref.authors[0])} ${t.etAl}`;
}

function locatorText(loc: NonNullable<CiteItem['locator']>, t: Terms): string {
  const label: Record<LocatorKind, string> = { p: t.p, pp: t.pp, para: t.para, ch: t.ch };
  const value = loc.kind === 'p' || loc.kind === 'pp' ? dashRange(loc.value) : loc.value.trim();
  return `${label[loc.kind]} ${value}`;
}

const yearRank = (y: Year) => (y === 'nd' ? -Infinity : y === 'inpress' ? Infinity : y);

function compareRefs(a: Reference, b: Reference, lang: Lang): number {
  const ka = a.authors.length ? familyOf(a.authors[0]) : a.title;
  const kb = b.authors.length ? familyOf(b.authors[0]) : b.title;
  const byName = ka.localeCompare(kb, lang);
  if (byName) return byName;
  const ya = yearRank(a.year);
  const yb = yearRank(b.year);
  if (ya !== yb) return ya < yb ? -1 : 1;
  return a.title.localeCompare(b.title, lang);
}

/** Plain-text citation, e.g. `(Ray, 2004; Smith ve Lee, 2010, s. 34)`. The caller escapes it. */
export function citationText(c: Citation, refs: Reference[], lang: Lang): string {
  const t = TERMS[lang];
  const items = c.items.map((item) => {
    const ref = refs.find((r) => r.id === item.id);
    if (!ref) throw new Error(`Bilinmeyen referans: ${item.id}`);
    return { ref, item };
  });
  items.sort((a, b) => compareRefs(a.ref, b.ref, lang));

  const groups: { author: string; parts: string[] }[] = [];
  for (const { ref, item } of items) {
    const author = citeAuthor(ref, t, c.narrative);
    let part = yearLabel(ref, refs, lang);
    if (item.locator) part += `, ${locatorText(item.locator, t)}`;
    const last = groups[groups.length - 1];
    if (last && last.author === author) last.parts.push(part);
    else groups.push({ author, parts: [part] });
  }

  if (c.narrative) {
    const texts = groups.map((g) => `${g.author} (${g.parts.join(', ')})`);
    if (texts.length < 2) return texts[0] ?? '';
    return `${texts.slice(0, -1).join(', ')} ${t.andNarrative} ${texts[texts.length - 1]}`;
  }
  return `(${groups.map((g) => `${g.author}, ${g.parts.join(', ')}`).join('; ')})`;
}

/* ---------- reference list ---------- */

/** Cited references only, in reference-list order. */
export function bibliography(refs: Reference[], citedIds: Set<string>, lang: Lang): Reference[] {
  return refs.filter((r) => citedIds.has(r.id)).sort((a, b) => compareRefs(a, b, lang));
}

function joinNames(names: string[], t: Terms, comma: boolean): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]}${comma ? ',' : ''} ${t.and} ${names[1]}`;
  const head = names.slice(0, -1).join(', ');
  return `${head}${comma ? ',' : ''} ${t.and} ${names[names.length - 1]}`;
}

function authorList(authors: Person[], t: Terms): string {
  const names = authors.map(invertedName);
  if (names.length > 21) return `${names.slice(0, 19).join(', ')}, . . . ${names[names.length - 1]}`;
  // The comma before the last author belongs to the "&" form; Turkish "ve" takes none.
  return joinNames(names, t, t.and === '&');
}

function editorList(editors: Person[], t: Terms): string {
  const names = editors.map(directName);
  const label = editors.length > 1 ? t.eds : t.ed;
  return `${joinNames(names, t, t.and === '&')} ${label}`;
}

function ordinal(edition: string, t: Terms): string {
  const m = /^\s*(\d+)/.exec(edition);
  return m ? t.edition(Number(m[1])) : edition.trim();
}

function linkHtml(href: string): string {
  return `<a href="${esc(href)}">${esc(href)}</a>`;
}

function accessedPrefix(accessed: string | undefined, t: Terms): string {
  const m = accessed ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(accessed) : null;
  if (!m) return '';
  return esc(t.retrieved(Number(m[3]), Number(m[2]), Number(m[1])));
}

/** One reference as escaped HTML. `refs` is the full list, needed for 2004a/2004b. */
export function formatReferenceHtml(ref: Reference, refs: Reference[], lang: Lang): string {
  const t = TERMS[lang];
  const hasAuthors = ref.authors.length > 0;
  const italicTitle = ref.type === 'book' || ref.type === 'web';

  // Title block: italic for books and web pages (with the edition), plain for articles and chapters.
  const edition = ref.type === 'book' && ref.edition ? ordinal(ref.edition, t) : '';
  let titleBlock: string;
  if (italicTitle) {
    const it = `<i>${esc(ref.title)}</i>`;
    titleBlock = edition ? `${it} (${esc(edition)}).` : endsWithStop(ref.title) ? it : `${it}.`;
  } else {
    titleBlock = esc(endDot(ref.title));
  }

  const lead = hasAuthors ? esc(endDot(authorList(ref.authors, t))) : titleBlock;
  const parts: string[] = [lead, `(${esc(yearLabel(ref, refs, lang))}).`];
  if (hasAuthors) parts.push(titleBlock);

  if (ref.type === 'article' && ref.container) {
    let src = `<i>${esc(ref.container)}${ref.volume ? `, ${esc(ref.volume)}` : ''}</i>`;
    if (ref.issue) src += `(${esc(ref.issue)})`;
    if (ref.pages) src += `, ${esc(dashRange(ref.pages))}`;
    parts.push(`${src}.`);
  } else if (ref.type === 'chapter') {
    const inner: string[] = [];
    if (ref.edition) inner.push(ordinal(ref.edition, t));
    if (ref.pages) {
      const label = isRange(ref.pages) ? t.pp : t.p;
      inner.push(`${label} ${dashRange(ref.pages)}`);
    }
    const book = `<i>${esc(ref.container ?? '')}</i>`;
    const editors = ref.editors?.length ? `${esc(editorList(ref.editors, t))}, ` : '';
    let src = `${esc(t.chapterBefore)}${editors}${book}${esc(t.chapterAfter)}`;
    if (!ref.container && !editors) src = '';
    if (src && inner.length) src += ` (${esc(inner.join(', '))})`;
    if (src) parts.push(`${src}.`);
  }

  if (ref.publisher) parts.push(esc(endDot(ref.publisher)));

  if (ref.doi) {
    parts.push(linkHtml(`https://doi.org/${ref.doi}`));
  } else if (ref.url) {
    const shown = SAFE_LINK.test(ref.url) ? linkHtml(ref.url) : esc(ref.url);
    parts.push(`${accessedPrefix(ref.accessed, t)}${shown}`);
  }

  return parts.join(' ');
}

/* ---------- ids ---------- */

/** `ray2004`, then `ray2004-2` when taken. Non-ASCII is folded; without an author the first title word is used. */
export function makeRefId(ref: Pick<Reference, 'authors' | 'year' | 'title'>, taken: Set<string>): string {
  const first = ref.authors[0];
  const source = first ? (('literal' in first ? first.literal.split(/\s+/)[0] : first.family) ?? '') : ref.title.trim().split(/\s+/)[0] ?? '';
  const name = foldAscii(source).replace(/[^a-z0-9]/g, '') || 'ref';
  const base = `${name}${ref.year}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`;
    if (!taken.has(id)) return id;
  }
}
