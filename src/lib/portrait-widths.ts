/**
 * Widths (px) to generate for a portrait of `sourceWidth` px: the asked widths below the source,
 * plus the source width itself when a larger width was asked for (never upscaled), sorted, no repeats.
 * Kept apart from portrait-image.ts (which needs astro:assets) so it is unit-tested.
 */
export function variantWidths(widths: number[], sourceWidth: number): number[] {
  const capped = widths.map((w) => Math.min(w, sourceWidth));
  return [...new Set(capped)].sort((a, b) => a - b);
}
