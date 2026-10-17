// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Callout, Figure, Youtube } from '../../../src/admin/ui/editor/nodes';

const extensions = () => [StarterKit.configure({ heading: { levels: [2, 3] } }), Figure, Youtube, Callout];

describe('editor blocks survive copy/paste (review I4)', () => {
  it('a figure keeps its file, alt and caption through the editor HTML', () => {
    const a = new Editor({
      extensions: extensions(),
      content: { type: 'doc', content: [{ type: 'figure', attrs: { src: './yaprak.webp', alt: 'Yaprak "çizimi"', caption: 'Adaçayı & yaprak' } }] },
    });
    const b = new Editor({ extensions: extensions(), content: a.getHTML() });
    expect(b.getJSON().content?.[0]).toEqual({ type: 'figure', attrs: { src: './yaprak.webp', alt: 'Yaprak "çizimi"', caption: 'Adaçayı & yaprak' } });
    a.destroy();
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
