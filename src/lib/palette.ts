/**
 * The "Gün & Gece" palette as data. It mirrors src/styles/tokens.css (a unit test keeps the two in
 * sync) so contrast can be checked without a browser. Keys are the CSS custom property names minus `--`.
 */
export type ThemeName = 'day' | 'night';

/**
 * The six "Gün & Gece" tones, the same values as the panel (src/admin/ui/tones.css; a test keeps them
 * equal). Each has a text colour (`tone-<name>`) and a soft background (`tone-<name>-bg`).
 */
export const TONES = ['lacivert', 'gunes', 'adacayi', 'kiremit', 'lavanta', 'deniz'] as const;
export type Tone = (typeof TONES)[number];

export const PALETTE: Record<ThemeName, Record<string, string>> = {
  day: {
    bg: '#FBF3E4',
    surface: '#F4E9D4',
    'surface-2': '#EBDDC0',
    text: '#2A2420',
    muted: '#5C5348',
    line: 'rgb(42 36 32 / 0.12)',
    'btn-bg': '#1F2E4A',
    'btn-text': '#FBF3E4',
    'btn-bg-hover': '#141F33',
    link: '#1F2E4A',
    'link-hover': '#141F33',
    'sun-halo': '#FCD873',
    'sun-disc': '#F6B92B',
    'sun-face': '#2A2420',
    dropcap: '#1F2E4A',
    'quote-rule': '#F6B92B',
    focus: '#1F2E4A',
    'mark-bg': '#FCD873',
    'mark-text': '#2A2420',
    'tone-lacivert': '#1F2E4A',
    'tone-gunes': '#8A5D00',
    'tone-adacayi': '#3F6448',
    'tone-kiremit': '#9A4A33',
    'tone-lavanta': '#55548F',
    'tone-deniz': '#24605F',
    'tone-lacivert-bg': '#E3E7EF',
    'tone-gunes-bg': '#FBEBC2',
    'tone-adacayi-bg': '#DDEBDF',
    'tone-kiremit-bg': '#F5DDD3',
    'tone-lavanta-bg': '#E6E5F3',
    'tone-deniz-bg': '#D6ECEA',
  },
  night: {
    bg: '#1F2E4A',
    surface: '#26385A',
    'surface-2': '#2F4570',
    text: '#F4EBDD',
    muted: '#B9C4D6',
    line: 'rgb(244 235 221 / 0.13)',
    'btn-bg': '#F6B92B',
    'btn-text': '#1F2E4A',
    'btn-bg-hover': '#FCD873',
    link: '#FCD873',
    'link-hover': '#FFE9A8',
    'sun-halo': '#FCD873',
    'sun-disc': '#F6B92B',
    'sun-face': '#1F2E4A',
    dropcap: '#F6B92B',
    'quote-rule': '#F6B92B',
    focus: '#FCD873',
    'mark-bg': '#FCD873',
    'mark-text': '#1F2E4A',
    'tone-lacivert': '#C9D6EE',
    'tone-gunes': '#FCD873',
    'tone-adacayi': '#9CCAA8',
    'tone-kiremit': '#F0A88E',
    'tone-lavanta': '#BFC0F0',
    'tone-deniz': '#8ED3CF',
    'tone-lacivert-bg': '#2C3E62',
    'tone-gunes-bg': '#4A3F1C',
    'tone-adacayi-bg': '#24433A',
    'tone-kiremit-bg': '#4B2E2A',
    'tone-lavanta-bg': '#33355E',
    'tone-deniz-bg': '#1E4447',
  },
};
