/**
 * The post as the site's post page shows it (src/views/PostView.astro): the centred topic, title and
 * subtitle, the byline with the author's photo, date and reading time, the cover, the body, the
 * Kaynakça box (closed), the share buttons and "Randevu Al", as HTML for the "Önizle" dialog. Nothing
 * here publishes or writes anything. The body is the same Markdown the publish step writes; raw HTML
 * is escaped except the few tags the editor itself produces.
 */
import { Marked, type Token, type Tokens } from 'marked';
import type { Lang } from '../../lib/schemas';
import { CITE_OPEN, UnknownReferenceError, citedIds, referenceItemsHtml } from '../../lib/citations';
import { ICONS } from '../../lib/icons';
import { formatDate } from '../../lib/date';
import { readingTime } from '../../lib/readingTime';
import { t, tCount } from '../../i18n/ui';
import categories from '../../data/categories.json';
import profile from '../../data/profile.json';
import { loneImageCaption } from '../../lib/markdown-figure';
import { SAFE_LINK } from '../../lib/safe-link';
import type { Draft } from '../api/types';
import { docToMarkdown } from './markdown';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const nameOf = (src: string) => {
  try {
    return decodeURI(src).replace(/^\.\//, '');
  } catch {
    return src.replace(/^\.\//, '');
  }
};

/** The only tags the editor writes into the Markdown. */
const PLAIN_TAGS = new Set(['<mark>', '</mark>', '<i>', '</i>', '</cite>', '<aside class="callout">', '</aside>']);
const YOUTUBE = /^<div class="youtube" data-id="([A-Za-z0-9_-]{11})"><a href="[^"]*">([^<]*)<\/a><\/div>$/;

export const PREVIEW_MISSING_IMAGE = 'Görsel bulunamadı';

function img(url: string | null, alt: string, cls = ''): string {
  if (!url) return `<span class="preview-missing">${PREVIEW_MISSING_IMAGE}</span>`;
  return `<img${cls ? ` class="${cls}"` : ''} src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">`;
}

function bodyHtml(markdown: string, imageUrl: (name: string) => string | null): string {
  const md = new Marked({
    async: false,
    gfm: true,
    renderer: {
      html({ text }: Tokens.HTML | Tokens.Tag) {
        const tag = text.trim();
        if (PLAIN_TAGS.has(tag) || CITE_OPEN.test(tag)) return text;
        const yt = tag.match(YOUTUBE);
        if (yt) return `<div class="youtube" data-id="${yt[1]}"><a href="https://www.youtube.com/watch?v=${yt[1]}">${escapeHtml(yt[2])}</a></div>`;
        return escapeHtml(text);
      },
      link({ href, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        return SAFE_LINK.test(href) ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
      },
      image({ href, text }: Tokens.Image) {
        return img(imageUrl(nameOf(href)), text);
      },
      paragraph({ tokens }: Tokens.Paragraph) {
        const caption = loneImageCaption(tokens.map((tok: Token) => ({ type: tok.type, value: (tok as Tokens.Text).text, title: (tok as Tokens.Image).title })));
        const image = tokens.find((tok: Token) => tok.type === 'image') as Tokens.Image | undefined;
        if (caption === null || !image) return `<p>${this.parser.parseInline(tokens)}</p>\n`;
        const figure = img(imageUrl(nameOf(image.href)), image.text);
        return `<figure>${figure}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>\n`;
      },
    },
  });
  return md.parse(markdown) as string;
}

const icon = (name: keyof typeof ICONS, size = 18) =>
  `<svg class="pv-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

/** The byline as on the site: round photo, "name · title", "date · N dk okuma". */
function byline(draft: Draft, lang: Lang, minutes: number): string {
  const role = profile.title[lang].trim();
  const photo = profile.photo
    ? `<span class="pv-avatar" role="presentation" style="background-image:url('${escapeHtml(profile.photo)}')"></span>`
    : `<span class="pv-avatar pv-avatar--sun"></span>`;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(draft.publishedAt) ? new Date(`${draft.publishedAt}T00:00:00Z`) : new Date();
  return (
    `<div class="pv-byline">${photo}<p>` +
    `<span class="pv-byline-name"><b>${escapeHtml(profile.name)}</b>${role ? ` · ${escapeHtml(role)}` : ''}</span>` +
    `<span class="pv-byline-meta">${escapeHtml(formatDate(day, lang))} <span aria-hidden="true">·</span> ${minutes} ${t(lang, 'minRead')}</span>` +
    `</p></div>`
  );
}

/** Kaynakça as the site shows it: a closed box with the cited references. Empty when none is cited. */
function referencesBox(draft: Draft, lang: Lang, markdown: string): string {
  const items = referenceItemsHtml(draft[lang].references, citedIds(markdown), lang);
  if (!items.length) return '';
  return (
    `<section class="references pv-refs" aria-label="${t(lang, 'references')}"><details class="pv-acc">` +
    `<summary><span class="pv-acc-ic">${icon('list', 20)}</span><span class="pv-acc-text"><b>${t(lang, 'references')}</b>` +
    `<small>${tCount(lang, 'referencesOne', 'referencesMany', items.length)}</small></span>` +
    `<span class="pv-acc-chv">${icon('chevron', 18)}</span></summary>` +
    `<ol class="references-list">${items.join('')}</ol></details></section>`
  );
}

/** Share buttons and "Randevu Al": shown as on the site, inert in the preview. */
function postEnd(lang: Lang): string {
  const btn = (name: keyof typeof ICONS, label: string) => `<li><span class="pv-share-btn">${icon(name, 20)}<span>${label}</span></span></li>`;
  return (
    `<div class="pv-share" aria-hidden="true"><ul>${btn('instagram', t(lang, 'shareStory'))}${btn('link', t(lang, 'copyLink'))}${btn('whatsapp', t(lang, 'shareWhatsapp'))}</ul></div>` +
    `<span class="pv-cta" aria-hidden="true">${icon('calendar', 18)}${t(lang, 'bookSession')}</span>`
  );
}

/** `imageUrl` maps an image name (`a.webp`) to a URL the browser can show, or null when it is missing. */
export function renderPreviewHtml(draft: Draft, lang: Lang, imageUrl: (name: string) => string | null): string {
  const f = draft[lang];
  const cover = draft.cover ? img(imageUrl(draft.cover), f.coverAlt, 'cover') : '';
  const category = categories.find((c) => c.id === draft.category)?.label[lang as 'tr' | 'en'];
  let markdown: string | null = null;
  let failed = false;
  try {
    markdown = docToMarkdown(f.doc, lang, f.references);
  } catch (e) {
    if (!(e instanceof UnknownReferenceError)) throw e;
    failed = true;
  }
  const header =
    `<header class="container-text preview-head">` +
    (category ? `<span class="pv-category">${escapeHtml(category)}</span>` : '') +
    `<h1>${escapeHtml(f.title)}</h1>` +
    `<p class="standfirst">${escapeHtml(f.subtitle || f.description)}</p>` +
    byline(draft, lang, readingTime(markdown ?? '')) +
    `</header>` +
    (cover ? `<figure class="cover-wrap">${cover}</figure>` : '');
  if (failed || markdown === null) {
    return `${header}<div class="container-text"><p class="preview-error" role="alert">Metinde kayıtlı olmayan bir referansa atıf var. Atıfı silin ya da referansı ekleyin; sonra önizleme gösterilir.</p></div>`;
  }
  return (
    `${header}<div class="container-text"><div class="prose">${bodyHtml(markdown, imageUrl)}</div>` +
    `<div class="pv-end">${referencesBox(draft, lang, markdown)}${postEnd(lang)}</div></div>`
  );
}
