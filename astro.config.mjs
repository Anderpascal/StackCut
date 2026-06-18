import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SITE = 'https://stackcut.app';

// ── Sitemap lastmod map ──────────────────────────────────────────────────────
// Read real content dates at build so each <url> carries an accurate <lastmod>
// (Google uses it to prioritise recrawls). Products use `lastVerified`; blog
// posts use `updatedDate` (falling back to `pubDate`). Everything else gets the
// most recent verification date as a sensible site-freshness floor.
const productDates = {};
let newestProduct = '2026-01-01';
try {
  const saasDir = path.resolve('src/content/saas');
  for (const file of readdirSync(saasDir)) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(readFileSync(path.join(saasDir, file), 'utf8'));
    if (data.slug && data.lastVerified) {
      productDates[data.slug] = data.lastVerified;
      if (data.lastVerified > newestProduct) newestProduct = data.lastVerified;
    }
  }
} catch {}

const blogDates = {};
try {
  const blogDir = path.resolve('src/content/blog');
  for (const file of readdirSync(blogDir)) {
    if (!/\.mdx?$/.test(file)) continue;
    const raw = readFileSync(path.join(blogDir, file), 'utf8');
    const id = file.replace(/\.mdx?$/, '');
    const pub = raw.match(/^pubDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m);
    const upd = raw.match(/^updatedDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m);
    const d = (upd && upd[1]) || (pub && pub[1]);
    if (d) blogDates[id] = d;
  }
} catch {}

function lastmodFor(url) {
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return newestProduct;
  }
  let m;
  if ((m = pathname.match(/^\/blog\/([^/]+)\/?$/)) && blogDates[m[1]]) return blogDates[m[1]];
  if ((m = pathname.match(/^\/pricing\/([^/]+)\/?$/)) && productDates[m[1]]) return productDates[m[1]];
  if ((m = pathname.match(/^\/alternatives\/(.+?)-cheap\/?$/)) && productDates[m[1]]) return productDates[m[1]];
  return newestProduct;
}

export default defineConfig({
  site: SITE,
  output: 'static',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      cssMinify: 'lightningcss',
    },
  },
  integrations: [
    react(),
    sitemap({
      serialize(item) {
        const d = lastmodFor(item.url);
        item.lastmod = new Date(`${d}T00:00:00Z`).toISOString();
        item.changefreq = 'weekly';
        return item;
      },
    }),
    mdx(),
  ],
});
