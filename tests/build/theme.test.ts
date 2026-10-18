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
  });

  it('declares color-scheme', () => {
    expect(head.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light dark');
  });

  it('loads no stylesheet before the script', () => {
    // The script is first, so nothing (stylesheet link or <style>) can precede it.
    const html = loadPage(path).toString();
    const at = html.indexOf('site.theme');
    expect(at).toBeGreaterThan(-1);
    expect(html.slice(0, at)).not.toMatch(/<link[^>]+rel=["']?stylesheet/i);
    expect(kids[0].tagName).not.toBe('LINK');
    expect(kids[0].tagName).not.toBe('STYLE');
  });
});

describe.each(['/blog/eski-adres/', '/en/blog/old-address/'])('theme redirect stub %s', (path) => {
  const head = loadPage(path).querySelector('head')!;
  it('starts <head> with the inline theme script and declares color-scheme', () => {
    const kids = head.childNodes.filter((n) => n.nodeType === 1) as import('node-html-parser').HTMLElement[];
    expect(kids[0].tagName).toBe('SCRIPT');
    expect(kids[0].rawText).toContain('site.theme');
    expect(head.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light dark');
  });
});

describe('fonts', () => {
  it('ships no Caveat (R-F6: unused, removed)', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join('dist-test', '_astro');
    const files = readdirSync(dir);
    expect(files.some((f) => /caveat/i.test(f))).toBe(false);
    for (const f of files.filter((n) => n.endsWith('.css'))) expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/Caveat/);
  });
});
