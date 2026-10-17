import type { Person } from './types';

/** Turkish and other Latin letters folded to ASCII, lower case. */
export function foldAscii(s: string): string {
  return s
    .replace(/İ/g, 'i')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

/** `Robert M.` -> `R. M.`, `Jean-Paul` -> `J.-P.` */
export function initials(given: string): string {
  return given
    .replace(/\.(?=\p{L})/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split('-')
        .filter(Boolean)
        .map((seg) => {
          const ch = [...seg][0] ?? '';
          return ch.toLocaleUpperCase('tr') === ch ? `${ch}.` : `${ch.toLocaleUpperCase()}.`;
        })
        .join('-'),
    )
    .join(' ');
}

export const isLiteral = (p: Person): p is { literal: string } => 'literal' in p;

/** Surname (or organisation name) as used for sorting and in-text citations. */
export const familyOf = (p: Person): string => (isLiteral(p) ? p.literal : p.family);

/** Reference-list form: `King, M. L., Jr.` */
export function invertedName(p: Person): string {
  if (isLiteral(p)) return p.literal;
  let out = p.family;
  const ini = p.given ? initials(p.given) : '';
  if (ini) out += `, ${ini}`;
  if (p.suffix) out += `, ${p.suffix}`;
  return out;
}

/** Editor form: `B. Demir` */
export function directName(p: Person): string {
  if (isLiteral(p)) return p.literal;
  const ini = p.given ? initials(p.given) : '';
  return [ini, p.family, p.suffix ? `, ${p.suffix}` : ''].filter(Boolean).join(' ').replace(' ,', ',');
}
