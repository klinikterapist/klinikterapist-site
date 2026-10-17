import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, allPages, loadPage } from './load';

describe('/admin/', () => {
  it('is noindex, has one heading and a no-JavaScript message', () => {
    const d = loadPage('/admin/');
    expect(d.querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex');
    expect(d.querySelector('html')?.getAttribute('lang')).toBe('tr');
    expect(d.querySelectorAll('h1')).toHaveLength(1);
    expect(d.querySelector('noscript')?.textContent).toContain('JavaScript');
    expect(d.querySelector('astro-island')).not.toBeNull();
  });

  it('stays out of the sitemap and the public page checks', () => {
    expect(readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8')).not.toContain('/admin/');
    expect(allPages()).not.toContain('/admin/');
  });

  it('no public page loads the panel or React', () => {
    for (const path of allPages()) {
      const html = readFileSync(path.endsWith('.html') ? join(DIST, path) : join(DIST, path, 'index.html'), 'utf8');
      expect(html, path).not.toContain('astro-island');
      expect(html, path).not.toMatch(/AdminRoot|react/i);
    }
  });
});
