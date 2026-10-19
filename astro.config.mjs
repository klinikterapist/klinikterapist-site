// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { SITE as site } from './src/lib/site.ts';
import { getRedirects } from './src/lib/settings.ts';
import { satteri } from '@astrojs/markdown-satteri';
import { figurePlugin } from './src/lib/markdown-figure.ts';
import { sitemapNoindex } from './src/lib/sitemap-noindex.ts';

// Redirect stubs (redirects.json) are noindex pages: keep them out of the sitemap.
// Same validated list the stub pages use (paths are site-relative with a trailing slash).
const redirectUrls = new Set(getRedirects().map((r) => new URL(r.from, `${site}/`).href));

export default defineConfig({
  site,
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Astro's own icon bar at the bottom of dev pages sat on top of the booking form's sticky
  // "Devam" button, and a tap there opened its tools instead (owner's report 2026-10-19).
  devToolbar: { enabled: false },
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
      filter: (page) => !redirectUrls.has(page) && !['/admin/', '/ui-kit/'].some((p) => new URL(page).pathname.startsWith(p)),
      i18n: { defaultLocale: 'tr', locales: { tr: 'tr', en: 'en' } },
    }),
    // After the sitemap: drops noindex pages (empty category, nothing popular) from it.
    sitemapNoindex(site),
  ],
});
