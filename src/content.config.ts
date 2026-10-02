import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 'TODO' is the placeholder the Adobe importer writes — the build fails until it is replaced.
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
