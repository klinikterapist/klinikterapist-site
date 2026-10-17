/** Helpers for the editor's "Sürüm geçmişi": restoring one language, and readable date labels. */
import type { Draft } from '../api/types';
import type { Lang } from '../../lib/schemas';

/**
 * The current draft with title, subtitle, text and references of `lang` taken from `version`.
 * Everything else (the other language, shared settings, SEO/slug fields, revision) stays as it is.
 */
export function restoreLang(current: Draft, version: Draft, lang: Lang): Draft {
  const { title, subtitle, doc, references } = version[lang];
  return { ...current, [lang]: { ...current[lang], title, subtitle, doc, references } };
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const two = (n: number) => String(n).padStart(2, '0');
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Bugün 14.32", "Dün 21.05" or "12 Ekim 09.10" (local time). */
export function relativeLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = `${two(d.getHours())}.${two(d.getMinutes())}`;
  const days = Math.round((dayStart(now) - dayStart(d)) / 86400e3);
  if (days === 0) return `Bugün ${time}`;
  if (days === 1) return `Dün ${time}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${time}`;
}
