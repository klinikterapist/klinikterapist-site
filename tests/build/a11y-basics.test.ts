import { describe, expect, it } from 'vitest';
import { allPages, loadPage } from './load';

const pages = allPages();

describe.each(pages)('a11y/perf basics %s', (path) => {
  const root = loadPage(path);

  it('every link has text or an aria-label', () => {
    for (const a of root.querySelectorAll('a')) {
      const name = a.text.trim() || a.getAttribute('aria-label')?.trim() || a.querySelector('img[alt]')?.getAttribute('alt')?.trim();
      expect(name, a.outerHTML.slice(0, 120)).toBeTruthy();
    }
  });

  it('has a skip link to #main and a #main target', () => {
    expect(root.querySelector('a[href="#main"]')).not.toBeNull();
    expect(root.querySelector('#main')).not.toBeNull();
  });

  it('images have dimensions and lazy-load unless above the fold', () => {
    const imgs = root.querySelectorAll('img');
    imgs.forEach((img) => {
      expect(img.getAttribute('width'), img.outerHTML).toBeTruthy();
      expect(img.getAttribute('height'), img.outerHTML).toBeTruthy();
      expect(img.getAttribute('alt'), img.outerHTML).not.toBeNull();
    });
    // Portrait (above the fold on home/about/contact) must never be lazy.
    root.querySelectorAll('.portrait img, img.portrait').forEach((img) => expect(img.getAttribute('loading')).not.toBe('lazy'));
    // Only the first image(s) of the page may be eager (LCP candidates); everything else is lazy.
    const eager = imgs.filter((img) => img.getAttribute('loading') === 'eager');
    expect(eager.length).toBeLessThanOrEqual(2);
    imgs.slice(eager.length).forEach((img) => expect(img.getAttribute('loading'), img.outerHTML).toBe('lazy'));
  });

  it('loads nothing from another host', () => {
    const urls = [
      ...root.querySelectorAll('link[href]').filter((e) => !/alternate|canonical|me|author/.test(e.getAttribute('rel') ?? '')).map((e) => e.getAttribute('href')!),
      ...root.querySelectorAll('script[src]').map((e) => e.getAttribute('src')!),
      ...root.querySelectorAll('img[src]').map((e) => e.getAttribute('src')!),
    ];
    for (const u of urls) {
      expect(u, 'external resource').not.toMatch(/^(https?:)?\/\//);
      expect(u).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
  });
});
