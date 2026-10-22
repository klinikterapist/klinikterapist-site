import { defineMiddleware } from 'astro:middleware';
import { titleCaseHeadings } from './lib/title-case';

/** Every site page's headings in title case (lib/title-case.ts); the admin panel is left alone. */
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const path = context.url.pathname;
  if (path.startsWith('/admin') || !response.headers.get('content-type')?.includes('text/html')) return response;
  const html = await response.text();
  const lang = path === '/en' || path.startsWith('/en/') ? 'en' : 'tr';
  return new Response(titleCaseHeadings(html, lang), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
});
