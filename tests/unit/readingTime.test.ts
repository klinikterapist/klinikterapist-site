import { describe, it, expect } from 'vitest';
import { countWords, readingTime } from '../../src/lib/readingTime';

describe('readingTime', () => {
  it('returns at least 1 minute for empty input', () => {
    expect(readingTime('')).toBe(1);
  });

  it('counts 200 words per minute, rounded up', () => {
    expect(readingTime('kelime '.repeat(400))).toBe(2);
  });

  it('ignores markdown syntax and image references', () => {
    expect(readingTime('# Başlık\n\n![alt](x.webp)\n\n' + 'söz '.repeat(201))).toBe(2);
  });
});

describe('countWords', () => {
  it('counts words, skipping images and link URLs', () => {
    expect(countWords('Bir iki ![x](./a.webp) [üç](https://a.co)')).toBe(3);
  });
});
