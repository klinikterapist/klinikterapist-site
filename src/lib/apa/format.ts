/** APA 7 reference and in-text citation formatting, shared by the site build and the admin panel. */
import type { Lang } from '../settings';
import { SAFE_LINK } from '../safe-link';
import { directName, familyOf, foldAscii, initials, invertedName } from './names';
import { TERMS, type Terms } from './terms';
import type { Citation, CiteItem, LocatorKind, Person, Reference, Year } from './types';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dashRange = (s: string) => s.trim().replace(/(\d)\s*[-–—]\s*(\d)/g, '$1–$2');
const isRange = (s: string) => /\d\s*[-–—]\s*\d/.test(s);
const endsWithStop = (s: string) => /[.?!]$/.test(s);
const endDot = (s: string) => (endsWithStop(s) ? s : `${s}.`);

/* ---------- sentence case ---------- */

const TURKISH_LETTERS = /[ğĞşŞıİçÇöÖüÜ]/;

/**
 * `How the Mind Hurts: The Body and APA` -> `How the mind hurts: The body and APA`. Acronyms, a lone "I"
 * and mixed-case words (per hyphen part) stay. Case mapping is Turkish when `lang` is 'tr' or the text has Turkish letters.
 */
export function sentenceCase(title: string, lang?: Lang): string {
  const tr = lang === 'tr' || (lang === undefined && TURKISH_LETTERS.test(title));
  const loc = tr ? 'tr' : undefined;
  const low = (x: string) => x.toLocaleLowerCase(loc);
  const up = (x: string) => x.toLocaleUpperCase(loc);
  const keep = (seg: string) => {
    const letters = seg.replace(/[^\p{L}]/gu, '');
    if (letters === 'I') return true;
    if (letters.length >= 2 && letters === up(letters) && letters !== low(letters)) return true;
    return /\p{Lu}/u.test(letters.slice(1));
  };
  let capitalise = true;
  return title
    .split(/(\s+)/)
    .map((part) => {
      if (!part.trim()) return part;
      const out = part
        .split('-')
        .map((seg, i) => {
          let r = keep(seg) ? seg : low(seg);
          if (i === 0 && capitalise) r = r.replace(/\p{L}/u, (c) => up(c));
          return r;
        })
        .join('-');
      capitalise = /[:?!]$/.test(part);
      return out;
    })
    .join('');
}

/* ---------- years, disambiguation ---------- */

const initialsOf = (p: Person) => ('given' in p && p.given ? initials(p.given) : '');
/** Same people: surname and initials (APA 8.19–8.20; J. Taylor and T. Taylor are two authors, not 2014a/b). */
const authorKey = (ref: Reference) =>
  ref.authors.length ? ref.authors.map((p) => `${familyOf(p)}/${initialsOf(p)}`).join('|') : ref.title;
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

/**
 * APA 8.20: when first authors of different references share a surname but not initials, the first
 * author's initials are written in every citation of those references (`J. M. Taylor & Neimeyer, 2015`).
 */
function firstAuthor(ref: Reference, refs: Reference[]): string {
  const first = ref.authors[0];
  const ini = initialsOf(first);
  const clash = ini && refs.some((r) => r.authors[0] && familyOf(r.authors[0]) === familyOf(first) && initialsOf(r.authors[0]) && initialsOf(r.authors[0]) !== ini);
  return clash ? `${ini} ${familyOf(first)}` : familyOf(first);
}

function citeAuthor(ref: Reference, refs: Reference[], t: Terms, narrative: boolean): string {
  const n = ref.authors.length;
  if (n === 0) return ref.title;
  const first = firstAuthor(ref, refs);
  if (n === 1) return first;
  if (n === 2) {
    return `${first} ${narrative ? t.andNarrative : t.and} ${familyOf(ref.authors[1])}`;
  }
  return `${first} ${t.etAl}`;
}

function locatorText(loc: NonNullable<CiteItem['locator']>, t: Terms): string {
  const label: Record<LocatorKind, string> = { p: t.p, pp: t.pp, para: t.para, ch: t.ch };
  const value = loc.kind === 'p' || loc.kind === 'pp' ? dashRange(loc.value) : loc.value.trim();
  return `${label[loc.kind]} ${value}`;
}

const yearRank = (y: Year) => (y === 'nd' ? -Infinity : y === 'inpress' ? Infinity : y);

const sortTitle = (title: string, lang: Lang) => (lang === 'en' ? title.replace(/^(a|an|the)\s+/i, '') : title);

/** APA 9.46: author lists compared one by one (surname, then initials); a list that is a prefix of another comes first. */
function compareRefs(a: Reference, b: Reference, lang: Lang): number {
  const keys = (r: Reference): [string, string][] =>
    r.authors.length
      ? r.authors.map((p): [string, string] => [familyOf(p), 'given' in p && p.given ? initials(p.given) : ''])
      : [[sortTitle(r.title, lang), '']];
  const ka = keys(a);
  const kb = keys(b);
  for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
    const c = ka[i][0].localeCompare(kb[i][0], lang) || ka[i][1].localeCompare(kb[i][1], lang);
    if (c) return c;
  }
  if (ka.length !== kb.length) return ka.length - kb.length;
  const ya = yearRank(a.year);
  const yb = yearRank(b.year);
  if (ya !== yb) return ya < yb ? -1 : 1;
  return sortTitle(a.title, lang).localeCompare(sortTitle(b.title, lang), lang);
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

  const byKey = new Map<string, { author: string; parts: string[] }>();
  for (const { ref, item } of items) {
    let part = yearLabel(ref, refs, lang);
    if (item.locator) part += `, ${locatorText(item.locator, t)}`;
    const key = authorKey(ref);
    const group = byKey.get(key);
    if (group) group.parts.push(part);
    else byKey.set(key, { author: citeAuthor(ref, refs, t, c.narrative), parts: [part] });
  }
  const groups = [...byKey.values()];

  if (c.narrative) {
    const texts = groups.map((g) => `${g.author} (${g.parts.join(', ')})`);
    if (texts.length < 2) return texts[0] ?? '';
    const serial = texts.length > 2 && lang === 'en' ? ',' : '';
    return `${texts.slice(0, -1).join(', ')}${serial} ${t.andNarrative} ${texts[texts.length - 1]}`;
  }
  return `(${groups.map((g) => `${g.author}, ${g.parts.join(', ')}`).join('; ')})`;
}

/* ---------- reference list ---------- */

/** Cited references only, in reference-list order. */
export function bibliography(refs: Reference[], citedIds: Set<string>, lang: Lang): Reference[] {
  return refs.filter((r) => citedIds.has(r.id)).sort((a, b) => compareRefs(a, b, lang));
}

function joinNames(names: string[], t: Terms, comma: boolean, twoComma = comma): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]}${twoComma ? ',' : ''} ${t.and} ${names[1]}`;
  const head = names.slice(0, -1).join(', ');
  return `${head}${comma ? ',' : ''} ${t.and} ${names[names.length - 1]}`;
}

function authorList(authors: Person[], t: Terms): string {
  const names = authors.map(invertedName);
  // APA 7 §9.8: up to 20 authors in full; 21 or more → the first 19, ". . .", the last.
  if (names.length >= 21) return `${names.slice(0, 19).join(', ')}, . . . ${names[names.length - 1]}`;
  // The comma before the last author belongs to the "&" form; Turkish "ve" takes none.
  return joinNames(names, t, t.and === '&');
}

function editorList(editors: Person[], t: Terms): string {
  const names = editors.map(directName);
  const label = editors.length > 1 ? t.eds : t.ed;
  return `${joinNames(names, t, t.and === '&', false)} ${label}`;
}

function ordinal(edition: string, t: Terms): string {
  const m = /^\s*(\d+)/.exec(edition);
  return m ? t.edition(Number(m[1])) : edition.trim();
}

function linkHtml(href: string, hrefEncoded = href): string {
  return `<a href="${esc(hrefEncoded)}">${esc(href)}</a>`;
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
    const book = ref.container ? `<i>${esc(ref.container)}</i>` : '';
    const editors = ref.editors?.length ? esc(editorList(ref.editors, t)) : '';
    const names = [editors, book].filter(Boolean).join(', ');
    let src = names ? `${esc(t.chapterBefore)}${names}${book ? esc(t.chapterAfter) : ''}` : '';
    if (src && inner.length) src += ` (${esc(inner.join(', '))})`;
    if (src) parts.push(`${src}.`);
  }

  if (ref.type === 'web' && ref.container) parts.push(esc(endDot(ref.container)));
  if (ref.publisher) parts.push(esc(endDot(ref.publisher)));

  if (ref.doi) {
    parts.push(linkHtml(`https://doi.org/${ref.doi}`, `https://doi.org/${encodeURI(ref.doi).replace(/#/g, '%23').replace(/\?/g, '%3F')}`));
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
