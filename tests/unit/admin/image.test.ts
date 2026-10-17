import { afterEach, describe, it, expect, vi } from 'vitest';
import { IMAGE_PRESETS, ImageError, coverCrop, fileNameFor, fitWithin, resizeImage } from '../../../src/admin/lib/image';

afterEach(() => vi.unstubAllGlobals());

describe('geometry', () => {
  it('fitWithin scales down and never up', () => {
    expect(fitWithin(4032, 3024, 1600, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(3024, 4032, 1600, 1600)).toEqual({ w: 1200, h: 1600 });
    expect(fitWithin(800, 600, 1600, 1600)).toEqual({ w: 800, h: 600 });
  });
  it('coverCrop keeps the target ratio, centred', () => {
    const c = coverCrop(4000, 3000, 1200, 630);
    expect(c.sw / c.sh).toBeCloseTo(1200 / 630, 2);
    expect(c.sw).toBe(4000);
    expect(c.sy).toBe(Math.round((3000 - c.sh) / 2));
    const tall = coverCrop(1000, 3000, 800, 880);
    expect(tall.sw).toBe(1000);
    expect(tall.sx).toBe(0);
    expect(tall.sh).toBe(1100);
  });
  it('the profile crop matches the portrait frame (1 : 1.1)', () => {
    expect(IMAGE_PRESETS.profile.crop).toEqual([800, 880]);
    expect(IMAGE_PRESETS.og).toMatchObject({ crop: [1200, 630], type: 'image/jpeg' });
  });
});

function stubCanvas(sizes: number[], encodes: (type: string) => string = (t) => t) {
  const draws: unknown[][] = [];
  const qualities: number[] = [];
  let call = 0;
  class FakeCanvas {
    constructor(
      public width: number,
      public height: number,
    ) {}
    getContext() {
      return { drawImage: (...args: unknown[]) => draws.push(args), imageSmoothingQuality: '' };
    }
    async convertToBlob(opts: { type: string; quality: number }) {
      qualities.push(opts.quality);
      const size = sizes[Math.min(call++, sizes.length - 1)];
      return new Blob([new Uint8Array(size)], { type: encodes(opts.type) });
    }
  }
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
  return { draws, qualities };
}

const photo = (type = 'image/jpeg', size = 1000) => new File([new Uint8Array(size)], 'IMG_0001.HEIC', { type });

describe('resizeImage', () => {
  it('decodes upright (EXIF), scales to the preset and returns WebP base64', async () => {
    const bitmap = vi.fn(async () => ({ width: 4032, height: 3024, close() {} }));
    vi.stubGlobal('createImageBitmap', bitmap);
    const { draws } = stubCanvas([5000]);
    const out = await resizeImage(photo(), IMAGE_PRESETS.body);
    expect(bitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: 'from-image' });
    expect(out).toMatchObject({ width: 1600, height: 1200 });
    expect(out.blob.type).toBe('image/webp');
    expect(out.base64.length).toBeGreaterThan(0);
    expect(draws[0].slice(-4)).toEqual([0, 0, 1600, 1200]);
  });

  it('lowers the quality until the file is under 1 MB', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 2000, height: 1000, close() {} }));
    const { qualities } = stubCanvas([2_000_000, 1_500_000, 400_000]);
    const out = await resizeImage(photo(), IMAGE_PRESETS.body);
    expect(qualities.map((q) => Math.round(q * 100))).toEqual([82, 72, 62]);
    expect(out.blob.size).toBe(400_000);
  });

  it('crops for the profile preset', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 3000, height: 4000, close() {} }));
    const { draws } = stubCanvas([1000]);
    const out = await resizeImage(photo(), IMAGE_PRESETS.profile);
    expect(out).toMatchObject({ width: 800, height: 880 });
    expect(draws[0].slice(-4)).toEqual([0, 0, 800, 880]);
  });

  it('an undecodable image gives the Turkish JPEG/PNG message', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new DOMException('decode failed');
    });
    stubCanvas([1000]);
    await expect(resizeImage(photo('image/heic'), IMAGE_PRESETS.body)).rejects.toThrow(
      new ImageError('Bu görsel açılamadı. Lütfen JPEG ya da PNG olarak deneyin.'),
    );
  });

  it('refuses files over 25 MB and non-images before decoding', async () => {
    const bitmap = vi.fn();
    vi.stubGlobal('createImageBitmap', bitmap);
    await expect(resizeImage(photo('image/jpeg', 30 * 1024 * 1024), IMAGE_PRESETS.body)).rejects.toThrow('Görsel çok büyük (en fazla 25 MB).');
    await expect(resizeImage(photo('application/pdf'), IMAGE_PRESETS.body)).rejects.toThrow(ImageError);
    expect(bitmap).not.toHaveBeenCalled();
  });
});

describe('resizeImage on browsers without WebP encoding (iPhone)', () => {
  it('falls back to JPEG and says so in the result', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 2000, height: 1500, close() {} }));
    // WebKit returns PNG when asked for WebP.
    stubCanvas([300_000], (t) => (t === 'image/webp' ? 'image/png' : t));
    const out = await resizeImage(photo(), IMAGE_PRESETS.body);
    expect(out.blob.type).toBe('image/jpeg');
    expect(out.ext).toBe('jpg');
  });
  it('reports webp when the browser can encode it', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 2000, height: 1500, close() {} }));
    stubCanvas([300_000]);
    expect((await resizeImage(photo(), IMAGE_PRESETS.body)).ext).toBe('webp');
  });
});

describe('fileNameFor', () => {
  it('names images after their alt text, uniquely', () => {
    expect(fileNameFor('Yaprak çizimi', new Set(['yaprak-cizimi.webp']))).toBe('yaprak-cizimi-2.webp');
    expect(fileNameFor('', new Set())).toBe('gorsel.webp');
    expect(fileNameFor('🌿', new Set(['gorsel.webp']))).toBe('gorsel-2.webp');
    expect(fileNameFor('Kapak', new Set(), 'jpg')).toBe('kapak.jpg');
  });
});
