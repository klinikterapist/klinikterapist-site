/**
 * Image uploads are resized in the browser (spec §6): WebP for post and profile images, JPEG for
 * the share image. Photos are decoded upright using their EXIF orientation.
 */
import { slugify } from '../../lib/slug';

type Fit = { maxW: number; maxH: number; type: 'image/webp' | 'image/jpeg'; q: number };
type Crop = { crop: [number, number]; type: 'image/webp' | 'image/jpeg'; q: number };
export type ImagePreset = Fit | Crop;

export const IMAGE_PRESETS = {
  body: { maxW: 1600, maxH: 1600, type: 'image/webp', q: 0.82 },
  cover: { maxW: 1600, maxH: 1600, type: 'image/webp', q: 0.82 },
  /** Not cropped: both home page styles crop the portrait with CSS. */
  profile: { maxW: 1600, maxH: 1600, type: 'image/webp', q: 0.85 },
  resource: { maxW: 400, maxH: 600, type: 'image/webp', q: 0.82 },
  /** Kept next to a cropped cover or figure (`<name>-orig.<ext>`), so the crop can be changed later. */
  original: { maxW: 2000, maxH: 2000, type: 'image/webp', q: 0.85 },
  og: { crop: [1200, 630], type: 'image/jpeg', q: 0.85 },
} as const satisfies Record<string, ImagePreset>;

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageError';
  }
}

const MAX_INPUT = 25 * 1024 * 1024;
const MAX_OUTPUT = 1024 * 1024;
const ACCEPTED = /^image\/(jpeg|png|webp|gif|heic|heif)$/;

export function fitWithin(w: number, h: number, maxW: number, maxH: number): { w: number; h: number } {
  const scale = Math.min(1, maxW / w, maxH / h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

export function coverCrop(w: number, h: number, targetW: number, targetH: number): { sx: number; sy: number; sw: number; sh: number } {
  const ratio = targetW / targetH;
  if (w / h > ratio) {
    const sw = Math.round(h * ratio);
    return { sx: Math.round((w - sw) / 2), sy: 0, sw, sh: h };
  }
  const sh = Math.round(w / ratio);
  return { sx: 0, sy: Math.round((h - sh) / 2), sw: w, sh };
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

type Canvas = { width: number; height: number; getContext(t: '2d'): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null };

function makeCanvas(w: number, h: number): { canvas: Canvas; encode: (type: string, q: number) => Promise<Blob> } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    return { canvas, encode: (type, quality) => canvas.convertToBlob({ type, quality }) };
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return {
    canvas,
    encode: (type, quality) =>
      new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), type, quality)),
  };
}

export type ResizedImage = { blob: Blob; base64: string; width: number; height: number; type: 'image/webp' | 'image/jpeg'; ext: 'webp' | 'jpg' };

export async function resizeImage(file: File, preset: ImagePreset): Promise<ResizedImage> {
  if (file.size > MAX_INPUT) throw new ImageError('Görsel çok büyük (en fazla 25 MB).');
  if (!ACCEPTED.test(file.type)) throw new ImageError('Bu dosya bir görsel değil. JPEG, PNG ya da WebP seçin.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError('Bu görsel açılamadı. Lütfen JPEG ya da PNG olarak deneyin.');
  }
  try {
    let src = { sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height };
    let out: { w: number; h: number };
    if ('crop' in preset) {
      src = coverCrop(bitmap.width, bitmap.height, preset.crop[0], preset.crop[1]);
      out = fitWithin(src.sw, src.sh, preset.crop[0], preset.crop[1]);
      // A small photo still gets the exact frame ratio.
      out = { w: Math.min(preset.crop[0], out.w), h: Math.round(Math.min(preset.crop[0], out.w) * (preset.crop[1] / preset.crop[0])) };
    } else {
      out = fitWithin(bitmap.width, bitmap.height, preset.maxW, preset.maxH);
    }
    return await drawAndEncode(bitmap, src, out, preset.type, preset.q);
  } finally {
    bitmap.close();
  }
}

type Rect = { sx: number; sy: number; sw: number; sh: number };

/**
 * Draws `src` of the image onto a canvas of `out` and encodes it. Safari (every browser on iPhone)
 * cannot encode WebP and returns PNG instead: JPEG is used there. Quality steps down until the
 * file fits in 1 MB.
 */
export async function drawAndEncode(
  image: CanvasImageSource,
  src: Rect,
  out: { w: number; h: number },
  preferred: 'image/webp' | 'image/jpeg',
  q: number,
): Promise<ResizedImage> {
  const { canvas, encode } = makeCanvas(out.w, out.h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('Bu tarayıcı görseli küçültemedi. Başka bir tarayıcı deneyin.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, src.sx, src.sy, src.sw, src.sh, 0, 0, out.w, out.h);

  let type = preferred;
  let quality = q;
  let blob = await encode(type, quality);
  if (blob.type !== type && type === 'image/webp') {
    type = 'image/jpeg';
    blob = await encode(type, quality);
  }
  if (blob.type !== type) throw new ImageError('Bu tarayıcı görseli kaydedemedi. Başka bir tarayıcı deneyin.');
  while (blob.size > MAX_OUTPUT && quality > 0.5 + 1e-9) {
    quality = Math.round((quality - 0.1) * 100) / 100;
    blob = await encode(type, quality);
  }
  return { blob, base64: await toBase64(blob), width: out.w, height: out.h, type, ext: type === 'image/jpeg' ? 'jpg' : 'webp' };
}

/** The MIME type of an image stored as base64, from its first bytes. */
export function base64Mime(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lG')) return 'image/gif';
  return 'image/webp';
}

/** Decodes an image kept as base64 (an uploaded original or a committed post image). */
export async function decodeBase64(base64: string): Promise<ImageBitmap> {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  try {
    return await createImageBitmap(new Blob([bytes], { type: base64Mime(base64) }));
  } catch {
    throw new ImageError('Bu görsel açılamadı. Lütfen görseli yeniden yükleyin.');
  }
}

export function fileNameFor(alt: string, used: Set<string>, ext: 'webp' | 'jpg' = 'webp'): string {
  const base = slugify(alt, 'tr').slice(0, 50).replace(/-+$/, '') || 'gorsel';
  let name = `${base}.${ext}`;
  for (let i = 2; used.has(name); i++) name = `${base}-${i}.${ext}`;
  return name;
}
