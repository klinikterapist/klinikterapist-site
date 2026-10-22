import type { About, Lang } from './settings';

/** Theory and practice hours of every education card, rounded down (shown with a "+"). */
export function educationTotals(education: About['education']): { theory: number; practice: number } {
  const items = education?.groups.flatMap((g) => g.items) ?? [];
  return {
    theory: Math.floor(items.reduce((s, i) => s + i.theory, 0)),
    practice: Math.floor(items.reduce((s, i) => s + i.practice, 0)),
  };
}

/** A number in the page language: 1.930 / 8,5 in Turkish, 1,930 / 8.5 in English. */
export const formatNumber = (n: number, lang: Lang) =>
  n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { maximumFractionDigits: 1 });
