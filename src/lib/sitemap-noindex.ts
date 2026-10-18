/**
 * Keeps noindex pages (an empty category, the popular posts page with nothing popular) out of the
 * sitemap. @astrojs/sitemap only sees URLs, so after it has written the files this reads each built
 * page, collects those with `<meta name="robots" content="noindex">`, and removes their `<url>` entries
 * (and any hreflang link pointing at them). Only astro.config.mjs imports this file.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const NOINDEX = /<meta\s+name=["']?robots["']?\s+content=["'][^"']*noindex/i;

export function isNoindex(html: string): boolean {
  return NOINDEX.test(html);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeXml = (s: string) => s.replace(/&/g, '&amp;');

/** `xml` without the `<url>` entries for `urls` (absolute) and without hreflang links to them. */
export function stripUrls(xml: string, urls: Iterable<string>): string {
  let out = xml;
  for (const url of urls) {
    const loc = escapeRe(escapeXml(url));
    out = out.replace(new RegExp(`<url><loc>${loc}</loc>[\\s\\S]*?</url>`, 'g'), '');
    out = out.replace(new RegExp(`<xhtml:link rel="alternate" hreflang="[^"]*" href="${loc}"/>`, 'g'), '');
  }
  return out;
}

/** Runs after @astrojs/sitemap (list it after the sitemap integration). */
export function sitemapNoindex(site: string): AstroIntegration {
  return {
    name: 'sitemap-noindex',
    hooks: {
      'astro:build:done': ({ dir, pages, logger }) => {
        const root = fileURLToPath(dir);
        const hidden: string[] = [];
        for (const { pathname } of pages) {
          const file = join(root, pathname, 'index.html');
          if (existsSync(file) && isNoindex(readFileSync(file, 'utf8'))) hidden.push(new URL(`/${pathname}`, `${site}/`).href);
        }
        if (hidden.length === 0) return;
        for (const name of readdirSync(root).filter((n) => /^sitemap-\d+\.xml$/.test(n))) {
          const file = join(root, name);
          writeFileSync(file, stripUrls(readFileSync(file, 'utf8'), hidden));
        }
        logger.info(`${hidden.length} noindex page(s) left out of the sitemap`);
      },
    },
  };
}
