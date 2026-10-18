/** The site's link rule: https, mailto, or a site path (but not `//host` or `/\host`, which browsers treat as protocol-relative). */
export const SAFE_LINK = /^(https:\/\/|mailto:|\/(?![\/\\]))/i;

/** An absolute http(s) address: another site, opened in a new tab. A site path stays in the same tab. */
export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** `target`/`rel` for a link that leaves the site; nothing for a link within it. */
export function newTabAttrs(url: string): { target?: '_blank'; rel?: string } {
  return isExternalUrl(url) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}
