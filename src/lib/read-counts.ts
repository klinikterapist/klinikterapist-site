/**
 * Read counts per post from the anonymous counter (Panel v3 Plan C). The live build fetches them
 * into src/generated/read-counts.json (scripts/fetch-read-counts.mjs, daily); without that file every
 * count is unknown and nothing is shown. readsLabel is the display rule (spec §5.8).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Lang } from './settings';

function load(): Record<string, number> {
  if (process.env.READ_COUNTS === '0') return {};
  const file = join(process.cwd(), 'src/generated/read-counts.json');
  try {
    if (!existsSync(file)) return {};
    const counts = (JSON.parse(readFileSync(file, 'utf8')) as { counts?: Record<string, number> }).counts;
    return counts && typeof counts === 'object' ? counts : {};
  } catch {
    return {};
  }
}

let cache: Record<string, number> | null = null;

/**
 * On the dev server every count starts at 100 (owner's review 2026-10-19, item 4), so the owner can
 * see how the counters look before there are real reads. Never in a build or in tests.
 */
const DEMO_START = import.meta.env?.DEV && !process.env.VITEST ? 100 : 0;

/** Reads of a post (both languages together), or null when unknown. */
export function readCount(postKey: string): number | null {
  cache ??= load();
  const n = cache[postKey];
  if (DEMO_START) return DEMO_START + (typeof n === 'number' && Number.isFinite(n) ? n : 0);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
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
