/**
 * Field patterns shared by the site's forms, the panel and the Apps Script backend (which checks
 * everything again). No imports, so every bundle can take it.
 */

/** An e-mail address as the forms take it: no spaces, quotes, brackets or list separators. */
export const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
/** A calendar day, `2026-10-24`. */
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** A wall-clock time, `19:20` (24-hour). */
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
