import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse, type HTMLElement } from 'node-html-parser';

/** All build tests read the fixture build (`npm run test:build` writes it). */
export const DIST = 'dist-test';

/** `/x/` → `dist-test/x/index.html`; a path ending in `.html` is read as is. */
export function distFile(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return clean.endsWith('.html') ? join(DIST, clean) : join(DIST, clean, 'index.html');
}

export function loadPage(path: string): HTMLElement {
  const file = distFile(path);
  if (!existsSync(file)) throw new Error(`Built page not found: ${file}`);
  return parse(readFileSync(file, 'utf8'));
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === 'index.html') out.push(full);
  }
}

/** Every built page as a site path (`/`, `/en/about/`, …) plus `/404.html`. */
export function allPages(): string[] {
  const files: string[] = [];
  walk(DIST, files);
  const pages = files.map((f) => {
    const dir = relative(DIST, f).split(sep).slice(0, -1).join('/');
    return dir ? `/${dir}/` : '/';
  });
  if (existsSync(join(DIST, '404.html'))) pages.push('/404.html');
  return pages.sort();
}
