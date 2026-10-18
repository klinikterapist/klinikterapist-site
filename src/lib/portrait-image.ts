/**
 * The profile photo, optimised. The admin panel uploads it to public/images (a public file Astro does
 * not process on its own), so the photos there are imported at build time and resized by Astro's image
 * service: a 112 px avatar gets a small file, not the full upload.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { Profile } from './settings';
import { variantWidths } from './portrait-widths';

const PUBLIC_IMAGES = import.meta.glob<{ default: ImageMetadata }>('/public/images/**/*.{webp,jpg,jpeg,png,avif}', {
  eager: true,
});

export type PortraitStyle = 'background' | 'round' | 'none';

/** Home portrait style: the chosen one when there is a photo (background by default), the sun layout without. */
export function portraitStyle(profile: Pick<Profile, 'photo' | 'heroStyle'>): PortraitStyle {
  return profile.photo ? (profile.heroStyle ?? 'background') : 'none';
}

export interface PortraitImage {
  src: string;
  srcset?: string;
  width: number;
  height: number;
}

/**
 * `photo` (a site path such as `/images/profil-x.webp`) as WebP variants at `widths` px, never upscaled,
 * keeping its aspect ratio. A path outside public/images (an external URL, a test fixture) is used as is.
 */
export async function portraitImage(photo: string, widths: number[]): Promise<PortraitImage> {
  const meta = PUBLIC_IMAGES[`/public${photo}`]?.default;
  const largest = Math.max(...widths);
  if (!meta) return { src: photo, width: largest, height: largest };
  const useWidths = variantWidths(widths, meta.width);
  const width = Math.max(...useWidths);
  const img = await getImage({ src: meta, widths: useWidths, width, format: 'webp' });
  return {
    src: img.src,
    srcset: img.srcSet.attribute,
    width,
    height: Math.round((width * meta.height) / meta.width),
  };
}
