// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * Astro emits the original JPEG of every image a content collection references, even
 * though the pages only use the generated WebP renditions. Drop every original that no
 * built file refers to, so ~50 MB of full-resolution photos are not deployed.
 *
 * @returns {import('astro').AstroIntegration}
 */
function pruneUnusedOriginals() {
  return {
    name: 'prune-unused-originals',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const entries = await readdir(dist, { recursive: true, withFileTypes: true });
        const files = entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));

        const text = await Promise.all(
          files.filter((f) => /\.(html|css|js|xml)$/.test(f)).map((f) => readFile(f, 'utf8')),
        );
        const originals = files.filter((f) => /[\\/]_astro[\\/][^\\/]+\.(jpe?g|png)$/i.test(f));
        const unused = originals.filter((f) => !text.some((t) => t.includes(f.split(/[\\/]/).pop())));

        await Promise.all(unused.map((f) => rm(f)));
        logger.info(`removed ${unused.length} unreferenced original(s) from dist/_astro`);
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://peterkurzok.de',
  integrations: [sitemap(), pruneUnusedOriginals()],
});
