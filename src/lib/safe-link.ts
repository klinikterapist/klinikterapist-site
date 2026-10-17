/** The site's link rule: https, mailto, or a site path (but not `//host` or `/\host`, which browsers treat as protocol-relative). */
export const SAFE_LINK = /^(https:\/\/|mailto:|\/(?![\/\\]))/i;
