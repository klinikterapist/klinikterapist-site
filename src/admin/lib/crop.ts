/**
 * One crop model for the cover and the body images: a rectangle in percent of the original image
 * (0–100), the same shape as react-easy-crop's `croppedAreaPercentages`. Stored as "x,y,w,h".
 */
import { clampCrop, type CropArea } from '../../lib/crop-area';
import { decodeBase64, drawAndEncode, fitWithin, type ResizedImage } from './image';

export { centredCrop, clampCrop, formatCrop, parseCrop, type CropArea } from '../../lib/crop-area';

/**
 * Renders `area` of the original into a new image. `{ w, h }` is the exact frame (a smaller crop
 * keeps the frame's ratio at its own size); `{ maxW }` keeps the crop's own ratio, long side at most maxW.
 */
export async function renderCrop(
  originalBase64: string,
  area: CropArea,
  out: { w: number; h: number } | { maxW: number },
  type: 'image/webp',
  q: number,
): Promise<ResizedImage> {
  const bitmap = await decodeBase64(originalBase64);
  try {
    const a = clampCrop(area);
    const src = {
      sx: (a.x / 100) * bitmap.width,
      sy: (a.y / 100) * bitmap.height,
      sw: Math.max(1, (a.w / 100) * bitmap.width),
      sh: Math.max(1, (a.h / 100) * bitmap.height),
    };
    let size: { w: number; h: number };
    if ('maxW' in out) {
      size = fitWithin(src.sw, src.sh, out.maxW, out.maxW);
    } else {
      const w = Math.max(1, Math.min(out.w, Math.round(src.sw)));
      size = { w, h: Math.max(1, Math.round((w * out.h) / out.w)) };
    }
    return await drawAndEncode(bitmap, src, size, type, q);
  } finally {
    bitmap.close();
  }
}
