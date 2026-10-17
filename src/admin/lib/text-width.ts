/**
 * Approximate width of a Google desktop result title (Arial 20 px), from Arial's advance widths
 * (units per 1000 em). Good enough for a "too long?" light; real truncation varies slightly.
 */
const UNITS: Record<string, number> = {};
const set = (chars: string, units: number) => {
  for (const c of chars) UNITS[c] = units;
};
set('abdeghnopqu0123456789ğöü?$', 556);
set('cksvxyzçş', 500);
set('fjt/', 278);
set('il', 222);
set('ı', 278);
set('m', 833);
set('r-()', 333);
set('w', 722);
set(' .,:;!İI', 278);
set('ABEKPSVXYŞ&', 667);
set('CDHNRUwÇÜ', 722);
set('FTZ', 611);
set('GOQĞÖ', 778);
set('J', 500);
set('L', 556);
set('M', 833);
set('W', 944);
set("'", 191);
set('"', 355);
set('|', 260);
set('—', 1000);
set('–…', 556);

const PX = 20 / 1000;
const DEFAULT_UNITS = 550;

export function titlePixelWidth(text: string): number {
  let units = 0;
  for (const c of text) units += UNITS[c] ?? DEFAULT_UNITS;
  return Math.round(units * PX);
}

export function truncateToWidth(text: string, px: number): string {
  if (titlePixelWidth(text) <= px) return text;
  const chars = [...text];
  const ellipsis = titlePixelWidth('…');
  let out = '';
  for (const c of chars) {
    if (titlePixelWidth(out + c) + ellipsis > px) break;
    out += c;
  }
  return `${out.trimEnd()}…`;
}
