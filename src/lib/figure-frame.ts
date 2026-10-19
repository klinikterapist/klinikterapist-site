/**
 * Shape, size and crop of a body image, kept in a wrapper around the image paragraph:
 *
 *   <div class="figure" data-shape="circle" data-size="md" data-crop="10,0,80,80" data-orig="./foto-orig.webp">
 *
 *   ![alt](./foto.webp "Caption")
 *
 *   </div>
 *
 * Only this exact tag counts; anything else stays text. A plain figure (Özgün, full width, no crop)
 * has no wrapper, so older posts stay as they are. Shared by the site build, the preview and the panel.
 */
import { parseCrop } from './crop-area';

export type Shape = 'original' | 'rect' | 'rect-portrait' | 'square' | 'pill' | 'circle';
export type Size = 'full' | 'md' | 'sm';
/** `crop` is the `formatCrop` string; `orig` the original's image name without `./`. */
export type FrameAttrs = { shape: Shape; size: Size; crop: string | null; orig: string | null };

export const SHAPES: readonly Shape[] = ['original', 'rect', 'rect-portrait', 'square', 'pill', 'circle'];
export const SIZES: readonly Size[] = ['full', 'md', 'sm'];

/** Width / height of each shape; null keeps the image's own ratio. */
export const ASPECT: Record<Shape, number | null> = { original: null, rect: 3 / 2, 'rect-portrait': 2 / 3, square: 1, pill: 2, circle: 1 };

export const FRAME_OPEN =
  /^<div class="figure" data-shape="(original|rect|rect-portrait|square|pill|circle)" data-size="(full|md|sm)"(?: data-crop="([0-9.,]+)")?(?: data-orig="\.\/([a-z0-9-]+\.(?:webp|jpg))")?>$/;
export const FRAME_CLOSE = '</div>';

const ORIG_NAME = /^[a-z0-9-]+\.(?:webp|jpg)$/;

export const PLAIN_FRAME: FrameAttrs = { shape: 'original', size: 'full', crop: null, orig: null };

/** Node attrs as stored (maybe hand-edited) → valid frame attrs; anything unknown falls back. */
export function frameAttrsOf(a: Record<string, unknown> | undefined): FrameAttrs {
  const shape = SHAPES.includes(a?.shape as Shape) ? (a!.shape as Shape) : 'original';
  const size = SIZES.includes(a?.size as Size) ? (a!.size as Size) : 'full';
  const crop = typeof a?.crop === 'string' && parseCrop(a.crop) ? a.crop : null;
  const orig = typeof a?.orig === 'string' && ORIG_NAME.test(a.orig) ? a.orig : null;
  return { shape, size, crop, orig };
}

export const isPlainFrame = (a: FrameAttrs) => a.shape === 'original' && a.size === 'full' && !a.crop;

export function frameOpen(a: FrameAttrs): string {
  return (
    `<div class="figure" data-shape="${a.shape}" data-size="${a.size}"` +
    (a.crop ? ` data-crop="${a.crop}"` : '') +
    (a.orig ? ` data-orig="./${a.orig}"` : '') +
    '>'
  );
}

/** What visitors get: the shape and size only (the crop data and the original are for the panel). */
export const publicFrameOpen = (a: FrameAttrs) => `<div class="figure" data-shape="${a.shape}" data-size="${a.size}">`;

export function parseFrameOpen(tag: string): FrameAttrs | null {
  const m = tag.match(FRAME_OPEN);
  if (!m) return null;
  const crop = m[3] ?? null;
  if (crop !== null && !parseCrop(crop)) return null;
  return { shape: m[1] as Shape, size: m[2] as Size, crop, orig: m[4] ?? null };
}
