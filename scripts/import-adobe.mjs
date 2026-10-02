// One-off importer: pulls every image of the Adobe Portfolio site at peterkurzok.de
// into the repo, at the largest rendition the Adobe CDN serves.
//
// Re-runnable: files that already exist are skipped, and an existing gallery.json is
// never overwritten (it holds the hand-written alt texts).
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const ORIGIN = 'https://peterkurzok.de';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const CDN = String.raw`https://cdn\.myportfolio\.com/[^"\s,]+?`;

const GALLERY_DIR = 'src/content/galleries';
const MANIFEST = `${GALLERY_DIR}/import-manifest.json`;

const exists = (p) => stat(p).then(() => true, () => false);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const pad = (n) => String(n).padStart(2, '0');

async function fetchPage(path) {
  const res = await fetch(`${ORIGIN}/${path}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET /${path} → ${res.status}`);
  return res.text();
}

/** Largest `…_rw_<N>.<ext>?h=…` candidate per `grid__item-image`, in document order. */
function galleryImages(html) {
  const tags = html.match(/<img\s[^>]*?class="grid__item-image[^>]*>/g) ?? [];
  return tags.map((tag) => {
    const candidates = [...tag.matchAll(new RegExp(`(${CDN}_rw_(\\d+)\\.\\w+\\?h=[0-9a-f]+)`, 'g'))];
    if (candidates.length === 0) throw new Error(`no _rw_ rendition in: ${tag.slice(0, 200)}`);
    const best = candidates.reduce((a, b) => (Number(b[2]) > Number(a[2]) ? b : a));
    return { url: best[1], width: Number(best[2]) };
  });
}

/** Home order, title and largest `_rwc_…x<N>` cover per gallery. */
function projectCovers(html) {
  const blocks = html.split(/<a class="project-cover\b/).slice(1);
  return blocks.map((block, i) => {
    const name = block.match(/href="\/([\w-]+)"/)[1];
    const title = block.match(/<div class="title[^>]*>([^<]+)</)[1].trim();
    const srcset = block.match(/data-srcset="([^"]+)"/)[1];
    const candidates = [...srcset.matchAll(new RegExp(`(${CDN}_rwc_[\\dx]+x(\\d+)\\.\\w+\\?h=[0-9a-f]+)`, 'g'))];
    const best = candidates.reduce((a, b) => (Number(b[2]) > Number(a[2]) ? b : a));
    return { name, title, order: i + 1, url: best[1], width: Number(best[2]) };
  });
}

const manifest = (await exists(MANIFEST)) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};
const counts = { downloaded: 0, skipped: 0 };

// `rendition` is the width in the CDN file name. Adobe never upscales, so the stored
// file is often smaller — `width`/`height` record what actually landed on disk.
async function download(url, target, key, rendition) {
  if (await exists(target)) {
    counts.skipped++;
    if (manifest[key] && !manifest[key].width) {
      const { width, height } = await sharp(target).metadata();
      Object.assign(manifest[key], { width, height });
    }
    console.log(`${key}  (exists, skipped)`);
    return;
  }
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: `${ORIGIN}/` } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  const { width, height } = await sharp(bytes).metadata();
  manifest[key] = { source: url, rendition, width, height, bytes: bytes.length };
  counts.downloaded++;
  const name = url.match(/_(?:rwc?|carw)_[\dx]+\.\w+/)?.[0] ?? url.split('/').pop().split('?')[0];
  console.log(`${key}  ← …${name}  (${mb(bytes.length)})`);
}

// --- galleries -------------------------------------------------------------------

const home = await fetchPage('');
const covers = projectCovers(home);
if (covers.length === 0) throw new Error('no project covers found on the home page');

for (const cover of covers) {
  const dir = `${GALLERY_DIR}/${cover.name}`;
  const images = galleryImages(await fetchPage(cover.name));

  await download(cover.url, `${dir}/cover.jpg`, `${cover.name}/cover.jpg`, cover.width);
  for (const [i, img] of images.entries()) {
    const file = `${pad(i + 1)}.jpg`;
    await download(img.url, `${dir}/${file}`, `${cover.name}/${file}`, img.width);
  }

  const json = `${dir}/gallery.json`;
  if (!(await exists(json))) {
    const gallery = {
      title: cover.title,
      order: cover.order,
      cover: './cover.jpg',
      coverAlt: 'TODO',
      images: images.map((_, i) => ({ src: `./${pad(i + 1)}.jpg`, alt: 'TODO' })),
    };
    await writeFile(json, JSON.stringify(gallery, null, 2) + '\n');
  }
}

// --- about portrait (un-suffixed original) ---------------------------------------

const about = await fetchPage('about');
const portrait = about.match(new RegExp(`class="js-lightbox" data-src="(${CDN}\\?h=[0-9a-f]+)"`));
if (!portrait) throw new Error('portrait not found on /about');
await download(portrait[1], 'src/assets/portrait.jpg', 'portrait.jpg', null);

// --- home masthead (background image, only referenced from the site stylesheet) ---

const stylesheet = home.match(new RegExp(`<link[^>]+href="(${CDN}\\.css\\?h=[0-9a-f]+)"`));
if (!stylesheet) throw new Error('site stylesheet not found on the home page');
const css = await (await fetch(stylesheet[1], { headers: { 'User-Agent': UA } })).text();
const masthead = css.match(new RegExp(`\\.masthead\\s*\\{[^}]*background-image:\\s*url\\("(${CDN}_rwc_[\\dx]+x(\\d+)\\.\\w+\\?h=[0-9a-f]+)"\\)`));
if (!masthead) throw new Error('masthead background not found in the site stylesheet');
await download(masthead[1], 'src/assets/masthead.jpg', 'masthead.jpg', Number(masthead[2]));

// --- favicons --------------------------------------------------------------------

for (const [rel, file] of [['icon', 'favicon.png'], ['apple-touch-icon', 'apple-touch-icon.png']]) {
  const link = about.match(new RegExp(`<link rel="${rel}" href="([^"]+)"`));
  if (!link) throw new Error(`<link rel="${rel}"> not found`);
  await download(link[1], `public/${file}`, file, Number(link[1].match(/x(\d+)\.png/)?.[1]) || null);
}

// --- og-image: 1200×630 centre crop of the landscapes cover ----------------------

const og = 'public/og-image.jpg';
if (await exists(og)) {
  console.log('og-image.jpg  (exists, skipped)');
} else {
  await sharp(resolve(`${GALLERY_DIR}/landscapes/cover.jpg`))
    .resize(1200, 630, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(og);
  console.log('og-image.jpg  ← landscapes/cover.jpg  (1200×630)');
}

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');

console.log(`\n✓ ${counts.downloaded} downloaded, ${counts.skipped} skipped — manifest: ${MANIFEST}`);
