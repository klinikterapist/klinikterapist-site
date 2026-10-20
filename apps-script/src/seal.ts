/**
 * Sealing for the files that hold people's details (owner's request 2026-10-20: the e-mail
 * addresses kept for Randevu talepleri and Seans takip must stay private and safe).
 *
 * The files live in the owner's own Drive; on top of that their contents are encrypted, so a copy
 * that leaves the account (a share by mistake, a download, a sync) is unreadable without the key.
 * The key is a random secret in the script's properties (`SEAL_KEY`), made on first use; it never
 * goes to the panel or the site.
 *
 * Apps Script has no AES, so the cipher is built on HMAC-SHA256, which it does have: a keystream of
 * HMAC(encKey, nonce:i) blocks XOR'd with the UTF-8 text, then an HMAC tag over nonce and
 * ciphertext (encrypt-then-MAC). Token: `s1.<nonce>.<ciphertext>.<tag>`, base64url.
 */
import type { Gas } from './gas';

const KEY_PROP = 'SEAL_KEY';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function fromUtf8(bytes: number[]): string {
  let s = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    let c: number;
    if (b < 0x80) (c = b), (i += 1);
    else if (b < 0xe0) (c = ((b & 31) << 6) | (bytes[i + 1] & 63)), (i += 2);
    else if (b < 0xf0) (c = ((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)), (i += 3);
    else (c = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63)), (i += 4);
    s += String.fromCodePoint(c);
  }
  return s;
}

function toB64(bytes: number[]): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) s += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) s += B64[n & 63];
  }
  return s;
}

function fromB64(text: string): number[] {
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of text) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('bad base64');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 255);
    }
  }
  return out;
}

function keys(gas: Gas): { enc: string; mac: string } {
  let key = gas.props.get(KEY_PROP);
  if (!key) {
    key = `${gas.uuid()}${gas.uuid()}`.replace(/-/g, '');
    gas.props.set(KEY_PROP, key);
  }
  return { enc: gas.hmac(key, 'seal:enc'), mac: gas.hmac(key, 'seal:mac') };
}

function xor(gas: Gas, enc: string, nonce: string, data: number[]): number[] {
  const out: number[] = new Array(data.length);
  let block: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i % 32 === 0) block = fromB64(gas.hmac(enc, `${nonce}:${i / 32}`));
    out[i] = data[i] ^ block[i % 32];
  }
  return out;
}

const equal = (a: string, b: string) => {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export function seal(gas: Gas, text: string): string {
  const { enc, mac } = keys(gas);
  const nonce = gas.uuid().replace(/-/g, '');
  const ct = toB64(xor(gas, enc, nonce, utf8(text)));
  return `s1.${nonce}.${ct}.${gas.hmac(mac, `${nonce}.${ct}`)}`;
}

/** The text, or null when the token was changed, made with another key or is not a token. */
export function unseal(gas: Gas, token: string): string | null {
  const [v, nonce, ct, tag] = token.split('.');
  if (v !== 's1' || !nonce || ct === undefined || !tag) return null;
  const { enc, mac } = keys(gas);
  if (!equal(gas.hmac(mac, `${nonce}.${ct}`), tag)) return null;
  try {
    return fromUtf8(xor(gas, enc, nonce, fromB64(ct)));
  } catch {
    return null;
  }
}

/** A secret for one purpose (e.g. the e-mail check links), derived from the same key. */
export function derive(gas: Gas, purpose: string): string {
  return gas.hmac(keys(gas).mac, `derive:${purpose}`);
}
