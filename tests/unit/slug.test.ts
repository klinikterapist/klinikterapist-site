import { describe, it, expect } from 'vitest';
import { slugify } from '../../src/lib/slug';

describe('slugify', () => {
  it('handles Turkish diacritics and dotted/dotless i', () => {
    expect(slugify('Kaygı ile Yaşamak: Düşman mı?', 'tr')).toBe('kaygi-ile-yasamak-dusman-mi');
    expect(slugify('İlişkiler ve Sınırlar', 'tr')).toBe('iliskiler-ve-sinirlar');
    expect(slugify('ÇOK ÖNEMLİ   ŞEY!!', 'tr')).toBe('cok-onemli-sey');
  });

  it('slugifies English text', () => {
    expect(slugify('Living with Anxiety — Enemy or Messenger?', 'en')).toBe(
      'living-with-anxiety-enemy-or-messenger',
    );
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  --a--  ', 'en')).toBe('a');
  });
});
