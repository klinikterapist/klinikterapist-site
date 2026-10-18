/**
 * The built admin page loads the site's prose.css next to admin.css, and the build does not keep
 * their order (prose.css is inlined as a <style> after the admin stylesheet link). The panel's own
 * colours (dark theme) must win however the two are ordered, so every editor rule that competes
 * with a prose.css colour rule must be more specific than it (final review I1, I2).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, loadPage } from './load';

type Rule = { selector: string; body: string };

function pageCss(): string {
  const d = loadPage('/admin/');
  const linked = d
    .querySelectorAll('link[rel=stylesheet]')
    .map((l) => readFileSync(join(DIST, l.getAttribute('href')!.replace(/^\//, '')), 'utf8'));
  const inline = d.querySelectorAll('style').map((s) => s.textContent);
  return [...linked, ...inline].join('\n');
}

/** Innermost `selector { body }` blocks (rules inside @media come out with their own selector). */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const selector of m[1].split(',')) out.push({ selector: selector.trim().replace(/\s+/g, ' '), body: m[2] });
  }
  return out;
}

/** [ids, classes/attributes/pseudo-classes, elements] for a simple selector (no :is/:where/:not). */
function specificity(sel: string): [number, number, number] {
  const s = sel.replace(/::[\w-]+/g, ' x'); // a pseudo-element counts as an element
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) ?? []).length;
  const elements = (s.replace(/\.[\w-]+|\[[^\]]*\]|:[\w-]+|#[\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return [ids, classes, elements];
}
const beats = (a: [number, number, number], b: [number, number, number]) =>
  a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

const sets = (body: string, prop: string) => new RegExp(`(^|;)\\s*${prop}\\s*:`).test(body);

describe('/admin/ styles', () => {
  const all = rules(pageCss());
  const find = (selector: string) => all.filter((r) => r.selector === selector);

  it('the page loads both prose.css and admin.css', () => {
    expect(find('.prose mark').length).toBeGreaterThan(0);
    expect(find('.ed-body.prose mark').length).toBeGreaterThan(0);
  });

  // Editor rule, the prose.css rule it competes with, and the colour properties at stake.
  const pairs: [string, string, string[]][] = [
    ['.ed-body.prose mark', '.prose mark', ['background', 'color']],
    ['.ed-body.prose blockquote', '.prose blockquote', ['color']],
    ['.ed-body.prose .ed-callout', '.prose .callout', ['background', 'color']],
    ['.ed-body.prose hr', '.prose hr', ['border-top']],
  ];
  for (const [editor, prose, props] of pairs) {
    it(`${editor} wins over ${prose} whatever the stylesheet order`, () => {
      const mine = find(editor);
      expect(mine.length, editor).toBeGreaterThan(0);
      for (const p of props) expect(mine.some((r) => sets(r.body, p)), `${editor} sets ${p}`).toBe(true);
      for (const r of find(prose)) expect(beats(specificity(editor), specificity(r.selector)), `${editor} vs ${r.selector}`).toBe(true);
    });
  }

  it('the read-only version view always uses the site light colours (like Önizle)', () => {
    const view = find('.versions-view');
    expect(view.some((r) => /color-scheme:\s*light/.test(r.body))).toBe(true);
    expect(view.some((r) => /background:\s*var\(--bg\)/.test(r.body))).toBe(true);
    expect(view.some((r) => /(^|;)\s*color:\s*var\(--text\)/.test(r.body))).toBe(true);
    // Panel tokens used by the content are pinned to light values inside it.
    expect(view.some((r) => /--p-highlight:\s*var\(--mark-bg\)/.test(r.body))).toBe(true);
  });

  it('the editor body keeps the panel colours for list markers and captions (not the site day pin)', () => {
    expect(find('.ed-body.prose li::marker').some((r) => /color:\s*var\(--panel-sage\)/.test(r.body))).toBe(true);
    expect(find('.ed-body.prose figcaption').some((r) => /color:\s*var\(--p-muted\)/.test(r.body))).toBe(true);
    for (const [editor, prose] of [['.ed-body.prose li::marker', '.prose li::marker'], ['.ed-body.prose figcaption', '.prose figcaption']]) {
      for (const r of find(prose)) expect(beats(specificity(editor), specificity(r.selector)), `${editor} vs ${r.selector}`).toBe(true);
    }
  });
});
