/** DOI lookup: turns a DOI into an APA reference via doi.org content negotiation (CSL-JSON). */
import { makeRefId, sentenceCase, type Person, type Reference, type RefType, type Year } from '../../lib/apa';

export class DoiError extends Error {}

const NOT_FOUND = 'Bu DOI bulunamadı.';
const UNREACHABLE = 'DOI servisine ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';

/** Returns the bare DOI (no URL or "doi:" prefix), or null when the text is not a DOI. */
export function parseDoi(input: string): string | null {
  const s = input.trim().replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '');
  return /^10\.\d{4,9}\/\S+$/.test(s) ? s : null;
}

export async function fetchCsl(doi: string, fetchFn: typeof fetch = fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchFn(`https://doi.org/${doi}`, { headers: { Accept: 'application/vnd.citationstyles.csl+json' } });
  } catch {
    throw new DoiError(UNREACHABLE);
  }
  if (res.status === 404) throw new DoiError(NOT_FOUND);
  if (!res.ok) throw new DoiError(UNREACHABLE);
  try {
    return await res.json();
  } catch {
    throw new DoiError(UNREACHABLE);
  }
}

const TYPES = new Map<string, RefType>(Object.entries({
  'article-journal': 'article', article: 'article', 'article-magazine': 'article', 'article-newspaper': 'article',
  book: 'book', chapter: 'chapter', webpage: 'web', post: 'web', 'post-weblog': 'web',
} as Record<string, RefType>));

const str = (v: unknown): string | undefined => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === 'string' && x.trim() ? x.trim() : typeof x === 'number' ? String(x) : undefined;
};

function people(v: unknown): Person[] {
  if (!Array.isArray(v)) return [];
  const out: Person[] = [];
  for (const p of v as Record<string, unknown>[]) {
    const literal = str(p?.literal) ?? str(p?.name);
    const family = str(p?.family);
    if (family) {
      const person: Person = { family };
      const given = str(p.given);
      const suffix = str(p.suffix);
      if (given) person.given = given;
      if (suffix) person.suffix = suffix;
      out.push(person);
    } else if (literal) out.push({ literal });
  }
  return out;
}

function yearOf(csl: Record<string, unknown>): Year {
  const parts = (csl.issued as { 'date-parts'?: unknown[][] } | undefined)?.['date-parts'];
  const y = Number(parts?.[0]?.[0]);
  return Number.isInteger(y) && y > 0 ? y : 'nd';
}

export function cslToReference(csl: unknown, taken: Set<string>): { ref: Reference; unsupported: string | null } {
  const c = (csl ?? {}) as Record<string, unknown>;
  const cslType = str(c.type) ?? '';
  const mapped = TYPES.get(cslType);
  const lang = str(c.language)?.toLowerCase().startsWith('tr') ? 'tr' : undefined;
  const subtitle = str(c.subtitle);
  const title = sentenceCase([str(c.title) ?? '', subtitle].filter(Boolean).join(': '), lang);
  const authors = people(c.author);
  const year = yearOf(c);
  const ref: Reference = { id: makeRefId({ authors, year, title }, taken), type: mapped ?? 'book', authors, year, title };
  const editors = people(c.editor);
  if (editors.length) ref.editors = editors;
  const opt = (k: 'container' | 'volume' | 'issue' | 'pages' | 'edition' | 'publisher' | 'doi' | 'url', v: string | undefined) => {
    if (v) ref[k] = v;
  };
  opt('container', str(c['container-title']));
  opt('volume', str(c.volume));
  opt('issue', str(c.issue));
  opt('pages', str(c.page)?.replace(/\s*[-\u2010-\u2013]\s*/g, '–'));
  opt('edition', str(c.edition));
  opt('publisher', str(c.publisher));
  const doi = str(c.DOI);
  opt('doi', doi ? (parseDoi(doi) ?? doi) : undefined);
  opt('url', str(c.URL));
  const preprint =
    /preprint/i.test(`${str(c.subtype) ?? ''} ${str(c.genre) ?? ''}`) || cslType === 'posted-content' ||
    ((cslType === 'article' || cslType === 'article-journal') && !ref.container);
  return { ref, unsupported: preprint ? 'preprint' : mapped ? null : cslType || 'unknown' };
}
