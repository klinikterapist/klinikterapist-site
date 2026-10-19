/** Custom editor blocks: figure (image + caption + alt), YouTube box, callout. */
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCrop, parseCrop, renderCrop } from '../../lib/crop';
import { ImageError, fileNameFor } from '../../lib/image';
import { ASPECT, frameAttrsOf, type FrameAttrs, type Shape } from '../../../lib/figure-frame';
import type { ImageStore } from './images';
import { ImageEditDialog, type ImageEdit } from './ImageEditDialog';

export type FigureOptions = {
  resolveUrl: (src: string) => Promise<string | null>;
  /** Where "Düzenle" reads the original and stores the new crop; without it there is no "Düzenle". */
  store: Pick<ImageStore, 'url' | 'add' | 'names'> | null;
  onError: (message: string | null) => void;
};

type FigureAttrs = { src: string; alt: string; caption: string } & FrameAttrs;

const nameOf = (src: string) => src.replace(/^\.\//, '');
const extOf = (name: string): 'webp' | 'jpg' => (name.endsWith('.jpg') ? 'jpg' : 'webp');
const base64Of = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);

/** Output frame of a shape: Özgün keeps the crop's ratio; the others put 1600 px on the long side. */
function outSize(shape: Shape): { w: number; h: number } | { maxW: number } {
  const ratio = ASPECT[shape];
  if (ratio === null) return { maxW: 1600 };
  return ratio >= 1 ? { w: 1600, h: Math.round(1600 / ratio) } : { w: Math.round(1600 * ratio), h: 1600 };
}

/**
 * Renders the edit from the original and stores it under the figure's name (a new name only when
 * the browser had to switch format). A figure without an original becomes its own original first.
 */
export async function applyFigureEdit(
  store: NonNullable<FigureOptions['store']>,
  a: Pick<FigureAttrs, 'src' | 'orig'>,
  originalBase64: string,
  edit: ImageEdit,
): Promise<Partial<FigureAttrs>> {
  const src = nameOf(a.src);
  let orig = a.orig;
  if (!orig) {
    orig = fileNameFor(`${src.replace(/\.[^.]+$/, '')}-orig`, store.names(), extOf(src));
    await store.add(orig, originalBase64);
  }
  const out = await renderCrop(originalBase64, edit.area, outSize(edit.shape), 'image/webp', 0.82);
  const name = out.ext === extOf(src) ? src : fileNameFor(src.replace(/\.[^.]+$/, ''), store.names(), out.ext);
  await store.add(name, out.base64);
  return { src: `./${name}`, shape: edit.shape, size: edit.size, crop: formatCrop(edit.area), orig };
}

function FigureView({ node, updateAttributes, deleteNode, selected, extension }: ReactNodeViewProps) {
  const attrs = node.attrs as FigureAttrs;
  const { src, alt, caption } = attrs;
  const frame = frameAttrsOf(attrs);
  const options = extension.options as FigureOptions;
  const storage = extension.storage as FigureStorage;
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<{ url: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    options.resolveUrl(src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [src, options, version]);

  const openEdit = async () => {
    if (!options.store) return;
    setBusy(true);
    options.onError(null);
    try {
      const dataUrl = await options.store.url(frame.orig ?? nameOf(src));
      if (!dataUrl) throw new ImageError('Görsel açılamadı. Kaldırıp yeniden ekleyin.');
      setEditing({ url: dataUrl, base64: base64Of(dataUrl) });
    } catch (e) {
      options.onError(e instanceof ImageError ? e.message : 'Görsel açılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  // A freshly inserted image opens "Görseli düzenle" at once.
  useEffect(() => {
    if (storage.openFor && storage.openFor === src) {
      storage.openFor = null;
      openEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = async (edit: ImageEdit) => {
    if (!options.store || !editing) return;
    setBusy(true);
    options.onError(null);
    try {
      updateAttributes(await applyFigureEdit(options.store, attrs, editing.base64, edit));
      setVersion((v) => v + 1);
      setEditing(null);
    } catch (e) {
      options.onError(e instanceof ImageError ? e.message : 'Görsel kaydedilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <NodeViewWrapper
      as="figure"
      className={`ed-figure figure ${selected ? 'is-selected' : ''}`}
      data-shape={frame.shape}
      data-size={frame.size}
      data-drag-handle=""
      aria-busy={busy || undefined}
    >
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
        <div className="ed-figure-buttons">
          {options.store && url && (
            <button type="button" className="linklike" onClick={openEdit} disabled={busy}>
              Düzenle
            </button>
          )}
          <button type="button" className="linklike" onClick={deleteNode}>
            Görseli kaldır
          </button>
        </div>
      </div>
      {/* Outside the editable text, so dragging the crop never drags the image block. */}
      {editing &&
        createPortal(
          <ImageEditDialog
            imageUrl={editing.url}
            shape={frame.shape}
            size={frame.size}
            crop={frame.crop ? parseCrop(frame.crop) : null}
            onApply={apply}
            onClose={() => setEditing(null)}
          />,
          document.body,
        )}
    </NodeViewWrapper>
  );
}

/** `openFor`: the src of an image just inserted, whose view opens "Görseli düzenle" when it mounts. */
type FigureStorage = { openFor: string | null };

declare module '@tiptap/core' {
  interface Storage {
    figure: FigureStorage;
  }
}

const fromData = (d: DOMStringMap): FrameAttrs => frameAttrsOf({ shape: d.shape, size: d.size, crop: d.crop, orig: d.orig });

export const Figure = Node.create<FigureOptions, FigureStorage>({
  name: 'figure',
  group: 'block',
  atom: true,
  draggable: true,
  addOptions() {
    return { resolveUrl: async () => null, store: null, onError: () => {} };
  },
  addStorage() {
    return { openFor: null };
  },
  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      shape: { default: 'original' },
      size: { default: 'full' },
      crop: { default: null },
      orig: { default: null },
    };
  },
  // Copy/paste goes through this HTML, so it must carry every attribute.
  parseHTML() {
    return [
      {
        tag: 'figure[data-figure]',
        getAttrs: (el) => {
          const d = (el as HTMLElement).dataset;
          return { src: d.src ?? '', alt: d.alt ?? '', caption: d.caption ?? '', ...fromData(d) };
        },
      },
    ];
  },
  renderHTML({ node }) {
    const f = frameAttrsOf(node.attrs);
    return [
      'figure',
      mergeAttributes({
        'data-figure': '',
        'data-src': node.attrs.src,
        'data-alt': node.attrs.alt,
        'data-caption': node.attrs.caption,
        'data-shape': f.shape,
        'data-size': f.size,
        ...(f.crop ? { 'data-crop': f.crop } : {}),
        ...(f.orig ? { 'data-orig': f.orig } : {}),
      }),
    ];
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
