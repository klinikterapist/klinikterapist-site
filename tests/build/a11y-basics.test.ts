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
    // Above the fold by design: the portrait on home/about/contact and the post cover must exist and be eager.
    const portraitPages = ['/', '/en/', '/hakkimda/', '/en/about/', '/iletisim/', '/en/contact/'];
    if (portraitPages.includes(path)) {
      const portrait = root.querySelector('main .portrait img');
      expect(portrait, 'portrait <img> must render (fixture profile has a photo)').toBeTruthy();
      expect(portrait!.getAttribute('loading')).not.toBe('lazy');
    }
    if (/^\/(en\/)?blog\/[^/]+\/$/.test(path) && root.querySelector('article')) {
      const first = root.querySelector('main img');
      if (first && first.classList.contains('cover')) expect(first.getAttribute('loading')).toBe('eager');
    }
    // Only the first image(s) of the page may be eager (LCP candidates); everything else is lazy.
    const eager = imgs.filter((img) => img.getAttribute('loading') === 'eager');
    expect(eager.length).toBeLessThanOrEqual(2);
    imgs.slice(eager.length).forEach((img) => expect(img.getAttribute('loading'), img.outerHTML).toBe('lazy'));
  });

  it('loads nothing from another host', () => {
    const urls = [
      ...root.querySelectorAll('link[href]').filter((e) => {
        const rel = (e.getAttribute('rel') ?? '').split(/\s+/);
        return !(rel.includes('stylesheet') || rel.includes('preload') || rel.includes('icon') ? false : rel.some((t) => ['canonical', 'alternate', 'me', 'author'].includes(t)));
      }).map((e) => e.getAttribute('href')!),
      ...root.querySelectorAll('script[src]').map((e) => e.getAttribute('src')!),
      ...root.querySelectorAll('img[src]').map((e) => e.getAttribute('src')!),
    ];
    for (const u of urls) {
      expect(u, 'external resource').not.toMatch(/^(https?:)?\/\//);
      expect(u, 'Google Fonts').not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
  });
});
