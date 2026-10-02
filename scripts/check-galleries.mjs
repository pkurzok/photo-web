// Validates src/content/galleries: every file a gallery.json references exists, every
// image in a gallery folder is referenced, and no alt text is still the importer's
// "TODO" placeholder.
//
//   node scripts/check-galleries.mjs               fail on missing/orphaned files and TODO alts
//   node scripts/check-galleries.mjs --allow-todo  only report TODO alts (fresh import)
//   node scripts/check-galleries.mjs --imported    also assert the Adobe import's image counts
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('src/content/galleries');
const strict = !process.argv.includes('--allow-todo');

// Image counts of the galleries as imported from Adobe Portfolio (migration check only —
// the galleries are free to change afterwards).
const expected = process.argv.includes('--imported')
  ? { headshots: 7, landscapes: 26, architecture: 16, events: 14 }
  : {};

const errors = [];
let todos = 0;

const names = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(root, e.name, 'gallery.json')))
  .map((e) => e.name);

for (const name of Object.keys(expected)) {
  if (!names.includes(name)) errors.push(`${name}: gallery.json missing`);
}

for (const name of names) {
  const gallery = JSON.parse(readFileSync(join(root, name, 'gallery.json'), 'utf8'));
  const entries = [{ src: gallery.cover, alt: gallery.coverAlt }, ...gallery.images];

  for (const { src, alt } of entries) {
    if (!existsSync(join(root, name, src))) errors.push(`${name}: ${src} does not exist`);
    if (!alt?.trim() || alt.trim() === 'TODO') {
      todos++;
      if (strict) errors.push(`${name}: ${src} has no alt text`);
    }
  }

  const referenced = new Set(entries.map((e) => e.src.replace(/^\.\//, '')));
  for (const file of readdirSync(join(root, name))) {
    if (/\.(jpe?g|png|webp|avif)$/i.test(file) && !referenced.has(file)) {
      errors.push(`${name}: ${file} is not referenced in gallery.json`);
    }
  }

  const want = expected[name];
  if (want !== undefined && gallery.images.length !== want) {
    errors.push(`${name}: ${gallery.images.length} images, expected ${want}`);
  }
  console.log(`${name}: ${gallery.images.length} images + cover`);
}

console.log(`${todos} alt text(s) still TODO`);

if (errors.length > 0) {
  console.error(`✗ ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(`✓ ${names.length} galleries OK`);
