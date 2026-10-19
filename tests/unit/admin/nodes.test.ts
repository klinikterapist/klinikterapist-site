// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Callout, Figure, Youtube, applyFigureEdit } from '../../../src/admin/ui/editor/nodes';

const extensions = () => [StarterKit.configure({ heading: { levels: [2, 3] } }), Figure, Youtube, Callout];

describe('editor blocks survive copy/paste (review I4)', () => {
  it('a figure keeps its file, alt and caption through the editor HTML', () => {
    const a = new Editor({
      extensions: extensions(),
      content: { type: 'doc', content: [{ type: 'figure', attrs: { src: './yaprak.webp', alt: 'Yaprak "çizimi"', caption: 'Adaçayı & yaprak' } }] },
    });
    const b = new Editor({ extensions: extensions(), content: a.getHTML() });
    expect(b.getJSON().content?.[0]).toEqual({
      type: 'figure',
      attrs: { src: './yaprak.webp', alt: 'Yaprak "çizimi"', caption: 'Adaçayı & yaprak', shape: 'original', size: 'full', crop: null, orig: null },
    });
    a.destroy();
    b.destroy();
  });

  it('a shaped figure keeps its shape, size, crop and original through the editor HTML', () => {
    const attrs = { src: './foto.webp', alt: 'Foto', caption: '', shape: 'circle', size: 'md', crop: '10,0,80,80', orig: 'foto-orig.webp' };
    const a = new Editor({ extensions: extensions(), content: { type: 'doc', content: [{ type: 'figure', attrs }] } });
    const b = new Editor({ extensions: extensions(), content: a.getHTML() });
    expect(b.getJSON().content?.[0]).toEqual({ type: 'figure', attrs });
    a.destroy();
    b.destroy();
  });

  it('pasted HTML with an unknown shape or a bad original name falls back to a plain figure', () => {
    const html = '<figure data-figure="" data-src="./x.webp" data-alt="" data-caption="" data-shape="star" data-size="huge" data-crop="10,10,95,10" data-orig="../x.webp"></figure>';
    const b = new Editor({ extensions: extensions(), content: html });
    expect(b.getJSON().content?.[0].attrs).toMatchObject({ shape: 'original', size: 'full', crop: null, orig: null });
    b.destroy();
  });

  it('a YouTube block keeps its video id', () => {
    const a = new Editor({ extensions: extensions(), content: { type: 'doc', content: [{ type: 'youtube', attrs: { id: 'dQw4w9WgXcQ' } }] } });
    const b = new Editor({ extensions: extensions(), content: a.getHTML() });
    expect(b.getJSON().content?.[0]).toEqual({ type: 'youtube', attrs: { id: 'dQw4w9WgXcQ' } });
    a.destroy();
    b.destroy();
  });
});

describe('applyFigureEdit', () => {
  const edit = { shape: 'circle' as const, size: 'md' as const, area: { x: 10, y: 0, w: 80, h: 80 } };
  const store = () => {
    const added: string[] = [];
    return { added, url: async () => null, add: vi.fn(async (name: string) => void added.push(name)), names: () => new Set(['foto.webp', ...added]) };
  };
  afterEach(() => vi.unstubAllGlobals());
  const stubCanvas = (webp: string) => {
    class FakeCanvas {
      constructor(public width: number, public height: number) {}
      getContext() {
        return { drawImage: () => {}, imageSmoothingQuality: '' };
      }
      async convertToBlob(opts: { type: string }) {
        // Like Safari when `webp` is 'image/png': it cannot write WebP and falls back to JPEG.
        return new Blob(['x'], { type: opts.type === 'image/webp' ? webp : opts.type });
      }
    }
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    vi.stubGlobal('createImageBitmap', async () => ({ width: 2000, height: 1000, close() {} }));
  };

  it('an older figure becomes its own original, then the crop replaces the image under the same name', async () => {
    stubCanvas('image/webp');
    const s = store();
    const attrs = await applyFigureEdit(s, { src: './foto.webp', orig: null }, 'UklGRiQA', edit);
    expect(s.added).toEqual(['foto-orig.webp', 'foto.webp']);
    expect(attrs).toEqual({ src: './foto.webp', shape: 'circle', size: 'md', crop: '10,0,80,80', orig: 'foto-orig.webp' });
  });

  it('a figure with an original keeps it; a format switch (Safari) gets a new name', async () => {
    stubCanvas('image/png');
    const s = store();
    const attrs = await applyFigureEdit(s, { src: './foto.webp', orig: 'foto-orig.webp' }, 'UklGRiQA', edit);
    expect(s.added).toEqual(['foto.jpg']);
    expect(attrs).toMatchObject({ src: './foto.jpg', orig: 'foto-orig.webp' });
  });
});
