#!/usr/bin/env node
/**
 * Brand files generator (one-off; kept so the files can be rebuilt).
 *
 *   node scripts/brand-icons.mjs             writes the icon files from src/assets/brand/sun.svg
 *   node scripts/brand-icons.mjs --wordmark  traces the owner's logo and prints the wordmark SVG
 *
 * Icon files: public/favicon.svg (face colour follows the OS), public/favicon.ico (32×32),
 * public/apple-touch-icon.png (180, cream), public/icons/icon-192.png, icon-512.png,
 * icon-maskable-512.png. When the owner's Logo folder exists, it also writes the two 1080×1080
 * Instagram profile pictures there, but never replaces a file that is already there.
 *
 * The wordmark output is pasted into src/components/brand/Wordmark.astro; the source image
 * stays in the owner's folder and is not copied into the repo.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const LOGO_DIR = 'C:/Users/ogune/Desktop/Klinik Terapist/Logo';
const SUN = 'src/assets/brand/sun.svg';

const CREAM = '#FBF3E4';
const NAVY = '#1F2E4A';
const FACE_DAY = '#2A2420';
const FACE_NIGHT = '#1F2E4A';

const sunSvg = readFileSync(SUN, 'utf8');

/** The sun with the given face colour. */
const sunWithFace = (color) => sunSvg.replace(/(<g class="face"[^>]*stroke=")[^"]+"/, `$1${color}"`);

/** The sun as a PNG buffer, `size` px square, rendered large and scaled down for clean edges. */
const renderSun = (size, face) =>
  sharp(Buffer.from(sunWithFace(face)), { density: Math.max(72, (72 * size * 4) / 100) })
    .resize(size, size)
    .png()
    .toBuffer();

/**
 * A square PNG: the sun at `scale` of the canvas, centred on `background`
 * (transparent when omitted).
 */
async function icon(size, { scale = 1, background, face = FACE_DAY } = {}) {
  const inner = Math.round(size * scale);
  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: await renderSun(inner, face), left: offset, top: offset }])
    .png()
    .toBuffer();
}

/** An ICO file that wraps one PNG image (supported by every current browser). */
function ico(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt8(0, 8); // no palette
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // image data offset
  return Buffer.concat([header, png]);
}

/** favicon.svg: the sun with the face colour switched by the OS colour scheme. */
function faviconSvg() {
  const style =
    `<style>.face{stroke:${FACE_DAY}}` +
    `@media (prefers-color-scheme: dark){.face{stroke:${FACE_NIGHT}}}</style>`;
  return sunWithFace(FACE_DAY)
    .replace(/\s*<!--[\s\S]*?-->/, '')
    .replace(/(<g class="face"[^>]*?) stroke="[^"]+"/, '$1')
    .replace(/(<svg[^>]*>)/, `$1\n  ${style}`);
}

async function writeIcons() {
  mkdirSync('public/icons', { recursive: true });
  writeFileSync('public/favicon.svg', faviconSvg());
  writeFileSync('public/favicon.ico', ico(await icon(32), 32));
  writeFileSync('public/apple-touch-icon.png', await icon(180, { scale: 0.8, background: CREAM }));
  writeFileSync('public/icons/icon-192.png', await icon(192));
  writeFileSync('public/icons/icon-512.png', await icon(512));
  // Maskable: full-bleed cream, the halo stays inside the central 80% safe circle.
  writeFileSync('public/icons/icon-maskable-512.png', await icon(512, { scale: 0.8, background: CREAM }));
  console.log('public/: favicon.svg, favicon.ico, apple-touch-icon.png, icons/icon-{192,512,maskable-512}.png');

  if (!existsSync(LOGO_DIR)) return;
  const instagram = [
    ['gunes-instagram-krem.png', CREAM, FACE_DAY],
    ['gunes-instagram-lacivert.png', NAVY, FACE_NIGHT],
  ];
  for (const [name, background, face] of instagram) {
    const file = join(LOGO_DIR, name);
    if (existsSync(file)) {
      console.log(`skipped (already exists): ${file}`);
      continue;
    }
    // Instagram crops the picture to a circle; 0.7 keeps the halo well inside it.
    writeFileSync(file, await icon(1080, { scale: 0.7, background, face }));
    console.log(`wrote ${file}`);
  }
}

/** Traces the black logo and prints `<svg viewBox=…><path d=…/></svg>` with fill="currentColor". */
async function traceWordmark() {
  const { default: potrace } = await import('potrace');
  const UPSCALE = 3; // trace a larger bitmap for smoother curves
  const { data, info } = await sharp(join(LOGO_DIR, 'klinikterapist-siyah.webp'))
    .flatten({ background: '#ffffff' })
    .grayscale()
    .trim()
    .toBuffer({ resolveWithObject: true });
  const big = await sharp(data)
    .resize(info.width * UPSCALE, info.height * UPSCALE, { kernel: 'lanczos3' })
    .blur(1.5) // smooth the source's pixel steps before thresholding
    .png()
    .toBuffer();
  const svg = await new Promise((resolve, reject) =>
    potrace.trace(big, { threshold: 120, turdSize: 8, optTolerance: 1 }, (err, out) => (err ? reject(err) : resolve(out))),
  );
  const d = svg.match(/ d="([^"]+)"/)[1];
  // Back to the source pixel grid, one decimal.
  const scaled = d.replace(/-?\d+(?:\.\d+)?/g, (n) => String(Math.round((Number(n) / UPSCALE) * 10) / 10));
  console.log(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${info.width} ${info.height}" fill="currentColor">` +
      `<path d="${scaled.replace(/\s+/g, ' ').trim()}" fill-rule="evenodd"/></svg>`,
  );
}

if (process.argv.includes('--wordmark')) await traceWordmark();
else await writeIcons();
