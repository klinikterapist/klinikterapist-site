import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../../src/lib/contrast';
import { PALETTE, TONES, type ThemeName } from '../../src/lib/palette';

const css = readFileSync('src/styles/tokens.css', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/@import[^;]*;/g, '');

/** The text between the braces of the at-rule that starts at `head`. */
function mediaBody(head: RegExp): string {
  const start = css.search(head);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return '';
}

/** Declarations of every rule whose selector matches, as `name -> value` (later rules win). */
function block(selectorPattern: RegExp, inMedia = false): Record<string, string> {
  const out: Record<string, string> = {};
  const source = inMedia ? mediaBody(/@media \(prefers-color-scheme: dark\)/) : css.replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!m[1].split(',').some((sel) => selectorPattern.test(sel.trim()))) continue;
    for (const d of m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  }
  return out;
}

const themes: ThemeName[] = ['day', 'night'];

describe.each(themes)('%s theme contrast (WCAG AA)', (theme) => {
  const p = PALETTE[theme];
  it('text, muted and link read on the page background', () => {
    expect(contrastRatio(p.text, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.muted, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.link, p.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('text and muted read on surfaces', () => {
    for (const s of ['surface', 'surface-2']) {
      expect(contrastRatio(p.text, p[s]), `text/${s}`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.muted, p[s]), `muted/${s}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(p.link, p.surface)).toBeGreaterThanOrEqual(4.5);
  });
  it('button text reads on the button, also on hover', () => {
    expect(contrastRatio(p['btn-text'], p['btn-bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p['btn-text'], p['btn-bg-hover'])).toBeGreaterThanOrEqual(4.5);
  });
  it('mark text reads on the highlight', () => {
    expect(contrastRatio(p['mark-text'], p['mark-bg'])).toBeGreaterThanOrEqual(4.5);
  });
  it('focus ring and drop cap are visible on the background', () => {
    expect(contrastRatio(p.focus, p.bg)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(p.dropcap, p.bg)).toBeGreaterThanOrEqual(3);
  });
  it('every tone reads as text on its soft background, on the page and on a card', () => {
    for (const tone of TONES) {
      const fg = p[`tone-${tone}`];
      expect(contrastRatio(fg, p[`tone-${tone}-bg`]), `${tone}/${tone}-bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(fg, p.bg), `${tone}/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(fg, p.surface), `${tone}/surface`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('tones match the panel (src/admin/ui/tones.css)', () => {
  const panel = readFileSync('src/admin/ui/tones.css', 'utf8');
  const value = (scope: RegExp, name: string) => {
    const body = scope.exec(panel)![1];
    return new RegExp(`--p-${name}:\\s*([^;]+);`).exec(body)?.[1].trim().toLowerCase();
  };
  it.each(themes)('%s', (theme) => {
    const scope = theme === 'day' ? /:root\s*\{([^}]*)\}/ : /html\[data-theme='dark'\]\s*\{([^}]*)\}/;
    for (const tone of TONES) {
      for (const key of [`tone-${tone}`, `tone-${tone}-bg`]) {
        expect(PALETTE[theme][key].toLowerCase(), key).toBe(value(scope, key));
      }
    }
  });
});

describe.each(themes)('%s theme contact form fields', (theme) => {
  const p = PALETTE[theme];
  it('draw their edge in --muted, which reaches 3:1 on both the form surface and the field background', () => {
    const form = readFileSync('src/components/contact/ContactForm.astro', 'utf8');
    const rule = /input\[type='text'\][^{]*\{([^}]*)\}/.exec(form)![1];
    // --line is decorative (about 1.3:1); a control's edge must reach 3:1 (WCAG 1.4.11).
    expect(rule).toMatch(/border:\s*1px solid var\(--muted\)/);
    expect(contrastRatio(p.muted, p.surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(p.muted, p.bg)).toBeGreaterThanOrEqual(3);
  });
});

describe('sunflower', () => {
  it('is below 4.5:1 on the day background, so it is never text there', () => {
    expect(contrastRatio('#F6B92B', PALETTE.day.bg)).toBeLessThan(4.5);
  });
});

describe('PALETTE mirrors tokens.css', () => {
  const norm = (v: string) => v.toLowerCase();
  const blocks: [string, Record<string, string>, ThemeName][] = [
    [':root (day)', block(/^:root$/), 'day'],
    ['html[data-theme="light"] (day)', block(/^html\[data-theme=["']light["']\]$/), 'day'],
    ['html[data-theme="dark"] (night)', block(/^html\[data-theme=["']dark["']\]$/), 'night'],
    ['prefers-color-scheme: dark (night)', block(/^:root:not\(\[data-theme=["']light["']\]\)$/, true), 'night'],
  ];
  it.each(blocks)('%s carries every palette value of its theme', (_name, decls, theme) => {
    for (const [key, value] of Object.entries(PALETTE[theme])) {
      expect(decls[key], `--${key}`).toBeDefined();
      expect(norm(decls[key]), `--${key}`).toBe(norm(value));
    }
  });
  it('declares colour-scheme per theme', () => {
    expect(css).toMatch(/color-scheme:\s*light/);
    expect(css).toMatch(/color-scheme:\s*dark/);
  });
});
