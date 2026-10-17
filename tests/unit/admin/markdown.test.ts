import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { JSONContent } from '@tiptap/core';
import { docToMarkdown, markdownToDoc } from '../../../src/admin/lib/markdown';
import { parsePost } from '../../../src/admin/lib/frontmatter';

const t = (text: string, ...marks: JSONContent['marks'] & object): JSONContent => (marks.length ? { type: 'text', text, marks } : { type: 'text', text });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const bold = { type: 'bold' };
const italic = { type: 'italic' };
const strike = { type: 'strike' };
const highlight = { type: 'highlight' };
const link = (href: string) => ({ type: 'link', attrs: { href } });

/** Comparable form: marks sorted, link attrs reduced to href, empty content dropped. */
function norm(node: JSONContent): JSONContent {
  const out: JSONContent = { type: node.type };
  if (node.attrs) out.attrs = node.attrs;
  if (node.text !== undefined) out.text = node.text;
  if (node.marks?.length) {
    out.marks = node.marks
      .map((m) => (m.type === 'link' ? { type: 'link', attrs: { href: m.attrs?.href } } : { type: m.type }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }
  if (node.content?.length) out.content = node.content.map(norm);
  return out;
}

const everything: JSONContent = {
  type: 'doc',
  content: [
    p(t('Düz metin, '), t('kalın', bold), t(' ve '), t('italik', italic), t(' ve '), t('ikisi', bold, italic), t('.')),
    p(t('Bir '), t('çizik', strike), t(' ve '), t('vurgu', highlight), t(' ve '), t('ikisi', strike, highlight, bold), t('.')),
    { type: 'heading', attrs: { level: 2 }, content: [t('Alt başlık')] },
    { type: 'heading', attrs: { level: 3 }, content: [t('Daha küçük')] },
    p(t('Bir '), t('site içi bağlantı', link('/hakkimda/')), t(' ve '), t('kalın dış bağlantı', link('https://a.co/x?y=1'), bold), t('.')),
    { type: 'blockquote', content: [p(t('Alıntı satırı.'))] },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p(t('Birinci'))] },
        { type: 'listItem', content: [p(t('İkinci '), t('vurgulu', italic))] },
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 1 },
      content: [
        { type: 'listItem', content: [p(t('Bir'))] },
        { type: 'listItem', content: [p(t('İki'))] },
      ],
    },
    { type: 'horizontalRule' },
    { type: 'figure', attrs: { src: './yaprak.webp', alt: 'Yaprak çizimi', caption: 'Adaçayı "yeşili" yaprak' } },
    { type: 'figure', attrs: { src: './ikinci.webp', alt: 'İkinci', caption: '' } },
    { type: 'youtube', attrs: { id: 'dQw4w9WgXcQ' } },
    { type: 'callout', content: [p(t('Vurgu kutusunda '), t('önemli', bold), t(' not.'))] },
    p(t('Satır'), { type: 'hardBreak' }, t('kırılır.')),
  ],
};

describe('docToMarkdown ⇄ markdownToDoc', () => {
  it('round-trips every node and mark', () => {
    const md = docToMarkdown(everything, 'tr');
    expect(norm(markdownToDoc(md))).toEqual(norm(everything));
  });

  it('writes the exact syntax the site renders (Task 2)', () => {
    const md = docToMarkdown(everything, 'tr');
    expect(md).toContain('![Yaprak çizimi](./yaprak.webp "Adaçayı \\"yeşili\\" yaprak")');
    expect(md).toContain('![İkinci](./ikinci.webp)\n');
    expect(md).toContain(
      '<div class="youtube" data-id="dQw4w9WgXcQ"><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Videoyu YouTube\'da izleyin</a></div>',
    );
    expect(md).toContain('<aside class="callout">\n\nVurgu kutusunda **önemli** not.\n\n</aside>');
    expect(md).toContain('**kalın**');
    expect(md).toContain('_italik_');
    expect(md).toContain('- Birinci\n- İkinci');
    expect(md.endsWith('\n') && !md.endsWith('\n\n')).toBe(true);
    expect(docToMarkdown({ type: 'doc', content: [{ type: 'youtube', attrs: { id: 'dQw4w9WgXcQ' } }] }, 'en')).toContain('>Watch the video on YouTube</a>');
  });

  it('keeps Markdown characters in text literal', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [p(t('*yıldız* [köşeli] #etiket _alt_ <b>html</b> `kod` & ~çizgi~ | boru')), p(t('- tire ile başlar')), p(t('1. rakamla başlar')), p(t('+ artı'))],
    };
    const md = docToMarkdown(doc, 'tr');
    expect(norm(markdownToDoc(md))).toEqual(norm(doc));
  });

  it('writes strike and highlight syntax, and keeps look-alike text literal', () => {
    const md = docToMarkdown(everything, 'tr');
    expect(md).toContain('~~çizik~~');
    expect(md).toContain('<mark>vurgu</mark>');
    const doc: JSONContent = { type: 'doc', content: [p(t('a ~~b~~ <mark>c</mark>'))] };
    const lit = docToMarkdown(doc, 'tr');
    expect(lit).toContain('\\~\\~b\\~\\~');
    expect(lit).toContain('\\<mark');
    expect(norm(markdownToDoc(lit))).toEqual(norm(doc));
  });

  it('keeps whitespace outside emphasis markers', () => {
    const doc: JSONContent = { type: 'doc', content: [p(t('a'), t(' kalın ', bold), t('b'))] };
    const md = docToMarkdown(doc, 'tr');
    expect(md).toBe('a **kalın** b\n');
  });

  it('parses the fixture post the site builds into figure, callout and youtube nodes', () => {
    const { body } = parsePost(readFileSync('tests/fixtures/content/ornek-zengin/tr.md', 'utf8'));
    const types = markdownToDoc(body).content!.map((n) => n.type);
    expect(types).toEqual(['paragraph', 'figure', 'callout', 'youtube']);
    const fig = markdownToDoc(body).content![1];
    expect(fig.attrs).toEqual({ src: './gorsel.webp', alt: 'Yaprak çizimi', caption: 'Adaçayı yeşili bir yaprak' });
  });

  it('turns unknown HTML into literal text instead of dropping or rendering it', () => {
    const doc = markdownToDoc('<script>alert(1)</script>\n');
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0].type).toBe('paragraph');
    expect(doc.content![0].content![0].text).toContain('<script>');
  });

  it('skips empty paragraphs and handles an empty document', () => {
    expect(docToMarkdown({ type: 'doc', content: [{ type: 'paragraph' }, p(t('x')), { type: 'paragraph' }] }, 'tr')).toBe('x\n');
    expect(markdownToDoc('').content).toEqual([]);
  });
});

describe('readable source', () => {
  it('does not escape ordinary punctuation', () => {
    const doc: JSONContent = { type: 'doc', content: [p(t('Merhaba! Ali & Ayşe; &amp; kalır.'))] };
    const md = docToMarkdown(doc, 'tr');
    expect(md).toBe('Merhaba! Ali & Ayşe; \\&amp; kalır.\n');
    expect(norm(markdownToDoc(md))).toEqual(norm(doc));
  });
});
