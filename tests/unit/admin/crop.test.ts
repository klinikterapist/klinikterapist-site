import { afterEach, describe, it, expect, vi } from 'vitest';
import { centredCrop, clampCrop, formatCrop, parseCrop, renderCrop } from '../../../src/admin/lib/crop';
import { base64Mime } from '../../../src/admin/lib/image';

afterEach(() => vi.unstubAllGlobals());

describe('crop model', () => {
  it('centredCrop of a square photo at 16:9', () => {
    const a = centredCrop(1600, 1600, 16 / 9);
    expect(a).toEqual({ x: 0, y: 21.88, w: 100, h: 56.25 });
  });
  it('centredCrop of a portrait photo keeps the full width', () => {
    const a = centredCrop(900, 1600, 16 / 9);
    expect(a.w).toBe(100);
    expect(a.x).toBe(0);
    expect((a.w * 900) / (a.h * 1600)).toBeCloseTo(16 / 9, 2);
  });
  it('centredCrop of a wide photo keeps the full height', () => {
    const a = centredCrop(4000, 1000, 1);
    expect(a).toEqual({ x: 37.5, y: 0, w: 25, h: 100 });
  });
  it('formatCrop and parseCrop round-trip', () => {
    const a = { x: 12.5, y: 0, w: 80.25, h: 56.25 };
    expect(formatCrop(a)).toBe('12.5,0,80.25,56.25');
    expect(parseCrop(formatCrop(a))).toEqual(a);
    expect(formatCrop({ x: 1 / 3, y: 0, w: 50, h: 50 })).toBe('0.33,0,50,50');
  });
  it('parseCrop rejects overflow, non-numbers and negatives', () => {
    expect(parseCrop('10,10,95,10')).toBeNull();
    expect(parseCrop('a,b,c,d')).toBeNull();
    expect(parseCrop('-1,0,50,50')).toBeNull();
    expect(parseCrop('0,0,0,50')).toBeNull();
    expect(parseCrop('0,0,50')).toBeNull();
    expect(parseCrop('0,21.88,100,56.25')).toEqual({ x: 0, y: 21.88, w: 100, h: 56.25 });
  });
  it('clampCrop keeps the area inside the image', () => {
    expect(clampCrop({ x: 90, y: -5, w: 20, h: 120 })).toEqual({ x: 80, y: 0, w: 20, h: 100 });
  });
  it('base64Mime reads the first bytes', () => {
    expect(base64Mime('/9j/4AAQ')).toBe('image/jpeg');
    expect(base64Mime('iVBORw0K')).toBe('image/png');
    expect(base64Mime('UklGRiQA')).toBe('image/webp');
  });
});

describe('renderCrop', () => {
  function stub(bw: number, bh: number) {
    const draws: unknown[][] = [];
    const sizes: Array<[number, number]> = [];
    class FakeCanvas {
      constructor(
        public width: number,
        public height: number,
      ) {
        sizes.push([width, height]);
      }
      getContext() {
        return { drawImage: (...args: unknown[]) => draws.push(args), imageSmoothingQuality: '' };
      }
      async convertToBlob(opts: { type: string }) {
        return new Blob(['x'], { type: opts.type });
      }
    }
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', async () => ({ width: bw, height: bh, close }));
    return { draws, sizes, close };
  }

  it('draws the area of the original onto the exact frame', async () => {
    const s = stub(2000, 2000);
    const out = await renderCrop('UklGRiQA', { x: 0, y: 21.88, w: 100, h: 56.25 }, { w: 1600, h: 900 }, 'image/webp', 0.82);
    expect(s.sizes[0]).toEqual([1600, 900]);
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = s.draws[0] as number[];
    expect([sx, sw, dx, dy, dw, dh]).toEqual([0, 2000, 0, 0, 1600, 900]);
    expect(sy).toBeCloseTo(437.6, 1);
    expect(sh).toBeCloseTo(1125, 1);
    expect(out.ext).toBe('webp');
    expect(s.close).toHaveBeenCalled();
  });
  it('a small crop keeps the frame ratio at its own size', async () => {
    const s = stub(800, 800);
    await renderCrop('UklGRiQA', { x: 0, y: 0, w: 100, h: 56.25 }, { w: 1600, h: 900 }, 'image/webp', 0.82);
    expect(s.sizes[0]).toEqual([800, 450]);
  });
  it('{ maxW } keeps the crop ratio with the long side capped', async () => {
    const s = stub(3000, 2000);
    await renderCrop('UklGRiQA', { x: 0, y: 0, w: 50, h: 100 }, { maxW: 1600 }, 'image/webp', 0.82);
    expect(s.sizes[0]).toEqual([1500, 2000].map((n) => Math.round(n * 0.8)) as [number, number]);
  });
});
