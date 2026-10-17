import rss from '@astrojs/rss';
import type { Lang } from './settings';
import { getSeo } from './settings';
import { getPosts } from './posts';
import { pathFor, postPath } from '../i18n/routes';
import { SITE } from './site';

/** RSS feed of one language's posts, newest first. */
export async function blogFeed(lang: Lang): Promise<Response> {
  const seo = getSeo();
  const posts = await getPosts(lang);
  return rss({
    title: `${seo.siteName[lang]} · Blog`,
    description: seo.defaultDescription[lang],
    site: `${SITE}${pathFor('blog', lang)}`,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.publishedAt,
      link: `${SITE}${postPath(p.data.slug, lang)}`,
    })),
    customData: `<language>${lang}</language>`,
  });
}
