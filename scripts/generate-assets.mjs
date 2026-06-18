// generate-assets.mjs — Rasterize brand SVGs into the real PNG assets that
// social crawlers and mobile OSes require (they do NOT render SVG OG images or
// SVG-only icon sets). Run with: node scripts/generate-assets.mjs
// Source of truth stays the SVGs in /public; this just produces raster output.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const pub = path.resolve('public');

// 1200×630 Open Graph card (replaces the mislabeled SVG-as-.jpg).
const ogSvg = readFileSync(path.join(pub, 'og-default.svg'));
await sharp(ogSvg, { density: 200 })
  .resize(1200, 630, { fit: 'cover' })
  .png({ quality: 90 })
  .toFile(path.join(pub, 'og-default.png'));

// Icon set from the favicon mark. Flatten the rounded-corner transparency onto
// the paper background so Apple/Android masks render cleanly.
const favSvg = readFileSync(path.join(pub, 'favicon.svg'));
const icons = [
  [180, 'apple-touch-icon.png'],
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
  [32, 'favicon-32x32.png'],
  [16, 'favicon-16x16.png'],
];
for (const [size, name] of icons) {
  await sharp(favSvg, { density: 384 })
    .resize(size, size)
    .flatten({ background: '#f0f3ea' })
    .png()
    .toFile(path.join(pub, name));
}

console.log('Generated: og-default.png + ' + icons.map((i) => i[1]).join(', '));
