/**
 * Post cover thumbnails for list rows (ListItem's 48 px image). Covers are content images, so Astro's
 * image service crops and converts them: a 96 px square WebP (sharp on 2× screens), not the full cover.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

export async function postThumb(cover: unknown): Promise<string | undefined> {
  if (!cover) return undefined;
  const img = await getImage({ src: cover as ImageMetadata, width: 96, height: 96, fit: 'cover', format: 'webp' });
  return img.src;
}
