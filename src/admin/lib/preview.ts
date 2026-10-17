/**
 * The post as the site's post page shows it: header, cover, body and Kaynakça, as HTML for the
 * "Önizle" dialog. Nothing here publishes or writes anything. The body is the same Markdown the
 * publish step writes; raw HTML is escaped except the few tags the editor itself produces.
 */
import { Marked, type Token, type Tokens } from 'marked';
import type { Lang } from '../../lib/schemas';
import { CITE_OPEN, UnknownReferenceError, citedIds, renderReferencesSection } from '../../lib/citations';
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

/** `imageUrl` maps an image name (`a.webp`) to a URL the browser can show, or null when it is missing. */
export function renderPreviewHtml(draft: Draft, lang: Lang, imageUrl: (name: string) => string | null): string {
  const f = draft[lang];
  const cover = draft.cover ? img(imageUrl(draft.cover), f.coverAlt, 'cover') : '';
  const header =
    `<header class="preview-head"><h1>${escapeHtml(f.title)}</h1>` +
    `<p class="standfirst">${escapeHtml(f.subtitle || f.description)}</p></header>` +
    (cover ? `<figure class="cover-wrap">${cover}</figure>` : '');
  let markdown: string;
  try {
    markdown = docToMarkdown(f.doc, lang, f.references);
  } catch (e) {
    if (!(e instanceof UnknownReferenceError)) throw e;
    return `${header}<p class="preview-error" role="alert">Metinde kayıtlı olmayan bir referansa atıf var. Atıfı silin ya da referansı ekleyin; sonra önizleme gösterilir.</p>`;
  }
  const refs = renderReferencesSection(f.references, citedIds(markdown), lang);
  return `${header}<div class="prose">${bodyHtml(markdown, imageUrl)}</div>${refs}`;
}
