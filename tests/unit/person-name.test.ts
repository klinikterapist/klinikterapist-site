import { describe, expect, it } from 'vitest';
import { personName } from '../../src/lib/person-name';

describe('personName', () => {
  it('gives every part a capital, in Turkish by default', () => {
    expect(personName('ayşe nur yılmaz')).toBe('Ayşe Nur Yılmaz');
    expect(personName('ilker ışık')).toBe('İlker Işık');
    expect(personName('ÖZGÜR İNCE')).toBe('Özgür İnce');
  });

  it('uses English rules on the English forms', () => {
    expect(personName('ian smith', 'en')).toBe('Ian Smith');
  });

  it('keeps mixed case, hyphens and apostrophes, and squeezes spaces', () => {
    expect(personName('  mary   McDonald ')).toBe('Mary McDonald');
    expect(personName('elif yılmaz-kaya')).toBe('Elif Yılmaz-Kaya');
    expect(personName("seán o'neil", 'en')).toBe("Seán O'Neil");
  });
});
