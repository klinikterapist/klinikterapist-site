import { describe, expect, it } from 'vitest';
import { allPages, loadPage } from './load';

describe.each(allPages())('theme %s', (path) => {
  const head = loadPage(path).querySelector('head')!;
  const kids = head.childNodes.filter((n) => n.nodeType === 1) as import('node-html-parser').HTMLElement[];

  it('starts <head> with the inline theme script', () => {
    const first = kids[0];
    expect(first.tagName).toBe('SCRIPT');
    expect(first.getAttribute('src')).toBeUndefined();
    expect(first.rawText).toContain('site.theme');
    expect(first.rawText).toContain('data');
  });

  it('declares color-scheme', () => {
    expect(head.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light dark');
  });

  it('loads no stylesheet before the script', () => {
    // The script is first, so nothing (stylesheet link or <style>) can precede it.
    expect(kids[0].tagName).not.toBe('LINK');
    expect(kids[0].tagName).not.toBe('STYLE');
  });
});
