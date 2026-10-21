/**
 * Which "Gün & Gece" tone a topic wears on the site (chips on post cards, the Topics and FAQ pages).
 * A topic takes its tone from its place in src/data/categories.json, so neighbours always differ;
 * lacivert (the brand colour) comes last because links and buttons already use it.
 */
import type { Tone } from './palette';

export const CATEGORY_TONES: readonly Tone[] = ['lavanta', 'adacayi', 'deniz', 'kiremit', 'gunes', 'lacivert'];

/** Each resource type's tone (Resources page tiles, boxes and the featured card's label). */
export const RESOURCE_TONES = {
  book: 'lavanta',
  article: 'deniz',
  scale: 'adacayi',
  video: 'kiremit',
  podcast: 'gunes',
  guide: 'lacivert',
} as const satisfies Record<string, Tone>;

/** The tone of the `i`-th item of a list without topics (FAQ questions), so neighbours differ. */
export const toneAt = (i: number): Tone => CATEGORY_TONES[i % CATEGORY_TONES.length];

/** The tone of the topic `id` among `ids` (in their saved order); unknown topics get the first tone. */
export function categoryTone(id: string | undefined, ids: readonly string[]): Tone {
  const at = id ? ids.indexOf(id) : -1;
  return CATEGORY_TONES[Math.max(at, 0) % CATEGORY_TONES.length];
}
