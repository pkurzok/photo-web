# photo-web

Photography portfolio of Peter Kurzok — [peterkurzok.de](https://peterkurzok.de).

Static [Astro](https://astro.build) site, built and hosted on Cloudflare Pages. No
cookies, no tracking, nothing loaded from third parties.

## Development

```bash
npm install
npm run dev              # local dev server on http://localhost:4321
npm run build            # static build into dist/
npm run preview          # serve the built site
npm run check            # verify every asset referenced in dist/ actually exists
npm run check:galleries  # verify gallery.json files against the image folders
```

## Galleries

Each gallery is one folder under `src/content/galleries/`. The folder name is the URL
(`landscapes/` → `/landscapes`).

```
src/content/galleries/
├── import-manifest.json     where each imported file came from (see below)
└── landscapes/
    ├── gallery.json         title, position on the home page, cover, images + alt texts
    ├── cover.jpg            home page tile
    ├── 01.jpg
    ├── 02.jpg
    └── …
```

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

The files are the originals: Astro generates the responsive WebP renditions from them
at build time, so the best available export belongs in the repo, not a web-sized copy.

### Changing galleries

- **Add a gallery:** create a folder with a `gallery.json`, a `cover.jpg` and the
  images. It appears on the home page at its `order` position and gets its own page;
  nothing else needs editing.
- **Reorder images:** reorder the entries in `images`. File names carry no meaning
  beyond being unique within the folder.
- **Replace an image:** overwrite the file with a better export (same name). Aspect
  ratio and size are read from the file at build time.
- **Add or remove an image:** add or delete the file and its `images` entry together.
- **Alt texts** are required. The build fails on an empty alt text or the placeholder
  `TODO`.

`npm run check:galleries` verifies that every referenced file exists, that no image in
a gallery folder is left unreferenced, and that no alt text is missing.

Renditions: thumbnails 480/960/1440 px, lightbox 1440/1920/2560 px, all WebP at quality
82 and never larger than the original. The gallery pages are the only ones that load
JavaScript ([PhotoSwipe](https://photoswipe.com), bundled locally); without it every
thumbnail is a plain link to its largest rendition.

Site-wide texts and links (home masthead line, tagline, email, social profiles, apps
link) live in `src/data/site.json`. The masthead photo is `src/assets/masthead.jpg`, the
About portrait `src/assets/portrait.jpg`.

## Import from Adobe Portfolio

`npm run import` (`scripts/import-adobe.mjs`) reads the live Adobe Portfolio pages and
downloads every gallery image, the four covers, the home masthead, the About portrait
and the favicons at
the largest rendition the Adobe CDN serves. It was a one-off for the migration and only
works while the Adobe site is still online.

The script skips files that already exist and never overwrites a `gallery.json`, so
re-running it is safe. `src/content/galleries/import-manifest.json` records source URL,
real pixel size and byte size per file. Most imported images are only 1280 px on the
long edge — the manifest shows which ones would benefit from a fresh, larger export.

## Deployment

Pushing to `main` triggers a Cloudflare Pages build:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION=22` |

There is deliberately no local deploy script — deploying from a workstation would
overwrite the git-deployed version.

The build removes the original JPEGs Astro copies into `dist/_astro` (see
`astro.config.mjs`); only the WebP renditions are deployed.

`public/_redirects` sends `/work` to `/` (the old Adobe URL). `astro preview` does not
process that file, so the redirect only works on Cloudflare.

### Domain and DNS

`peterkurzok.de` is served from the apex, which Pages only allows for a zone in the same
Cloudflare account. The DNS zone therefore moves from INWX to Cloudflare (the
registration stays at INWX); until that move is done, the notes below describe the
target state.

- The apex is added under **Custom domains** in the Pages project, which creates the
  record.
- `www.peterkurzok.de` is a proxied placeholder record (`A www 192.0.2.1`) plus the zone
  Redirect Rule "Redirect from WWW to Root" — `_redirects` cannot redirect across hosts.
- Mail (iCloud: MX, SPF, DKIM) and the sibling sites `apps`, `blog` and `playtales` live
  in the same zone. `scripts/dns-snapshot.sh <nameserver> <outfile>` writes a normalised
  snapshot of those records; `docs/dns/` keeps the before/after pair of the move.
