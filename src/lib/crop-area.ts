/**
 * A crop as stored in posts and drafts: a rectangle in percent of the original image (0–100),
 * written "x,y,w,h". Shared by the site build, the preview and the panel.
 */
export type CropArea = { x: number; y: number; w: number; h: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The largest rectangle of the given ratio, centred. */
export function centredCrop(imgW: number, imgH: number, aspect: number): CropArea {
  if (imgW / imgH > aspect) {
    const w = ((imgH * aspect) / imgW) * 100;
    return { x: round2((100 - w) / 2), y: 0, w: round2(w), h: 100 };
  }
  const h = (imgW / aspect / imgH) * 100;
  return { x: 0, y: round2((100 - h) / 2), w: 100, h: round2(h) };
}

/** Keeps the area inside the image. */
export function clampCrop(a: CropArea): CropArea {
  const w = Math.min(100, Math.max(0, a.w));
  const h = Math.min(100, Math.max(0, a.h));
  return { x: Math.min(100 - w, Math.max(0, a.x)), y: Math.min(100 - h, Math.max(0, a.y)), w, h };
}

export function formatCrop(a: CropArea): string {
  return [a.x, a.y, a.w, a.h].map((n) => String(round2(n))).join(',');
}

const NUM = /^\d+(?:\.\d{1,2})?$/;

export function parseCrop(s: string): CropArea | null {
  const parts = s.split(',');
  if (parts.length !== 4 || !parts.every((p) => NUM.test(p))) return null;
  const [x, y, w, h] = parts.map(Number);
  if (w <= 0 || h <= 0 || x + w > 100.01 || y + h > 100.01) return null;
  return { x, y, w, h };
}
