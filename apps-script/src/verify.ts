/**
 * The e-mail check (owner's request 2026-10-20: how do we know someone mistyped their address?).
 * The acknowledgement e-mail carries a link back to the page the person used, with a short signed
 * code; opening it calls `booking.verify`, and the panel then shows the address as checked. A
 * request whose address stays unchecked — or whose acknowledgement bounced back to the owner's
 * inbox — is likely mistyped. The code names only the record (`r:<id>` request, `w:<id>` list).
 */
import type { Gas } from './gas';
import { derive } from './seal';
import { pathFor } from '../../src/i18n/routes';
import { SITE, sameString } from './text';

export const VERIFY_PARAM = 'dogrula';

const tokenOf = (gas: Gas, ref: string) => gas.hmac(derive(gas, 'verify'), ref).slice(0, 22);

export function verifyLink(gas: Gas, ref: string, page: 'appointment' | 'preConsult', lang: 'tr' | 'en'): string {
  return `${SITE}${pathFor(page, lang)}?${VERIFY_PARAM}=${encodeURIComponent(`${ref}.${tokenOf(gas, ref)}`)}`;
}

/** The record a code names, or null when the code was not made here. */
export function refOf(gas: Gas, code: unknown): string | null {
  if (typeof code !== 'string' || code.length > 100) return null;
  const i = code.lastIndexOf('.');
  if (i < 3) return null;
  const ref = code.slice(0, i);
  const want = tokenOf(gas, ref);
  return sameString(want, code.slice(i + 1)) && /^[rw]:[\w-]{4,40}$/.test(ref) ? ref : null;
}

/** The lines for an acknowledgement e-mail. */
export function verifyLines(link: string, lang: 'tr' | 'en'): string[] {
  return lang === 'en'
    ? ['Please confirm that this e-mail address is right by opening this link (one click is enough):', link]
    : ['E-posta adresinizin doğru olduğunu onaylamak için lütfen bu bağlantıyı açın (bir tıklama yeterli):', link];
}
