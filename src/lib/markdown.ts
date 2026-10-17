import { Marked, type Tokens } from 'marked';

/**
 * Markdown for short settings texts (about.json `whoAmI`, `whyThisWork`): paragraphs, emphasis,
 * lists and links. The text comes from the data files the admin panel writes, so raw HTML is
 * escaped, links may only go to https, mailto or site paths, and images are shown as their alt text.
 */
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// A site path, but not `//host` or `/\host` (browsers treat both as protocol-relative).
const SAFE_HREF = /^(https:\/\/|mailto:|\/(?![\/\\]))/i;

const md = new Marked({
  async: false,
  gfm: true,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link({ href, tokens }: Tokens.Link) {
      const inner = this.parser.parseInline(tokens);
      return SAFE_HREF.test(href) ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
    },
    image({ text }: Tokens.Image) {
      return escapeHtml(text);
    },
  },
});

export function renderMarkdown(src: string): string {
  return md.parse(src) as string;
}
