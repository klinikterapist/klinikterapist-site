/**
 * Read counts per post. Stub until Panel v3 Plan C replaces readCount with the real counter data:
 * no data yet, so every count is unknown and nothing is shown. readsLabel is the display rule
 * (spec §5.8) and stays as it is.
 */
import type { Lang } from './settings';

export function readCount(_postKey: string): number | null {
  return null;
}

/** Below this many reads no number is shown. */
export const MIN_READS_SHOWN = 50;

const FORMAT: Record<Lang, { locale: string; thousand: string; million: string; word: string }> = {
  tr: { locale: 'tr-TR', thousand: 'B', million: 'M', word: 'okunma' },
  en: { locale: 'en-US', thousand: 'K', million: 'M', word: 'reads' },
};

/**
 * "980 okunma", "1,2B okunma", "12,5B okunma", "1,2M okunma" / "980 reads", "1.2K reads", "1.2M reads".
 * Null when there is no data or fewer than 50 reads: the caller then shows nothing at all.
 */
export function readsLabel(n: number | null, lang: Lang): string | null {
  if (n === null || !Number.isFinite(n) || n < MIN_READS_SHOWN) return null;
  const f = FORMAT[lang];
  const one = new Intl.NumberFormat(f.locale, { maximumFractionDigits: 1 });
  let num: string;
  if (n < 1000) num = String(Math.round(n));
  else {
    const k = Math.round(n / 100) / 10;
    // 999 960 rounds to 1000K: show it as 1M instead.
    num = k < 1000 ? `${one.format(k)}${f.thousand}` : `${one.format(Math.round(n / 100_000) / 10)}${f.million}`;
  }
  return `${num} ${f.word}`;
}
