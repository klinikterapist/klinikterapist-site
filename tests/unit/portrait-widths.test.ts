import { describe, expect, it } from 'vitest';
import { variantWidths } from '../../src/lib/portrait-widths';

describe('portrait variant widths', () => {
  it('keeps the asked widths when the source is larger (112 px avatar never gets the 1080 original)', () => {
    expect(variantWidths([112, 224, 336], 1080)).toEqual([112, 224, 336]);
  });

  it('never upscales: widths above the source collapse into the source width', () => {
    expect(variantWidths([480, 720, 1080], 600)).toEqual([480, 600]);
    expect(variantWidths([420, 840], 300)).toEqual([300]);
  });

  it('deduplicates and sorts', () => {
    expect(variantWidths([720, 480, 1080, 480], 1080)).toEqual([480, 720, 1080]);
    expect(variantWidths([1080, 1200], 1080)).toEqual([1080]);
  });
});
