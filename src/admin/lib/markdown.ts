/**
 * Editor document (Tiptap JSON) ⇄ the post Markdown the site builds (see Task 2 of the Phase 2
 * plan for the exact syntax of figures, callouts and YouTube boxes).
 */
import type { JSONContent } from '@tiptap/core';
import { Lexer, type Token, type Tokens } from 'marked';
import type { Lang } from '../../lib/schemas';

type Mark = NonNullable<JSONContent['marks']>[number];

const YOUTUBE_TEXT: Record<Lang, string> = { tr: "Videoyu YouTube'da izleyin", en: 'Watch the video on YouTube' };
const CALLOUT_OPEN = '<aside class="callout">';
const CALLOUT_CLOSE = '</aside>';
const YOUTUBE_RE = /^<div class="youtube" data-id="([A-Za-z0-9_-]{11})">[\s\S]*<\/div>\s*$/;

// ---------- doc → Markdown ----------

/** Backslash-escape everything Markdown could read as syntax. */
function escapeText(text: string): string {
  return (
    text
      .replace(/\n/g, ' ')
      .replace(/[\\`*_[\]<>#~|]/g, '\\$&')
      // `&` only where it would start an entity (`&amp;`, `&#39;`).
      .replace(/&(?=#|[A-Za-z0-9]+;)/g, '\\&')
  );
}

/** Line-start constructs: list bullets, ordered-list numbers, setext/hr dashes. */
function escapeLineStart(line: string): string {
  return line.replace(/^(\s*)([-+=])/, '$1\\$2').replace(/^(\s*\d+)([.)])/, '$1\\$2');
}

const escapeHref = (href: string) => href.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');

/** Opening order (outermost first). */
const MARK_ORDER = ['link', 'bold', 'italic', 'strike', 'highlight'];
const markKey = (m: Mark) => (m.type === 'link' ? `link:${m.attrs?.href ?? ''}` : m.type);
const sortMarks = (marks: Mark[]) =>
  marks.filter((m) => MARK_ORDER.includes(m.type)).sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));

const OPEN: Record<string, string> = { link: '[', bold: '**', italic: '_', strike: '~~', highlight: '<mark>' };
const CLOSE: Record<string, string> = { bold: '**', italic: '_', strike: '~~', highlight: '</mark>' };
const openMark = (m: Mark) => OPEN[m.type];
const closeMark = (m: Mark) => (m.type === 'link' ? `](${escapeHref(String(m.attrs?.href ?? ''))})` : CLOSE[m.type]);

function inline(nodes: JSONContent[] = []): string {
  let out = '';
  let stack: Mark[] = [];
  let pendingTrail = '';
  const closeTo = (depth: number) => {
    while (stack.length > depth) out += closeMark(stack.pop()!);
  };
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      closeTo(0);
      out += `${pendingTrail}\\\n`;
      pendingTrail = '';
      continue;
    }
    if (node.type !== 'text' || !node.text) continue;
    const marks = sortMarks(node.marks ?? []);
    const [, lead, core, trail] = node.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    // Keep the longest shared prefix of open marks; close the rest.
    let keep = 0;
    while (keep < stack.length && keep < marks.length && markKey(stack[keep]) === markKey(marks[keep])) keep++;
    if (!core) {
      // Whitespace-only text: emit it outside any mark that ends here.
      closeTo(keep);
      out += pendingTrail + lead + trail;
      pendingTrail = '';
      continue;
    }
    closeTo(keep);
    out += pendingTrail;
    pendingTrail = '';
    if (marks.length > keep) {
      out += escapeText(lead);
      for (const m of marks.slice(keep)) {
        out += openMark(m);
        stack.push(m);
      }
      out += escapeText(core);
    } else {
      out += escapeText(lead + core);
    }
    pendingTrail = escapeText(trail);
  }
  closeTo(0);
  stack = [];
  return out + pendingTrail;
}

const indent = (text: string, pad: string) =>
  text
    .split('\n')
    .map((l, i) => (i === 0 || !l ? l : pad + l))
    .join('\n');

function block(node: JSONContent, lang: Lang): string | null {
  switch (node.type) {
    case 'paragraph': {
      const text = inline(node.content);
      return text.trim() ? escapeLineStart(text) : null;
    }
    case 'heading': {
      const level = node.attrs?.level === 3 ? 3 : 2;
      return `${'#'.repeat(level)} ${inline(node.content)}`;
    }
    case 'blockquote': {
      const inner = blocks(node.content, lang);
      return inner
        .split('\n')
        .map((l) => (l ? `> ${l}` : '>'))
        .join('\n');
    }
    case 'bulletList':
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((item, i) => {
          const bullet = node.type === 'bulletList' ? '- ' : `${start + i}. `;
          const inner = blocks(item.content, lang) || '';
          return bullet + indent(inner, ' '.repeat(bullet.length));
        })
        .join('\n');
    }
    case 'horizontalRule':
      return '---';
    case 'figure': {
      const { src = '', alt = '', caption = '' } = node.attrs ?? {};
      const altText = String(alt).replace(/[\\[\]]/g, '\\$&');
      const title = caption ? ` "${String(caption).replace(/[\\"]/g, '\\$&')}"` : '';
      return `![${altText}](${escapeHref(String(src))}${title})`;
    }
    case 'youtube': {
      const id = String(node.attrs?.id ?? '');
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
      return `<div class="youtube" data-id="${id}"><a href="https://www.youtube.com/watch?v=${id}">${YOUTUBE_TEXT[lang]}</a></div>`;
    }
    case 'callout': {
      const inner = blocks(node.content, lang);
      return inner ? `${CALLOUT_OPEN}\n\n${inner}\n\n${CALLOUT_CLOSE}` : null;
    }
    default:
      return null;
  }
}

function blocks(nodes: JSONContent[] = [], lang: Lang): string {
  return nodes
    .map((n) => block(n, lang))
    .filter((s): s is string => s !== null)
    .join('\n\n');
}

export function docToMarkdown(doc: JSONContent, lang: Lang): string {
  const md = blocks(doc.content, lang);
  return md ? `${md}\n` : '';
}

// ---------- Markdown → doc ----------

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]);

function addMark(nodes: JSONContent[], mark: Mark): JSONContent[] {
  return nodes.map((n) => (n.type === 'text' ? { ...n, marks: [...(n.marks ?? []), mark] } : n));
}

function inlineTokens(tokens: Token[] = []): JSONContent[] {
  const out: JSONContent[] = [];
  const isHtml = (t: Token | undefined, tag: string) => t?.type === 'html' && (t as Tokens.HTML).raw === tag;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    switch (tok.type) {
      case 'text': {
        const t = tok as Tokens.Text;
        if (t.tokens?.length) out.push(...inlineTokens(t.tokens));
        else if (t.text) out.push({ type: 'text', text: decode(t.text) });
        break;
      }
      case 'escape':
        out.push({ type: 'text', text: (tok as Tokens.Escape).text });
        break;
      case 'strong':
        out.push(...addMark(inlineTokens((tok as Tokens.Strong).tokens), { type: 'bold' }));
        break;
      case 'em':
        out.push(...addMark(inlineTokens((tok as Tokens.Em).tokens), { type: 'italic' }));
        break;
      case 'link': {
        const l = tok as Tokens.Link;
        out.push(...addMark(inlineTokens(l.tokens), { type: 'link', attrs: { href: decodeURI(l.href) } }));
        break;
      }
      case 'br':
        out.push({ type: 'hardBreak' });
        break;
      case 'codespan':
        out.push({ type: 'text', text: decode((tok as Tokens.Codespan).text) });
        break;
      case 'del':
        out.push(...addMark(inlineTokens((tok as Tokens.Del).tokens), { type: 'strike' }));
        break;
      case 'html': {
        // Only the exact tag pair <mark>…</mark> is the highlight mark; any other inline HTML stays text.
        const end = isHtml(tok, '<mark>') ? tokens.findIndex((t, j) => j > i && isHtml(t, '</mark>')) : -1;
        if (end > i) {
          out.push(...addMark(inlineTokens(tokens.slice(i + 1, end)), { type: 'highlight' }));
          i = end;
        } else out.push({ type: 'text', text: tok.raw });
        break;
      }
      case 'image':
        out.push({ type: 'text', text: (tok as Tokens.Image).text });
        break;
      default:
        if ('raw' in tok && tok.raw) out.push({ type: 'text', text: tok.raw });
    }
  }
  // Merge neighbours with identical marks.
  const merged: JSONContent[] = [];
  for (const n of out) {
    const prev = merged[merged.length - 1];
    const same = (a?: Mark[], b?: Mark[]) => JSON.stringify((a ?? []).map(markKey).sort()) === JSON.stringify((b ?? []).map(markKey).sort());
    if (prev && prev.type === 'text' && n.type === 'text' && same(prev.marks, n.marks)) prev.text = (prev.text ?? '') + (n.text ?? '');
    else merged.push({ ...n });
  }
  return merged;
}

const paragraph = (content: JSONContent[]): JSONContent => (content.length ? { type: 'paragraph', content } : { type: 'paragraph' });

function loneImage(tokens: Token[] = []): Tokens.Image | null {
  const parts = tokens.filter((t) => !(t.type === 'text' && !(t as Tokens.Text).text.trim()));
  return parts.length === 1 && parts[0].type === 'image' ? (parts[0] as Tokens.Image) : null;
}

function blockTokens(tokens: Token[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    switch (tok.type) {
      case 'space':
        break;
      case 'paragraph': {
        const img = loneImage((tok as Tokens.Paragraph).tokens);
        if (img) out.push({ type: 'figure', attrs: { src: decodeURI(img.href), alt: img.text, caption: img.title ?? '' } });
        else out.push(paragraph(inlineTokens((tok as Tokens.Paragraph).tokens)));
        break;
      }
      case 'text': // tight list items
        out.push(paragraph(inlineTokens((tok as Tokens.Text).tokens ?? [{ type: 'text', raw: tok.raw, text: (tok as Tokens.Text).text } as Token])));
        break;
      case 'heading': {
        const h = tok as Tokens.Heading;
        out.push({ type: 'heading', attrs: { level: h.depth <= 2 ? 2 : 3 }, content: inlineTokens(h.tokens) });
        break;
      }
      case 'blockquote':
        out.push({ type: 'blockquote', content: blockTokens((tok as Tokens.Blockquote).tokens) });
        break;
      case 'list': {
        const l = tok as Tokens.List;
        out.push({
          type: l.ordered ? 'orderedList' : 'bulletList',
          ...(l.ordered ? { attrs: { start: Number(l.start || 1) } } : {}),
          content: l.items.map((it) => ({ type: 'listItem', content: blockTokens(it.tokens) })),
        });
        break;
      }
      case 'hr':
        out.push({ type: 'horizontalRule' });
        break;
      case 'html': {
        const raw = (tok as Tokens.HTML).text.trim();
        const yt = raw.match(YOUTUBE_RE);
        if (yt) {
          out.push({ type: 'youtube', attrs: { id: yt[1] } });
          break;
        }
        if (raw === CALLOUT_OPEN) {
          const end = tokens.findIndex((t, j) => j > i && t.type === 'html' && (t as Tokens.HTML).text.trim() === CALLOUT_CLOSE);
          if (end > i) {
            const inner = blockTokens(tokens.slice(i + 1, end)).filter((n) => n.type === 'paragraph');
            out.push({ type: 'callout', content: inner.length ? inner : [{ type: 'paragraph' }] });
            i = end;
            break;
          }
        }
        out.push(paragraph([{ type: 'text', text: raw }]));
        break;
      }
      case 'code':
        out.push(paragraph([{ type: 'text', text: (tok as Tokens.Code).text }]));
        break;
      default:
        if ('raw' in tok && tok.raw.trim()) out.push(paragraph([{ type: 'text', text: tok.raw.trim() }]));
    }
  }
  return out;
}

export function markdownToDoc(md: string): JSONContent {
  return { type: 'doc', content: blockTokens(new Lexer({ gfm: true }).lex(md.replace(/\r\n/g, '\n'))) };
}
