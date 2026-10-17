/** The reference form's state (all plain strings) and its conversion to and from a `Reference`. */
import type { LocatorKind, Person, Reference, RefType, Year } from '../../../lib/apa';
import { parseDoi } from '../../lib/doi';

/** `suffix` ("Jr.") is kept from a lookup but has no field of its own. */
export type PersonRow = { org: boolean; family: string; given: string; literal: string; suffix?: string };

export type RefForm = {
  /** '' until the owner picks one (an unsupported DOI type). */
  type: RefType | '';
  authors: PersonRow[];
  editors: PersonRow[];
  year: string;
  title: string;
  container: string;
  volume: string;
  issue: string;
  pages: string;
  edition: string;
  publisher: string;
  url: string;
  accessed: string;
  doi: string;
};

export const TYPE_OPTIONS: { value: RefType; label: string }[] = [
  { value: 'article', label: 'Dergi makalesi' },
  { value: 'book', label: 'Kitap' },
  { value: 'chapter', label: 'Kitap bölümü' },
  { value: 'web', label: 'Web sayfası' },
];

/** Which optional fields each type shows, in order. */
export const TYPE_FIELDS: Record<RefType, (keyof RefForm)[]> = {
  article: ['container', 'volume', 'issue', 'pages'],
  book: ['edition', 'publisher'],
  chapter: ['editors', 'container', 'pages', 'edition', 'publisher'],
  web: ['container', 'url', 'accessed'],
};

export const emptyRow = (): PersonRow => ({ org: false, family: '', given: '', literal: '' });

export const emptyForm = (type: RefType | '' = 'article'): RefForm => ({
  type, authors: [emptyRow()], editors: [], year: '', title: '', container: '', volume: '', issue: '', pages: '',
  edition: '', publisher: '', url: '', accessed: '', doi: '',
});

const toRow = (p: Person): PersonRow =>
  'literal' in p ? { ...emptyRow(), org: true, literal: p.literal } : { ...emptyRow(), family: p.family, given: p.given ?? '', suffix: p.suffix };

const yearText = (y: Year) => (y === 'nd' ? 't.y.' : y === 'inpress' ? 'baskıda' : String(y));

export function formFromReference(ref: Reference, type: RefType | '' = ref.type): RefForm {
  return {
    ...emptyForm(type),
    authors: ref.authors.length ? ref.authors.map(toRow) : [emptyRow()],
    editors: (ref.editors ?? []).map(toRow),
    year: yearText(ref.year),
    title: ref.title,
    container: ref.container ?? '',
    volume: ref.volume ?? '',
    issue: ref.issue ?? '',
    pages: ref.pages ?? '',
    edition: ref.edition ?? '',
    publisher: ref.publisher ?? '',
    url: ref.url ?? '',
    accessed: ref.accessed ?? '',
    doi: ref.doi ?? '',
  };
}

/** A number, "t.y." / "n.d." or "baskıda" / "in press"; null otherwise. */
export function parseYear(input: string): Year | null {
  const v = input.trim().toLocaleLowerCase('tr');
  if (/^\d{1,4}$/.test(v)) return Number(v);
  if (/^(t\.?\s*y\.?|n\.?\s*d\.?|tarihsiz)$/.test(v)) return 'nd';
  if (/^(baskıda|in press)$/.test(v)) return 'inpress';
  return null;
}

export const YEAR_ERROR = 'Yıl bir sayı, "t.y." ya da "baskıda" olmalı.';
export const DOI_ERROR = "Bu bir DOI gibi görünmüyor. Boş bırakın ya da 10. ile başlayan DOI'yi yazın.";

/** The DOI field may be empty; otherwise it must be a DOI (bare, doi: or doi.org link). */
export const doiError = (input: string): string | null => (input.trim() && !parseDoi(input) ? DOI_ERROR : null);

/** Characters the stored citation cannot hold (see `sanitizeCiteItems`). */
const LOCATOR_FORBIDDEN = /[;~"<>&\u0000-\u001f]/;
export const LOCATOR_ERROR = 'Sayfa alanında ; ~ " < > & işaretleri kullanılamaz.';
export const locatorError = (page: string): string | null => (LOCATOR_FORBIDDEN.test(page) ? LOCATOR_ERROR : null);

function people(rows: PersonRow[]): Person[] {
  const out: Person[] = [];
  for (const r of rows) {
    if (r.org) {
      if (r.literal.trim()) out.push({ literal: r.literal.trim() });
    } else if (r.family.trim()) {
      const p: Person = { family: r.family.trim() };
      if (r.given.trim()) p.given = r.given.trim();
      if (r.suffix) p.suffix = r.suffix;
      out.push(p);
    }
  }
  return out;
}

/** The reference the form describes (without a final id), or null when it is not complete. */
export function referenceFromForm(f: RefForm, id = ''): Reference | null {
  const year = parseYear(f.year);
  if (!f.type || year === null || !f.title.trim() || doiError(f.doi)) return null;
  const ref: Reference = { id, type: f.type, authors: people(f.authors), year, title: f.title.trim() };
  const shown = new Set(TYPE_FIELDS[f.type]);
  if (shown.has('editors')) {
    const editors = people(f.editors);
    if (editors.length) ref.editors = editors;
  }
  for (const k of ['container', 'volume', 'issue', 'pages', 'edition', 'publisher', 'url', 'accessed'] as const) {
    if (shown.has(k) && f[k].trim()) ref[k] = f[k].trim();
  }
  if (ref.accessed && !/^\d{4}-\d{2}-\d{2}$/.test(ref.accessed)) delete ref.accessed;
  const doi = parseDoi(f.doi);
  if (doi) ref.doi = doi;
  return ref;
}

export const LOCATOR_OPTIONS: { value: LocatorKind; label: string }[] = [
  { value: 'p', label: 'Sayfa' },
  { value: 'pp', label: 'Sayfa aralığı' },
  { value: 'para', label: 'Paragraf' },
  { value: 'ch', label: 'Bölüm' },
];

const PREFIX: [RegExp, LocatorKind][] = [
  [/^(ss|pp)\.\s*/i, 'pp'],
  [/^(s|p)\.\s*/i, 'p'],
  [/^(para\.|paragraf)\s*/i, 'para'],
  [/^(bölüm|chapter|ch\.)\s*/i, 'ch'],
];

/** "s. 34" → page 34; "12-14" as a page → a page range. Empty → no locator. */
export function parseLocator(input: string, kind: LocatorKind): { kind: LocatorKind; value: string } | undefined {
  let v = input.trim();
  let k = kind;
  for (const [re, pk] of PREFIX) {
    if (re.test(v)) {
      v = v.replace(re, '');
      k = pk;
      break;
    }
  }
  v = v.trim();
  if (!v) return undefined;
  if (k === 'p' && /\d\s*[-–—]\s*\d/.test(v)) k = 'pp';
  return { kind: k, value: v };
}
