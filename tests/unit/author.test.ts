import { describe, it, expect } from 'vitest';
import { authorWho } from '../../src/lib/author';

describe('authorWho', () => {
  it('joins title and name', () => {
    expect(authorWho('Klinik Psikolog', 'Osman Güneş Özkurt')).toBe('Klinik Psikolog Osman Güneş Özkurt');
  });
  it('leaves out an empty title or name', () => {
    expect(authorWho('  ', 'Osman Güneş Özkurt')).toBe('Osman Güneş Özkurt');
    expect(authorWho('Clinical Psychologist', '')).toBe('Clinical Psychologist');
  });
});
