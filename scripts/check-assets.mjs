// Verifies that every local asset referenced from the built HTML exists in dist/.
// Astro does not warn about dangling references into public/, so we check here.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dist = resolve('dist');

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

const missing = [];
let checked = 0;

for (const file of htmlFiles(dist)) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = m[1];
    // only local file references — skip external URLs, anchors, mailto:, and routes
    if (!ref.startsWith('/') || ref.startsWith('//')) continue;
    if (!/\.[a-z0-9]{2,5}$/i.test(ref)) continue;
    if (ref.endsWith('.html')) continue;
    const target = join(dist, decodeURIComponent(ref.split(/[?#]/)[0]));
    checked++;
    try {
      statSync(target);
    } catch {
      missing.push(`${ref}  (referenced by ${file.slice(dist.length + 1)})`);
    }
  }
}

if (missing.length > 0) {
  console.error(`✗ ${missing.length} missing asset(s):`);
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

console.log(`✓ all ${checked} local asset references resolve in dist/`);
