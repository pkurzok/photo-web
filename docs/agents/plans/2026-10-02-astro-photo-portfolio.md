---
date: 2026-10-02T09:22:56Z
git_commit: ""
branch: ""
topic: "Rebuild peterkurzok.de photography portfolio with Astro on Cloudflare Pages"
tags: [plan, astro, cloudflare-pages, galleries, photoswipe, dns]
status: in-progress
---

# PLAN: Rebuild peterkurzok.de with Astro

Replace the Adobe Portfolio site at https://peterkurzok.de with a self-hosted static
site. Same content and URLs, modernised "gallery-first" design, light/dark mode, a
real lightbox, proper alt texts, current legal pages, and a subtle pointer to
apps.peterkurzok.de. Hosted on Cloudflare Pages like the other `*.peterkurzok.de`
sites; the DNS zone moves from INWX to Cloudflare because Pages only serves an apex
domain from a zone in the same account.

## Acceptance Criteria

- All current URLs keep working: `/`, `/headshots`, `/landscapes`, `/architecture`,
  `/events`, `/about`, `/imprint`. `/work` redirects (301) to `/`. `/privacy` is new.
- All 63 gallery images, the 4 gallery covers (67 files under `src/content/galleries`),
  the About portrait and the favicons are in the repo at the highest resolution the Adobe CDN serves, under a fixed naming
  convention (`01.jpg`, `02.jpg`, …) so any file can later be replaced by a better export.
- Every image has a descriptive alt text. Order, cover and alt texts live in one
  `gallery.json` per gallery; the build fails on a missing or placeholder alt text.
- Astro generates responsive WebP `srcset`s from the originals at build time. The built
  site references no `cdn.myportfolio.com` URL, loads no third-party font or script, and
  sets no cookies.
- Galleries render as a justified grid (rows of equal height, CSS only). Clicking opens
  PhotoSwipe with swipe, pinch-zoom, keyboard navigation. Without JavaScript the image
  is a plain link to its largest rendition.
- Light and dark theme follow `prefers-color-scheme`.
- The software pointer is one sentence on `/about` linking to apps.peterkurzok.de plus a
  footer link "Apps". The header navigation stays "Work · About".
- Imprint cites § 5 DDG and § 18 Abs. 2 MStV; privacy page describes the static,
  tracking-free setup. Footer mail stays `photo@peterkurzok.de`, imprint mail stays
  `imprint@peterkurzok.de`.
- Live at https://peterkurzok.de on Cloudflare Pages; `www.peterkurzok.de` redirects to
  the apex via a zone Redirect Rule (Pages `_redirects` cannot redirect across hosts). iCloud mail (MX, SPF, DKIM) and the three existing Pages subdomains keep
  working after the DNS move.

## Technical Key Decisions and Tradeoffs

1. **Astro 7 + Cloudflare Pages, mirroring `app-site`:** same scaffold, same deploy flow
   (push to `main` builds `npm run build`, output `dist`).
   - Why: known stack; `astro:assets` handles the image pipeline; content collections
     model galleries as folders.
   - Impact: new GitHub repo `pkurzok/photo-web`, Pages project `photo-web`,
     `NODE_VERSION=22` in the Pages build settings.
2. **Images imported from the Adobe CDN by script, highest available rendition:**
   `_rw_3840` / `_rw_1920` / `_rw_1200` depending on what Adobe stored.
   - Why: faithful rebuild without an export session first.
   - Impact: `scripts/import-adobe.mjs` parses the live Portfolio HTML and downloads
     into `src/content/galleries/<name>/NN.jpg`. Must run while the Adobe site is still
     up (Phase 1). Two originals are ~8 MB, well under the 25 MiB Pages file limit.
     Repo grows by ~100–150 MB of JPEGs; no Git LFS.
3. **Design B, gallery-first:** home shows the four galleries as large covers with a
   title overlay, galleries use a tight justified grid, slim sticky header, muted text.
   System font stack as in `app-site` (no replacement for the obfuscated Typekit font).
   - Why: visibly modern without new content.
   - Impact: CSS custom properties as design tokens in `Base.astro`, dark mode via
     `prefers-color-scheme`, `--gutter` small on gallery pages.
4. **Justified grid in pure CSS** (flex-grow proportional to aspect ratio, filler
   pseudo-element for the last row).
   - Why: no layout JS, no layout shift; Astro knows every image's width/height.
   - Impact: each tile gets `style="--ar: <w/h>"`; row height is a CSS variable.
5. **PhotoSwipe 5 bundled locally, loaded only on gallery pages.**
   - Why: swipe and pinch-zoom on phones, keyboard on desktop; progressive enhancement.
   - Impact: only JS dependency; privacy page statement "nothing loaded from third
     parties" stays true.
6. **WebP only, widths capped at the original (480, 960, 1440 thumbs; 1440, 1920, 2560
   lightbox), quality 82.** No AVIF. `<Image>` rather than `<Picture>` so no JPEG fallback
   is emitted.
   - Why: AVIF encoding of ~70 large photos risks the 20-minute Pages build timeout for a
     marginal size gain. Astro drops requested widths larger than the source and appends
     the source width, so the 16 images stored at ≤ 1200 px simply get fewer renditions.
   - Impact: `getImage()` calls in the gallery page with explicit `widths`, `format`, and
     `width: Math.min(2560, src.width)` on the lightbox call so `src`, `data-pswp-width`
     and the largest srcset candidate agree (without `width`, Astro would emit a sixth,
     full-size rendition).
7. **Alt texts written during implementation** (one per image, short, factual), stored
   in `gallery.json`; Zod schema rejects empty or `TODO` alt texts.
8. **Software pointer:** sentence on `/about` + footer link "Apps". Nothing in the header.
9. **DNS zone moves to Cloudflare, registration stays at INWX.**
   - Why: Pages requires an apex custom domain to be a zone in the account; an INWX
     ALIAS record would not be accepted.
   - Impact: dedicated go-live phase with record export, import, verification, then the
     apex as Pages custom domain and a zone Redirect Rule ("Redirect from WWW to Root"
     template) with a proxied placeholder `A www 192.0.2.1` record, per Cloudflare's
     www-redirect guide. `_redirects` only handles `/work → /`. DNSSEC is currently off (no DS
     record), so no DS dance is needed. The Adobe site keeps serving until the switch.
10. **Legal texts copied from `app-site`** (`imprint.astro`, `privacy.astro`) and
    adapted to this domain and its external links.

## Current State

```
peterkurzok.de  (Adobe Portfolio, light theme, max-width 1600px, Typekit font "vcsm",
                 lazy-loading + lightbox via Adobe JS, images on cdn.myportfolio.com)
│
├── Header:  "Peter Kurzok Photography"                     WORK   ABOUT
│
├── /  (= /work)   4 project covers, 2 columns, title below each cover
│                  order: Headshots, Landscapes, Architecture, Events
│                  covers are separate cropped uploads (1280 / 3840 / 882 / 1280 px wide)
│
├── /headshots      7 images  ┐ justified grid (flex-grow per aspect ratio)
├── /landscapes    26 images  │ click → lightbox with arrows
├── /architecture  16 images  │ no captions, no alt texts
├── /events        14 images  ┘ max rendition: 2× 3840, 43× 1920, 15× 1200, 1× 600 px
│
├── /about          portrait (3:4, full width, original JPEG URL exposed)
│                   "Peter Kurzok"
│                   "Software Engineer. Photographer. Musician. Dad."
│                   [Contact] → mailto:photo@peterkurzok.de
│
├── /imprint        § 5 TMG / § 55 RStV (outdated), c/o MDC#990, Dietmannsried
│
└── Footer:  ©2026 Peter Kurzok · Imprint
             icons: Instagram · Flickr · 500px · LinkedIn · GitHub · Mail
```

DNS (authoritative at INWX, DNSSEC off):

| Record | Value |
| --- | --- |
| `A peterkurzok.de`, `A www` | 151.101.128.119, 151.101.192.119 (Adobe / Fastly) |
| `CNAME apps` | app-site-2b3.pages.dev |
| `CNAME blog` | blog-52g.pages.dev |
| `CNAME playtales` | playtales-web.pages.dev |
| `MX` | mx01.mail.icloud.com, mx02.mail.icloud.com (prio 10) |
| `TXT` | `v=spf1 include:icloud.com ~all`, `apple-domain=…`, `google-site-verification=…` |
| `CNAME sig1._domainkey` | sig1.dkim.peterkurzok.de.at.icloudmailadmin.com |

Reference implementation: `/Users/peter.kurzok/ws-privat/app-site` (Astro 7.2.1,
`src/layouts/Base.astro` design tokens, `src/components/Icon.astro`,
`scripts/check-assets.mjs`, `src/pages/imprint.astro`, `src/pages/privacy.astro`).

## Desired End State

```
photo-web/  →  https://peterkurzok.de  (Cloudflare Pages, zone on Cloudflare)
│
├── Header (sticky, slim):  Peter Kurzok                          Work   About
│
├── /              2-column cover grid, title overlay, hover darkens slightly
│   ┌──────────────────────────────┐┌──────────────────────────────┐
│   │                              ││                              │
│   │  HEADSHOTS                   ││  LANDSCAPES                  │
│   └──────────────────────────────┘└──────────────────────────────┘
│   ┌──────────────────────────────┐┌──────────────────────────────┐
│   │  ARCHITECTURE                ││  EVENTS                      │
│   └──────────────────────────────┘└──────────────────────────────┘
│   (1 column below 640px)
│
├── /<gallery>     h1 + justified grid, 4px gaps, PhotoSwipe on click
│   ┌────────┐┌─────────────┐┌────────┐┌─────────────┐
│   └────────┘└─────────────┘└────────┘└─────────────┘
│   ┌─────────────┐┌────────┐┌─────────────┐
│   └─────────────┘└────────┘└─────────────┘
│
├── /about         portrait · name · tagline ·
│                  "By day I build apps. You can find them at apps.peterkurzok.de."
│                  [Contact]
├── /imprint, /privacy, /404
│
└── Footer:  © 2026 Peter Kurzok · Imprint · Privacy · Apps     ◎ ◎ ◎ ◎ ◎ ◎
```

## Abstractions and Code Reuse

Reused from `app-site` (copy, then adapt): `Base.astro` head/meta/token structure,
`Icon.astro` (add `flickr`, `500px`, `mail` glyphs), `Footer.astro` structure,
`scripts/check-assets.mjs` verbatim, `imprint.astro` and `privacy.astro` texts,
`.gitignore`, `AGENTS.md` dev-server note.

- `package.json` — `astro ^7.2`, `@astrojs/sitemap ^3.7`, `photoswipe ^5.4`, `sharp`;
  scripts `dev`, `build`, `preview`, `check`, `check:galleries`, `import`
- `astro.config.mjs` — `site: 'https://peterkurzok.de'`, `integrations: [sitemap()]`
- `scripts/`
  - `import-adobe.mjs` — one-off importer (Phase 1)
  - `check-assets.mjs` — copied from app-site
  - `check-galleries.mjs` — validates image counts, file existence, no placeholder alts
  - `dns-snapshot.sh` — `dig` loop producing a normalised zone snapshot (Phase 5)
- `public/`
  - `favicon.png`, `apple-touch-icon.png` — imported from Adobe
  - `og-image.jpg` — 1200×630 crop of the landscapes cover, produced by the import script
  - `robots.txt`, `_redirects`
- `src/content.config.ts` — `galleries` collection, `glob` loader on `*/gallery.json`,
  `generateId` returns the folder name, schema below
- `src/content/galleries/<name>/` — `gallery.json`, `cover.jpg`, `01.jpg` …
- `src/data/site.json` — name, tagline, description, email, social channels, apps URL
- `src/assets/portrait.jpg` — About portrait
- `src/layouts/Base.astro` — head, tokens, `<Header/>`, `<slot/>`, `<Footer/>`
- `src/components/`
  - `Header.astro` — logo text + nav, `aria-current` on the active route
  - `Footer.astro` — copyright, legal links + "Apps", social icon list
  - `Icon.astro` — inline SVG glyphs
  - `GalleryCover.astro` — one home tile (`<Image format="webp">`, overlay title)
  - `JustifiedGrid.astro` — `<div id="gallery" class="grid">`, takes prepared tiles
  - `Lightbox.astro` — PhotoSwipe init `<script>` + style import
- `src/pages/`
  - `index.astro`, `[gallery].astro`, `about.astro`, `imprint.astro`, `privacy.astro`,
    `404.astro`

`gallery.json` shape and schema:

```json
{
  "title": "Landscapes",
  "order": 2,
  "cover": "./cover.jpg",
  "coverAlt": "Mountain ridge above a sea of fog at sunrise",
  "images": [
    { "src": "./01.jpg", "alt": "Rocky coastline at low tide, long exposure, black and white" }
  ]
}
```

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const alt = z.string().trim().min(1).refine((s) => s !== 'TODO', 'alt text still TODO');

export const collections = {
  galleries: defineCollection({
    loader: glob({
      pattern: '*/gallery.json',
      base: './src/content/galleries',
      generateId: ({ entry }) => entry.split('/')[0],
    }),
    schema: ({ image }) =>
      z.object({
        title: z.string(),
        order: z.number().int(),
        cover: image(),
        coverAlt: alt,
        images: z.array(z.object({ src: image(), alt })).min(1),
      }),
  }),
};
```

Justified grid (CSS only):

```css
#gallery.grid { display: flex; flex-wrap: wrap; gap: 4px; }
.grid a {
  flex: calc(var(--ar) * 100) 1 calc(var(--ar) * var(--row-h, 16rem));
  aspect-ratio: var(--ar);
}
.grid img { width: 100%; height: 100%; object-fit: cover; display: block; }
.grid::after { content: ''; flex-grow: 1e5; }   /* keeps a short last row left-aligned */
```

PhotoSwipe anchors (per image, from `getImage()`):

```html
<a href={large.src} data-pswp-width={large.attributes.width}
   data-pswp-height={large.attributes.height} data-pswp-srcset={large.srcSet.attribute}
   style={`--ar: ${w / h}`}>
  <img src={thumb.src} srcset={thumb.srcSet.attribute} sizes="…" alt={alt}
       width={w} height={h} loading="lazy" decoding="async" />
</a>
```

## Logging & Observability

Build-time only. The import script prints one line per download:

```
headshots/01.jpg  ← …_rw_3840.jpg  (8.3 MB)
```

and writes `src/content/galleries/import-manifest.json` (67 gallery files + portrait) (source URL, rendition width,
bytes per file) so a later re-import or quality audit can see where each file came from.
`check-galleries.mjs` prints per-gallery counts and exits non-zero on any mismatch.
Cloudflare Pages keeps the build log per deployment.

## Implementation

### Phase 1: Project scaffold and image import

Dependencies: None

Create the Astro project, import every image from the live Adobe site into the content
folder structure, and get `npm run build` green with a placeholder index page.

**Tasks**:
- [x] `git init` in `photo-web`, copy `.gitignore` from `app-site`; `src/content/galleries/import-manifest.json` stays tracked.
- [x] `npm create astro@latest` equivalent by hand: `package.json` (engines `node >=22.12`), `astro.config.mjs` with `site` and the sitemap integration, `tsconfig.json` extending `astro/tsconfigs/strict`.
- [x] Install `astro`, `@astrojs/sitemap`, `photoswipe`, `sharp`.
- [x] Write `scripts/import-adobe.mjs`:
  - fetch `https://peterkurzok.de/{,headshots,landscapes,architecture,events,about}` with a browser User-Agent
  - gallery pages: for each `grid__item-image` pick the largest `…_rw_<N>.<ext>?h=…` URL from `data-srcset`/`data-src`, keep document order, download to `src/content/galleries/<name>/NN.jpg` (zero-padded, lowercase extension)
  - home page: for each `project-cover` anchor pick the largest `_rwc_…x<N>.jpg` from `data-srcset`, save as `<name>/cover.jpg`
  - about page: download the un-suffixed original `eff01046-….jpeg?h=…` to `src/assets/portrait.jpg`
  - favicons: `<link rel="icon">` → `public/favicon.png`, `<link rel="apple-touch-icon">` → `public/apple-touch-icon.png`
  - produce `public/og-image.jpg` (1200×630, centre crop of `landscapes/cover.jpg`) with sharp
  - write `<name>/gallery.json` with `title`, `order` (home order 1–4), `cover`, `coverAlt: "TODO"`, `images[].alt: "TODO"`
  - write `import-manifest.json`; skip files that already exist so the script is re-runnable
- [x] Run the import; spot-check three files with `sips -g pixelWidth`.
- [x] `src/content.config.ts` as specified above **without** the `!== 'TODO'` refinement (keep `min(1)`), so the build passes before alt texts exist; the refinement is added in Phase 3.
- [x] `scripts/check-galleries.mjs`: for each `gallery.json` assert every referenced file exists, counts match `{headshots: 7, landscapes: 26, architecture: 16, events: 14}`, and report the number of `TODO` alts (fail only when `--strict`).
- [x] Placeholder `src/pages/index.astro` listing the gallery titles via `getCollection('galleries')`.
- [x] `AGENTS.md` (dev-server note from app-site) with `CLAUDE.md -> AGENTS.md` symlink, and a first `README.md` describing the folder convention and the import script.

**Automated Verification**:
- [x] `node scripts/import-adobe.mjs` exits 0 and prints 67 gallery downloads (63 images + 4 covers) + portrait + 2 favicons + og-image.
- [x] `node scripts/check-galleries.mjs` exits 0 with counts 7/26/16/14.
- [x] `npm run build` exits 0.
- [x] `sips -g pixelWidth src/content/galleries/landscapes/01.jpg` reports 3840.

### Phase 2: Layout, design tokens and home page

Dependencies: Phase 1

The site looks like the target design on `/` and `/404`, in light and dark mode, with
header and footer complete.

**Tasks**:
- [x] `src/data/site.json`: `name`, `tagline`, `description` (current meta description), `email: photo@peterkurzok.de`, `appsUrl`, `channels` (instagram, flickr, 500px, linkedin, github, mail with `href`, `label`, `handle`).
- [x] `src/layouts/Base.astro`: copy head/meta from app-site, swap favicon links to the PNGs, `og:image` → `/og-image.jpg`, `theme-color` for both schemes. Tokens: `--bg`, `--text`, `--text-muted`, `--border`, `--content-width: 1600px`, `--gutter`, `--font` (system stack). Dark mode block. Global reset. `<Header/>`, `<main><slot/></main>`, `<Footer/>`.
- [x] `src/components/Header.astro`: sticky, translucent background (`backdrop-filter`), logo text "Peter Kurzok" (link to `/`), nav "Work" (`/`) and "About" (`/about`), `aria-current="page"` from `Astro.url.pathname` (Work is current on `/` and on gallery pages).
- [x] `src/components/Icon.astro`: port from app-site; add `flickr`, `500px`, `mail` glyphs; keep `instagram`, `linkedin`, `github`.
- [x] `src/components/Footer.astro`: "© {year} Peter Kurzok" · Imprint · Privacy · Apps (`appsUrl`, `rel="me"`), then the social icon list with `sr-only` labels.
- [x] `src/components/GalleryCover.astro`: `<a href={/${id}}>` with `<Image format="webp" widths={[640,1024,1600]} sizes="(max-width: 640px) 100vw, 50vw">` (single `<img>` with srcset, no JPEG fallback), overlay `<h2>` bottom-left uppercase, gradient scrim, hover brightness. The anchor's first attribute is `href` (the verification greps rely on it).
- [x] `src/pages/index.astro`: `getCollection('galleries')` sorted by `order`, 2-column grid, 1 column ≤ 640px, `fetchpriority="high"` on the first two covers.
- [x] `src/pages/404.astro` in the `.prose` style with a link home.
- [x] `public/robots.txt` allowing everything and pointing to `/sitemap-index.xml`.

**Automated Verification**:
- [x] `npm run build && npm run check` (check-assets; it inspects `src`/`href` attributes, not srcset candidates) exits 0.
- [x] `! grep -rq "cdn.myportfolio" dist`.
- [x] `grep -o '<a href="/headshots"' dist/index.html | wc -l` is 1, same for the other three galleries.
- [x] `test -f dist/sitemap-index.xml && test -f dist/404.html`.

**Manual Verification**:
- [x] `npm run dev`: `/` shows the four covers in home order with titles, in both colour schemes (toggle macOS appearance), at 375px and 1600px widths without horizontal scroll.
- [x] Footer "Apps" opens apps.peterkurzok.de; social icons open the right profiles.

### Phase 3: Gallery pages, lightbox and alt texts

Dependencies: Phase 2

All four galleries render as a justified grid with PhotoSwipe, and every image has a
real alt text.

**Tasks**:
- [x] `src/pages/[gallery].astro`: `getStaticPaths` from the collection; for each image call `getImage()` twice (thumb: `widths: [480, 960, 1440]`; large: `widths: [1440, 1920, 2560]` plus `width: Math.min(2560, src.width)`; both `format: 'webp'`, `quality: 82`); pass tiles (thumb, large, `w/h` from `src.width/src.height`, alt) to `JustifiedGrid`.
- [x] `src/components/JustifiedGrid.astro`: `<div id="gallery" class="grid">` with the anchor markup + CSS from the design section, `--row-h` 14rem on phones, 18rem ≥ 1024px, `sizes` attribute matching the row heights.
- [x] `src/components/Lightbox.astro`: `<script>` importing `photoswipe/lightbox` and `photoswipe/style.css`, `new PhotoSwipeLightbox({ gallery: '#gallery', children: 'a', pswpModule: () => import('photoswipe') }).init()`. Included only by `[gallery].astro`.
- [x] Gallery page `<h1>` with the title, `<title>` "Peter Kurzok – {title}", description "{title} photography by Peter Kurzok".
- [x] Write alt texts: open each of the 67 gallery files (`cover.jpg` + `NN.jpg`), replace every `TODO` in the four `gallery.json` files with a short factual description.
- [x] Tighten `content.config.ts`: add the `!== 'TODO'` refinement from the schema above; `check-galleries.mjs` defaults to strict.
- [x] README: document how to add a gallery (folder + `gallery.json`), reorder, replace an image, and the `check:galleries` script.

**Automated Verification**:
- [x] `node scripts/check-galleries.mjs` (strict) exits 0 with zero `TODO`.
- [x] `npm run build && npm run check` exits 0 and `dist/{headshots,landscapes,architecture,events}/index.html` exist.
- [x] `grep -o 'data-pswp-width' dist/landscapes/index.html | wc -l` is 26; `! grep -rq 'alt="TODO"' dist`.
- [x] `grep -o '<script[^>]*src="[^"]*"' dist/index.html` returns nothing (no JS on the home page), while `dist/landscapes/index.html` contains exactly one module script.
- [x] Build time on a cold cache logged in the implementation notes (expectation: under 5 minutes locally).

**Manual Verification**:
- [x] Each gallery renders rows of equal height with no gaps on the right except in the last row; images are sharp on a Retina display.
- [x] Click opens PhotoSwipe; arrow keys and Esc work; on an iPhone, swipe and pinch-zoom work.
- [x] With JavaScript disabled, clicking an image opens the large WebP directly.

### Phase 4: About, legal pages, SEO and redirects

Dependencies: Phase 2 (Phase 3 only for the full sitemap)

Every remaining page exists, the subtle software pointer is in place, and the site is
redirect- and SEO-complete.

**Tasks**:
- [x] `src/pages/about.astro`: `<Image>` of `src/assets/portrait.jpg` (max width 720px, `widths=[480,720,1440]`), `<h1>Peter Kurzok</h1>`, tagline, the sentence "By day I build apps. You can find them at <a href={appsUrl}>apps.peterkurzok.de</a>." in `--text-muted`, "Contact" button → `mailto:photo@peterkurzok.de`.
- [x] `src/pages/imprint.astro`: copy from app-site, title/description mention peterkurzok.de; keep address, phone, `imprint@peterkurzok.de`, § 5 DDG, § 18 Abs. 2 MStV, dispute-resolution and liability sections; rewrite the Copyright section for photographs (all images © Peter Kurzok, no reuse without permission) instead of app icons and speaker cards.
- [x] `src/pages/privacy.astro`: copy from app-site; "External links" lists Instagram, Flickr, 500px, LinkedIn, GitHub and apps.peterkurzok.de; note that the lightbox script is served from this domain; update "Last updated".
- [x] `public/_redirects` with the single line `/work  /  301` (Pages `_redirects` only supports path sources; the `www` redirect is a zone rule in Phase 5).
- [x] Verify `Base.astro` emits canonical, OG and Twitter tags on every page; `lang="en"`.
- [x] README "Deployment" section mirroring app-site (build command, output dir, no local deploy script) plus the DNS note from Phase 5.

**Automated Verification**:
- [x] `npm run build && npm run check` exits 0.
- [x] `test -f dist/about/index.html && test -f dist/imprint/index.html && test -f dist/privacy/index.html && test -f dist/_redirects`.
- [x] `grep -o 'apps.peterkurzok.de' dist/about/index.html | wc -l` is 2 (sentence + footer) and `grep -o 'apps.peterkurzok.de' dist/index.html | wc -l` is 1 (footer only).
- [x] `grep -q '§ 5 DDG' dist/imprint/index.html && ! grep -q 'TMG' dist/imprint/index.html`.
- [x] `grep -o '<loc>' dist/sitemap-0.xml | wc -l` is 8 (home, 4 galleries, about, imprint, privacy).

**Manual Verification**:
- [x] `/about` reads well in both schemes; the apps sentence is noticeable only on reading, not at a glance.

### Phase 5: Go-live — repository, Pages project, DNS move

Dependencies: Phases 1–4

The site is reachable at https://peterkurzok.de, `www` redirects, mail keeps working,
and the Adobe site can be retired.

**Tasks**:
- [ ] Create GitHub repo `pkurzok/photo-web`, push `main`.
- [ ] Cloudflare dashboard → Pages → connect the repo: build command `npm run build`, output `dist`, env `NODE_VERSION=22`. Wait for the first deploy; smoke-test `https://photo-web.pages.dev`.
- [x] Write `scripts/dns-snapshot.sh <nameserver> <outfile>`: a `dig +noall +answer +nottlid` loop over `peterkurzok.de` (A/AAAA/MX/TXT/NS) and `www`, `apps`, `blog`, `playtales`, `sig1._domainkey` (A/CNAME), output sorted so two snapshots diff cleanly (SOA deliberately excluded, it always differs).
- [ ] Run `scripts/dns-snapshot.sh ns.inwx.de docs/dns/2026-inwx-before.txt` and commit it.
- [ ] Cloudflare → Domains → Onboard `peterkurzok.de` (Free plan). Let it scan, then compare against the snapshot and add anything missing: MX ×2, the three TXT records, `sig1._domainkey` CNAME, `apps`/`blog`/`playtales` CNAMEs. Set every record to **DNS only** (grey cloud). Keep the Adobe `A` records for apex and `www` for now.
- [ ] At INWX: confirm DNSSEC is off for the domain, then replace the nameservers with the two Cloudflare nameservers shown in the dashboard. Wait for "Active" (email from Cloudflare).
- [ ] Verify via `dig @1.1.1.1` and `dig @8.8.8.8` that MX, SPF TXT, DKIM CNAME and the three subdomain CNAMEs resolve exactly as in the snapshot; send one test mail to and from an `@peterkurzok.de` address.
- [ ] Pages project → Custom domains → add `peterkurzok.de` only. Cloudflare replaces the Adobe apex `A` records with the Pages CNAME automatically; confirm in the DNS tab.
- [ ] `www`: delete the Adobe `A www` records, add a **proxied** `A www 192.0.2.1` placeholder, then Rules → Redirect Rules → template "Redirect from WWW to Root" (301, preserve path and query). This is Cloudflare's documented www-redirect setup for Pages.
- [ ] Run `scripts/dns-snapshot.sh 1.1.1.1 docs/dns/2026-cloudflare-after.txt` and commit it.
- [ ] README: replace the INWX external-DNS note with "zone is on Cloudflare; custom domains are added in the Pages project, which creates the records".
- [ ] Hand-off note for the user: Adobe Portfolio can now be cancelled; `cdn.myportfolio.com` is no longer referenced anywhere.

**Automated Verification**:
- [ ] `curl -sI https://peterkurzok.de/ | head -1` is `HTTP/2 200` and the body contains `<a href="/headshots"`.
- [ ] `curl -sI https://www.peterkurzok.de/landscapes` is a 301 to `https://peterkurzok.de/landscapes`; `curl -sI https://peterkurzok.de/work` is a 301 to `/` (first verifiable here: `astro preview` does not process `_redirects`).
- [ ] `for p in headshots landscapes architecture events about imprint privacy; do curl -s -o /dev/null -w "$p %{http_code}\n" https://peterkurzok.de/$p; done` prints 200 for all.
- [ ] `diff <(grep -E 'MX|TXT|_domainkey|apps|blog|playtales' docs/dns/2026-inwx-before.txt) <(grep -E 'MX|TXT|_domainkey|apps|blog|playtales' docs/dns/2026-cloudflare-after.txt)` is empty (TTLs are stripped by the script, so only values are compared).
- [ ] `curl -s https://apps.peterkurzok.de/ -o /dev/null -w "%{http_code}"` is 200 (sibling sites unaffected).

**Manual Verification**:
- [ ] Open https://peterkurzok.de on a phone and a desktop: covers, one gallery with lightbox, About, footer links.
- [ ] A test mail sent to an `@peterkurzok.de` address arrives in iCloud; a reply from it passes SPF/DKIM (check headers).

## Implementation Notes

During implementation, document user feedback, problems, and decisions here.

- **Phase 1 – real image sizes (2026-10-02):** the `_rw_<N>` rendition name is an upper
  bound, Adobe never upscales. Actual long edge of the 63 gallery images: 4× 3840,
  1× 1920, 57× 1280, 1× 768 (`landscapes/11.jpg`). So most photos were uploaded at
  1280 px and will look soft in the lightbox on Retina displays until they are replaced
  by larger exports. `import-manifest.json` therefore records the real `width`/`height`
  next to the requested `rendition`. Covers: 1089, 3840, 882, 1089 px wide. Portrait
  original: 3024×4032.
- **Phase 1 – importer never overwrites `gallery.json`**, so a re-run cannot wipe the
  hand-written alt texts.
- **Phase 2 – cover `src`:** `GalleryCover` passes `width={Math.min(1600, cover.width)}`
  so the fallback `src` is not a full 3840 px WebP (same trick as decision 6).
- **Phase 2 – icons:** flickr, 500px and linkedin glyphs are Simple Icons paths (CC0).
  The 500px wordmark is drawn wider than the square icons, otherwise it is illegible.
  Flickr link normalised to `https://www.flickr.com/photos/filmaniac` (was an http
  redirect).
- **Phase 3 – originals pruned from `dist`:** Astro copies the original JPEG of every
  `image()` in a content collection into `dist/_astro` even when only renditions are
  used (67 files, 47 MB). A small integration in `astro.config.mjs` deletes originals no
  built file references; `dist` is 21 MB instead of 68 MB.
- **Phase 3 – thumbs also get `width`:** capped at `min(1440, src.width)` for the same
  reason as the lightbox call. PhotoSwipe's CSS is imported in the component
  frontmatter instead of inside the `<script>` (lands in the page stylesheet).
- **Phase 3 – `check-galleries.mjs`:** strict by default (`--allow-todo` relaxes it);
  the hard-coded 7/26/16/14 counts moved behind `--imported` so the galleries can change
  later; added a check for image files not referenced in `gallery.json`.
- **Phase 3 – alt texts:** written from the images. Place names (Frauenkirche Dresden,
  ECB/Main in Frankfurt, Long Room at Trinity College Dublin, Speicherstadt Hamburg,
  Mont-Saint-Michel, Potsdamer Platz) are my identification and need a quick review.
- **Phase 3 – build time:** cold cache (no `node_modules/.astro`, no `dist`) ~6 s
  locally, 196 WebP files.
- **Phase 4 – grep count:** `grep -o 'apps.peterkurzok.de' dist/about/index.html` gives
  3, not 2 — the sentence contributes both the `href` and the link text. Home gives 1 as
  expected.
- **Phase 4 – privacy contact** uses `imprint@peterkurzok.de` (app-site used
  `apps@…`, which does not fit here).
- **Phase 5 – DNS snapshot not taken yet:** `dig` cannot reach any DNS server from the
  agent sandbox. `scripts/dns-snapshot.sh` is written but untested against a live
  server; run it from a normal shell.
- **Visual check:** headless Chromium screenshots of home, landscapes, about (light/dark,
  390 px and 1440–1600 px) look as designed. On phones a portrait photo that ends up
  alone in a row fills the full width (tall tile) — inherent to the CSS-only grid.
- **2026-10-02:** manual verification of Phases 2–4 confirmed by Peter; initial commit made on `main`. Phase 5 open.

## References

- Live site analysed on 2026-10-02: https://peterkurzok.de (7 pages, 63 gallery images, 4 covers, 1 portrait)
- Sibling project used as template: `/Users/peter.kurzok/ws-privat/app-site` (README "Custom domain" section, `src/layouts/Base.astro`, `scripts/check-assets.mjs`)
- Cloudflare Pages custom domains (apex requires a Cloudflare zone): https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare Pages limits (25 MiB per file, 20-minute build timeout): https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Pages `_redirects`: https://developers.cloudflare.com/pages/configuration/redirects/
- INWX ALIAS records (not usable here, documented for completeness): https://kb.inwx.com/en-us/3-nameserver/130-how-do-i-create-alias-records
- Astro content collections with `glob` loader and `image()` schema helper: https://docs.astro.build/en/guides/content-collections/
- Astro `getImage()` / `<Picture>`: https://docs.astro.build/en/guides/images/
- PhotoSwipe 5 getting started (`data-pswp-width/height`, `pswpModule` lazy import): https://photoswipe.com/getting-started/ ; `data-pswp-srcset` is read in `src/js/core/base.js` of the PhotoSwipe repo
- Cloudflare www → root redirect for Pages (placeholder `A www 192.0.2.1` + redirect): https://developers.cloudflare.com/pages/how-to/www-redirect/
