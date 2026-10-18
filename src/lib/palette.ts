/**
 * The "Gün & Gece" palette as data. It mirrors src/styles/tokens.css (a unit test keeps the two in
 * sync) so contrast can be checked without a browser. Keys are the CSS custom property names minus `--`.
 */
export type ThemeName = 'day' | 'night';

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
  },
};
