// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { distFile } from './load';

/**
 * Runs the inline search script exactly as the built /blog/ page ships it, on the built page's markup.
 * (Separate file: it needs a browser-like document; the other build tests parse HTML in Node.)
 */
describe('blog search script on the built page', () => {
  const html = readFileSync(distFile('/blog/'), 'utf8');

  beforeEach(() => {
    document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '');
    const script = [...document.querySelectorAll('script:not([src])')].find((s) => s.textContent!.includes('[data-blog]'))!;
    expect(script).toBeTruthy();
    new Function(script.textContent!)();
  });

  const input = () => document.querySelector<HTMLInputElement>('form[data-blog-search] input')!;
  const type = (v: string) => {
    input().value = v;
    input().dispatchEvent(new Event('input', { bubbles: true }));
  };
  const shown = () =>
    [...document.querySelectorAll<HTMLElement>('.blog-phone [data-post]')]
      .filter((e) => !e.hidden)
      .map((e) => e.querySelector('a')!.getAttribute('href'));

  it('ships no build helper and the shared foldTr', () => {
    expect(html).not.toContain('__name');
    expect(html).toContain('function foldTr(');
  });

  it('filters by title and topic, ignoring case and Turkish letters', () => {
    type('KAPAKSIZ');
    expect(shown()).toEqual(['/blog/kapaksiz-ornek/']);
    type('zihinsel saglik');
    expect(shown()).toEqual(['/blog/kapaksiz-ornek/']);
    type('qqq');
    expect(shown()).toEqual([]);
    expect(document.querySelector<HTMLElement>('[data-no-results]')!.hidden).toBe(false);
    type('');
    expect(shown()).toHaveLength(3);
    expect(document.querySelector<HTMLElement>('[data-no-results]')!.hidden).toBe(true);
  });

  it('a topic chip filters the list in place on the all-posts page', () => {
    const chip = document.querySelector<HTMLAnchorElement>('.blog-filters a[data-cat="zihinsel-saglik"]')!;
    chip.click();
    expect(shown()).toEqual(['/blog/kapaksiz-ornek/']);
    expect(chip.getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('.blog-filters a[data-cat=""]')!.hasAttribute('aria-current')).toBe(false);
  });
});
