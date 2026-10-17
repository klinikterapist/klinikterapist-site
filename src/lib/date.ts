import type { Lang } from './settings';

/** Long date in the page language ("10 Mart 2026" / "March 10, 2026"). Dates are stored as UTC days. */
export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** `YYYY-MM-DD` for a `<time datetime>` attribute. */
export const isoDay = (date: Date): string => date.toISOString().slice(0, 10);
