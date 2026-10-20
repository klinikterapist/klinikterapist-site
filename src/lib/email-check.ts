/**
 * Guarding against a mistyped e-mail address (owner's request 2026-10-20). Three layers, of which
 * this file is the first: a "did you mean …?" hint for a domain one or two letters off a common
 * one (gmial.com → gmail.com), then the address typed twice on the site's forms, then the link in
 * the acknowledgement e-mail that marks the address as checked in the panel.
 */

const DOMAINS = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.tr', 'outlook.com', 'outlook.com.tr', 'live.com', 'msn.com', 'windowslive.com', 'yahoo.com',
  'yahoo.com.tr', 'icloud.com', 'me.com', 'yandex.com', 'yandex.com.tr', 'protonmail.com', 'proton.me', 'mynet.com',
];

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** The address with a common domain in place of a near miss, or null when it looks right. */
export function suggestEmail(email: string): string | null {
  const at = email.trim().lastIndexOf('@');
  if (at < 1) return null;
  const local = email.trim().slice(0, at);
  const domain = email.trim().slice(at + 1).toLowerCase();
  if (!domain || DOMAINS.includes(domain)) return null;
  let best: string | null = null;
  let bestD = 3;
  for (const d of DOMAINS) {
    const n = distance(domain, d);
    if (n < bestD) [best, bestD] = [d, n];
  }
  // Short domains need a closer match, so a real small domain is not "corrected".
  if (!best || bestD > (domain.length < 8 ? 1 : 2)) return null;
  return `${local}@${best}`;
}

export const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
