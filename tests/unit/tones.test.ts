import { describe, it, expect } from 'vitest';
import { CATEGORY_TONES, categoryTone } from '../../src/lib/tones';
import { TONES } from '../../src/lib/palette';

describe('categoryTone', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  it('uses every tone once, then starts again', () => {
    expect([...CATEGORY_TONES].sort()).toEqual([...TONES].sort());
    expect(ids.map((id) => categoryTone(id, ids))).toEqual([...CATEGORY_TONES, CATEGORY_TONES[0]]);
  });
  it('gives neighbouring topics different tones', () => {
    for (let i = 1; i < ids.length; i++) expect(categoryTone(ids[i], ids)).not.toBe(categoryTone(ids[i - 1], ids));
  });
  it('falls back to the first tone for an unknown or missing topic', () => {
    expect(categoryTone('zzz', ids)).toBe(CATEGORY_TONES[0]);
    expect(categoryTone(undefined, ids)).toBe(CATEGORY_TONES[0]);
  });
});
