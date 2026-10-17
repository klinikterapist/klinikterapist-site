import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { dataDir, getCategories, slugSchema } from './lib/settings';

const categoryIds = () => getCategories().map((c) => c.id);

const posts = defineCollection({
  loader: glob({
    pattern: '**/{tr,en}.md',
    base: process.env.CONTENT_DIR ?? 'src/content/posts',
    // Entry id is `<key>/<lang>`. The default generator would let the
    // frontmatter `slug` override the id, so build it from the path instead.
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      seoTitle: z.string().optional(),
      description: z.string(),
      slug: slugSchema,
      focusKeyword: z.string(),
      category: z.string().refine((c) => categoryIds().includes(c), {
        message: `Bilinmeyen kategori. categories.json içindeki bir id olmalı: ${categoryIds().join(', ')}`,
      }),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
    }),
});

/** Legal texts: `<data>/legal/<name>.<lang>.md`, id `<name>.<lang>`. Body only, no frontmatter. */
const legal = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: `${dataDir()}/legal`,
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({}),
});

export const collections = { posts, legal };
