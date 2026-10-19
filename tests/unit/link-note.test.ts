import { describe, it, expect } from 'vitest';
import { isEnglishNote } from '../../src/lib/link-note';

describe('isEnglishNote', () => {
  it('recognises English notes in either UI language, any case', () => {
    for (const n of ['İngilizce', 'ingilizce', 'İNGİLİZCE', 'In English', 'english', 'Yazılar İngilizce', 'ENGLISH', 'IN ENGLISH', 'INGILIZCE']) expect(isEnglishNote(n), n).toBe(true);
  });
  it('leaves every other note plain', () => {
    for (const n of ['', 'Günlük paylaşımlar', 'Kısa videolar', 'Daily posts']) expect(isEnglishNote(n), n).toBe(false);
  });
});
