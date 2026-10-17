// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE as site } from './src/lib/site.ts';
import { getRedirects } from './src/lib/settings.ts';

// Redirect stubs (redirects.json) are noindex pages: keep them out of the sitemap.
// Same validated list the stub pages use (paths are site-relative with a trailing slash).
const redirectUrls = new Set(getRedirects().map((r) => new URL(r.from, `${site}/`).href));

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
