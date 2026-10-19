import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { SHAPES, SIZES, frameAttrsOf, frameOpen, isPlainFrame, parseFrameOpen, publicFrameOpen, type FrameAttrs } from '../../src/lib/figure-frame';
import { docToMarkdown, markdownToDoc } from '../../src/admin/lib/markdown';
import { renderPreviewHtml } from '../../src/admin/lib/preview';
import { newDraft } from '../../src/admin/lib/draft';
import type { LangFields } from '../../src/admin/api/types';

describe('figure frame tag', () => {
  it('round-trips every shape and size', () => {
    for (const shape of SHAPES)
      for (const size of SIZES) {
        const a: FrameAttrs = { shape, size, crop: '10,0,80,80', orig: 'foto-orig.webp' };
        expect(parseFrameOpen(frameOpen(a))).toEqual(a);
        expect(parseFrameOpen(frameOpen({ shape, size, crop: null, orig: null }))).toEqual({ shape, size, crop: null, orig: null });
      }
  });
  it('writes the exact tag', () => {
    expect(frameOpen({ shape: 'circle', size: 'md', crop: '10,0,80,80', orig: 'foto-orig.webp' })).toBe(
      '<div class="figure" data-shape="circle" data-size="md" data-crop="10,0,80,80" data-orig="./foto-orig.webp">',
    );
    expect(publicFrameOpen({ shape: 'circle', size: 'md', crop: '10,0,80,80', orig: 'foto-orig.webp' })).toBe('<div class="figure" data-shape="circle" data-size="md">');
  });
  it('refuses anything but the exact tag', () => {
    expect(parseFrameOpen('<div class="figure" data-shape="star" data-size="full">')).toBeNull();
    expect(parseFrameOpen('<div class="figure" data-shape="circle" data-size="md" onclick="x">')).toBeNull();
    expect(parseFrameOpen('<div class="figure" data-shape="circle" data-size="md" data-orig="../x.webp">')).toBeNull();
    expect(parseFrameOpen('<div class="figure" data-shape="circle" data-size="md" data-crop="10,10,95,10">')).toBeNull();
    expect(parseFrameOpen('<div class="figure" data-size="md" data-shape="circle">')).toBeNull();
  });
  it('frameAttrsOf repairs hand-edited attrs; a plain figure has no wrapper', () => {
    expect(frameAttrsOf({ shape: 'star', size: 'huge', crop: 'x', orig: 'A B.webp' })).toEqual({ shape: 'original', size: 'full', crop: null, orig: null });
    expect(isPlainFrame(frameAttrsOf(undefined))).toBe(true);
    expect(isPlainFrame({ shape: 'original', size: 'full', crop: '0,0,50,50', orig: null })).toBe(false);
  });
});

const fig = (attrs: Record<string, unknown>): JSONContent => ({ type: 'figure', attrs: { src: './foto.webp', alt: 'Foto', caption: 'Yazı', ...attrs } });
const docOf = (...c: JSONContent[]): JSONContent => ({ type: 'doc', content: c });

describe('figure wrapper in the Markdown', () => {
  it('a plain figure is written without a wrapper', () => {
    expect(docToMarkdown(docOf(fig({})), 'tr')).toBe('![Foto](./foto.webp "Yazı")\n');
    expect(docToMarkdown(docOf(fig({ shape: 'original', size: 'full', crop: null, orig: 'foto-orig.webp' })), 'tr')).toBe('![Foto](./foto.webp "Yazı")\n');
  });
  it('a shaped figure round-trips', () => {
    const attrs = { shape: 'circle', size: 'md', crop: '10,0,80,80', orig: 'foto-orig.webp' };
    const md = docToMarkdown(docOf(fig(attrs)), 'tr');
    expect(md).toBe('<div class="figure" data-shape="circle" data-size="md" data-crop="10,0,80,80" data-orig="./foto-orig.webp">\n\n![Foto](./foto.webp "Yazı")\n\n</div>\n');
    expect(markdownToDoc(md).content).toEqual([fig(attrs)]);
  });
  it('a shaped figure between paragraphs keeps its neighbours', () => {
    const p = (text: string): JSONContent => ({ type: 'paragraph', content: [{ type: 'text', text }] });
    const d = docOf(p('Önce.'), fig({ shape: 'rect-portrait', size: 'sm', crop: '0,0,100,50', orig: 'foto-orig.jpg' }), p('Sonra.'));
    expect(markdownToDoc(docToMarkdown(d, 'tr'))).toEqual(d);
  });
  it('an unknown wrapper stays text', () => {
    const doc = markdownToDoc('<div class="figure" data-shape="star" data-size="full">\n\n![a](./x.webp)\n\n</div>');
    expect(doc.content?.[0]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: '<div class="figure" data-shape="star" data-size="full">' }] });
    expect(doc.content?.[1]).toMatchObject({ type: 'figure', attrs: { src: './x.webp' } });
    expect(doc.content?.[1].attrs?.shape).toBeUndefined();
  });
  it('a wrapper around anything but one image stays text', () => {
    const doc = markdownToDoc('<div class="figure" data-shape="circle" data-size="md">\n\nMetin\n\n</div>');
    expect(doc.content?.map((n) => n.type)).toEqual(['paragraph', 'paragraph', 'paragraph']);
    expect(doc.content?.some((n) => n.type === 'figure')).toBe(false);
  });
});

const fields = (doc: JSONContent): LangFields => ({
  title: 'Başlık', subtitle: '', seoTitle: '', slug: 'b', slugTouched: false, description: 'A', focusKeyword: '', coverAlt: '', references: [], doc,
});

describe('figure wrapper in the preview', () => {
  const draft = (doc: JSONContent) => ({ ...newDraft(new Date('2026-10-17T10:00:00')), tr: fields(doc), en: fields(docOf()) });
  const urls = (n: string) => (n === 'foto.webp' ? 'blob:x/foto' : null);
  it('renders the shaped figure as the site does, without the crop data', () => {
    const html = renderPreviewHtml(draft(docOf(fig({ shape: 'circle', size: 'md', crop: '10,0,80,80', orig: 'foto-orig.webp' }))), 'tr', urls);
    expect(html).toMatch(/<div class="figure" data-shape="circle" data-size="md">\s*<figure><img src="blob:x\/foto" alt="Foto"><figcaption>Yazı<\/figcaption><\/figure>\s*<\/div>/);
    expect(html).not.toContain('orig');
  });
  it('escapes an unknown wrapper and a stray </div>', () => {
    const md = (text: string): JSONContent => ({ type: 'paragraph', content: [{ type: 'text', text }] });
    // Hand-written Markdown reaches the preview through the doc as text, so it is escaped as text.
    const html = renderPreviewHtml(draft(docOf(md('<div class="figure" data-shape="star" data-size="full">'), md('</div>'))), 'tr', urls);
    expect(html).toContain('&lt;div class=&quot;figure&quot; data-shape=&quot;star&quot;');
    expect(html).not.toMatch(/<\/div>\s*<\/div>\s*<\/div>\s*$/);
    expect(html).not.toContain('data-shape="star"');
  });
});
