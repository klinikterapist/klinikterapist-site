/** Small helpers the backend's actions share. */

export const SITE = 'https://klinikterapist.com';
export const PANEL_URL = `${SITE}/admin/`;

/** A string field of the request, '' for anything else. */
export const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** One line, for an e-mail subject and the header-like lines of a body. */
export const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** Length-independent comparison, so a signature cannot be found character by character. */
export function sameString(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
