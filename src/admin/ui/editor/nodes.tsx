/** Custom editor blocks: figure (image + caption + alt), YouTube box, callout. */
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { useEffect, useState } from 'react';

export type FigureOptions = { resolveUrl: (src: string) => Promise<string | null> };

function FigureView({ node, updateAttributes, deleteNode, selected, extension }: ReactNodeViewProps) {
  const { src, alt, caption } = node.attrs as { src: string; alt: string; caption: string };
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    (extension.options as FigureOptions).resolveUrl(src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [src, extension.options]);
  return (
    <NodeViewWrapper as="figure" className={`ed-figure ${selected ? 'is-selected' : ''}`} data-drag-handle="">
      {url ? (
        <img src={url} alt={alt} />
      ) : (
        <div className="ed-figure-missing">{url === null ? 'Görsel bulunamadı. Kaldırıp yeniden ekleyin.' : 'Görsel yükleniyor…'}</div>
      )}
      <div className="ed-figure-fields" contentEditable={false}>
        <input
          className="ed-figure-caption"
          aria-label="Görsel altyazısı"
          placeholder="Altyazı (isteğe bağlı)"
          value={caption}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
        />
        <input
          className="ed-figure-alt"
          aria-label="Alt metin"
          placeholder="Alt metin: görselde ne var? (görme engelliler ve Google için)"
          value={alt}
          onChange={(e) => updateAttributes({ alt: e.target.value })}
        />
        <button type="button" className="linklike" onClick={deleteNode}>
          Görseli kaldır
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export const Figure = Node.create<FigureOptions>({
  name: 'figure',
  group: 'block',
  atom: true,
  draggable: true,
  addOptions() {
    return { resolveUrl: async () => null };
  },
  addAttributes() {
    return { src: { default: '' }, alt: { default: '' }, caption: { default: '' } };
  },
  // Copy/paste goes through this HTML, so it must carry every attribute.
  parseHTML() {
    return [
      {
        tag: 'figure[data-figure]',
        getAttrs: (el) => {
          const d = (el as HTMLElement).dataset;
          return { src: d.src ?? '', alt: d.alt ?? '', caption: d.caption ?? '' };
        },
      },
    ];
  },
  renderHTML({ node }) {
    return ['figure', mergeAttributes({ 'data-figure': '', 'data-src': node.attrs.src, 'data-alt': node.attrs.alt, 'data-caption': node.attrs.caption })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
});

function YoutubeView({ node, deleteNode, selected }: ReactNodeViewProps) {
  const id = String(node.attrs.id);
  return (
    <NodeViewWrapper className={`ed-youtube ${selected ? 'is-selected' : ''}`} data-drag-handle="">
      <div contentEditable={false}>
        <p>
          <strong>YouTube videosu</strong> · {id}
        </p>
        <p className="ed-muted">Sitede okur tıklayınca açılır (o zamana kadar YouTube'a bağlanılmaz).</p>
        <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer">
          Videoyu yeni sekmede aç
        </a>{' '}
        ·{' '}
        <button type="button" className="linklike" onClick={deleteNode}>
          Kaldır
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export const Youtube = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { id: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-youtube]', getAttrs: (el) => ({ id: (el as HTMLElement).dataset.youtube }) }];
  },
  renderHTML({ node }) {
    return ['div', { 'data-youtube': node.attrs.id }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(YoutubeView);
  },
});

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  parseHTML() {
    return [{ tag: 'aside.callout' }];
  },
  renderHTML() {
    return ['aside', { class: 'callout ed-callout' }, 0];
  },
});
