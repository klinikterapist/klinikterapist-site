// One-off generator for the sample post covers ("Gün & Gece": abstract gradients with a soft sun disc).
// Run: node scripts/sample-covers.mjs   (writes cover.webp next to each sample post)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const W = 1600, H = 900;
const CREAM = '#FBF3E4', SAND = '#F4E9D4', HALO = '#FCD873', HONEY = '#F6B92B', NAVY = '#1F2E4A', NAVY2 = '#2F4570';

// Each cover: sky gradient (top, bottom), sun position/size/colour, soft dune shapes in front.
const COVERS = {
  'ornek-kaygi-ile-yasamak': { top: CREAM, bottom: HALO, sun: [1120, 430, 190], disc: HONEY, halo: HALO, dunes: [SAND, '#EBDDC0'] },
  'ornek-ilk-gorusme': { top: SAND, bottom: '#F9D98C', sun: [520, 470, 170], disc: HONEY, halo: CREAM, dunes: [NAVY2, NAVY] },
  'ornek-uyku-ve-duygular': { top: NAVY, bottom: NAVY2, sun: [1050, 340, 150], disc: CREAM, halo: '#B9C4D6', dunes: ['#26385A', '#1A263E'] },
};

function svg(c) {
  const [sx, sy, r] = c.sun;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.top}"/><stop offset="1" stop-color="${c.bottom}"/></linearGradient>
    <radialGradient id="halo" cx="${sx}" cy="${sy}" r="${r * 3.2}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${c.halo}" stop-opacity="0.85"/><stop offset="1" stop-color="${c.halo}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"/>
  <circle cx="${sx}" cy="${sy}" r="${r * 1.45}" fill="${c.halo}" opacity="0.35"/>
  <circle cx="${sx}" cy="${sy}" r="${r}" fill="${c.disc}"/>
  <path d="M0 640 C 300 560 560 700 900 640 S 1400 560 1600 620 V900 H0 Z" fill="${c.dunes[0]}" opacity="0.92"/>
  <path d="M0 740 C 380 690 640 800 1000 744 S 1420 700 1600 750 V900 H0 Z" fill="${c.dunes[1]}"/>
</svg>`;
}

for (const [key, c] of Object.entries(COVERS)) {
  const dir = `src/content/posts/${key}`;
  mkdirSync(dir, { recursive: true });
  await sharp(Buffer.from(svg(c))).webp({ quality: 82 }).toFile(`${dir}/cover.webp`);
  console.log('wrote', `${dir}/cover.webp`);
}
