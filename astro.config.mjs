// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site = (process.env.SITE_URL ?? 'https://example.com').replace(/\/$/, '');

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
      i18n: { defaultLocale: 'tr', locales: { tr: 'tr-TR', en: 'en-US' } },
    }),
  ],
});
