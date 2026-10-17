// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const site = (process.env.SITE_URL ?? 'https://example.com').replace(/\/$/, '');

// Redirect stubs (redirects.json) are noindex pages: keep them out of the sitemap.
/** @type {{ from: string }[]} */
const redirects = JSON.parse(readFileSync(join(process.env.DATA_DIR ?? 'src/data', 'redirects.json'), 'utf8'));
const redirectUrls = new Set(redirects.map((r) => new URL(r.from, `${site}/`).href));

export default defineConfig({
  site,
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    locales: ['tr', 'en'],
    defaultLocale: 'tr',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      filter: (page) => !redirectUrls.has(page),
      i18n: { defaultLocale: 'tr', locales: { tr: 'tr-TR', en: 'en-US' } },
    }),
  ],
});
