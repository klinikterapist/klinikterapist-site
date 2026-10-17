import { describe, it, expect } from 'vitest';
import { loneImageCaption } from '../../src/lib/markdown-figure';

const img = (title?: string | null) => ({ type: 'image', url: './a.webp', alt: 'Alt', title });
const text = (value: string) => ({ type: 'text', value });

describe('loneImageCaption', () => {
  it('returns the title of an image that is alone in its paragraph', () => {
    expect(loneImageCaption([text('\n'), img('Cap'), text(' ')])).toBe('Cap');
  });
  it('returns an empty caption for a lone untitled image', () => {
    expect(loneImageCaption([img()])).toBe('');
    expect(loneImageCaption([img(null)])).toBe('');
  });
  it('returns null when the paragraph has text or more than one image', () => {
    expect(loneImageCaption([text('metin '), img('Cap')])).toBeNull();
    expect(loneImageCaption([img('a'), img('b')])).toBeNull();
    expect(loneImageCaption([text('yalnız metin')])).toBeNull();
  });
});
