// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { SITE as site } from './src/lib/site.ts';
import { getRedirects } from './src/lib/settings.ts';
import { satteri } from '@astrojs/markdown-satteri';
import { figurePlugin } from './src/lib/markdown-figure.ts';

// Redirect stubs (redirects.json) are noindex pages: keep them out of the sitemap.
// Same validated list the stub pages use (paths are site-relative with a trailing slash).
const redirectUrls = new Set(getRedirects().map((r) => new URL(r.from, `${site}/`).href));

export default defineConfig({
  site,
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: { processor: satteri({ mdastPlugins: [figurePlugin] }) },
  i18n: {
    locales: ['tr', 'en'],
    defaultLocale: 'tr',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    // Only the admin panel (/admin/) uses React, as a client-only island.
    react(),
    sitemap({
      filter: (page) => !redirectUrls.has(page) && !new URL(page).pathname.startsWith('/admin/'),
      i18n: { defaultLocale: 'tr', locales: { tr: 'tr', en: 'en' } },
    }),
  ],
});
