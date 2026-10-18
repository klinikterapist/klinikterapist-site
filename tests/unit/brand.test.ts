import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const sun = readFileSync('src/assets/brand/sun.svg', 'utf8');

/** The `d` of the path with the given class. */
const pathD = (svg: string, cls: string) => svg.match(new RegExp(`<path class="${cls}" d="([^"]+)"`))?.[1] ?? '';

/** Every x,y pair in an absolute-coordinate path (M/C/L/Z only). */
const points = (d: string): [number, number][] =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe('sun mark source', () => {
  it('has a 0 0 100 100 viewBox', () => {
    expect(sun).toMatch(/viewBox="0 0 100 100"/);
  });

  it('has exactly three paths in the face group: two closed eyes and a smile', () => {
    const face = sun.match(/<g class="face"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? '';
    const ds = [...face.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
    expect(ds).toEqual(['M37 47q5.5 5 11 0', 'M52 47q5.5 5 11 0', 'M43 57q7 5.5 14 0']);
    expect(sun).toMatch(/<g class="face"[^>]*stroke-width="2.8"/);
    expect(sun).toMatch(/<g class="face"[^>]*stroke-linecap="round"/);
  });

  it('uses the brand fills for the halo and the disc', () => {
    expect(sun).toMatch(/<path class="halo" d="[^"]+" fill="#FCD873"/);
    expect(sun).toMatch(/<path class="disc" d="[^"]+" fill="#F6B92B"/);
  });

  it.each(['halo', 'disc'])('the %s is mirror-symmetric about x=50 (never tilted)', (cls) => {
    const pts = points(pathD(sun, cls));
    expect(pts.length).toBeGreaterThan(10);
    const xs = pts.map(([x]) => x);
    expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 50)).toBeLessThan(1);
    // Every point has a mirror twin on the other side.
    for (const [x, y] of pts) {
      const twin = pts.some(([x2, y2]) => Math.abs(x2 - (100 - x)) < 1 && Math.abs(y2 - y) < 1);
      expect(twin, `${x},${y}`).toBe(true);
    }
  });
});

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (file: string) => {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe('icon files', () => {
  it.each([
    ['public/apple-touch-icon.png', 180],
    ['public/icons/icon-192.png', 192],
    ['public/icons/icon-512.png', 512],
    ['public/icons/icon-maskable-512.png', 512],
  ])('%s is %ipx square', (file, size) => {
    expect(pngSize(file)).toEqual([size, size]);
  });

  it('favicon.ico holds one 32x32 image', () => {
    const b = readFileSync('public/favicon.ico');
    expect([b.readUInt16LE(0), b.readUInt16LE(2), b.readUInt16LE(4)]).toEqual([0, 1, 1]);
    expect([b[6], b[7]]).toEqual([32, 32]);
  });

  it('favicon.svg is the sun and follows the OS colour scheme', () => {
    const fav = readFileSync('public/favicon.svg', 'utf8');
    expect(fav).toContain(pathD(sun, 'halo'));
    expect(fav).toMatch(/@media \(prefers-color-scheme: dark\)/);
    expect(fav).toContain('#1F2E4A');
  });

  it('favicon.svg has a thicker face for tab size; the source keeps 2.8', () => {
    const width = (svg: string) => Number(svg.match(/<g class="face"[^>]*stroke-width="([\d.]+)"/)?.[1]);
    const fav = readFileSync('public/favicon.svg', 'utf8');
    expect(width(fav)).toBeGreaterThanOrEqual(4);
    expect(width(sun)).toBe(2.8);
    // Same face paths, only the stroke differs.
    expect(fav).toContain('<path d="M37 47q5.5 5 11 0"/>');
    expect(fav).toContain('<path d="M43 57q7 5.5 14 0"/>');
  });
});
