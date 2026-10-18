import { describe, expect, it } from 'vitest';
import { hitKeys, istanbulDay, istanbulHour, parseHit, readsByPost } from '../../src/lib/stats-wire';

describe('parseHit', () => {
  it('parses a view and drops unknown fields', () => {
    expect(parseHit({ t: 'view', p: '/blog/', r: 'www.instagram.com', d: 'm', l: 'tr', ip: '1.2.3.4' })).toEqual({ t: 'view', p: '/blog/', r: 'instagram.com', d: 'm', l: 'tr' });
  });
  it('rejects query strings, long paths and full referrer URLs', () => {
    expect(parseHit({ t: 'view', p: '/blog/?q=x' })).toBeNull();
    expect(parseHit({ t: 'view', p: `/${'a'.repeat(121)}/` })).toBeNull();
    expect(parseHit({ t: 'view', p: '/', r: 'https://instagram.com/x' })).toBeNull();
  });
  it('needs a key for reads and clicks', () => {
    expect(parseHit({ t: 'click' })).toBeNull();
    expect(parseHit({ t: 'read', k: 'ornek-yazi' })).toEqual({ t: 'read', k: 'ornek-yazi' });
    expect(parseHit({ t: 'click', k: 'randevu' })).toEqual({ t: 'click', k: 'randevu' });
  });
  it('rejects junk', () => {
    expect(parseHit(null)).toBeNull();
    expect(parseHit({ t: 'drop' })).toBeNull();
  });
});

describe('hitKeys and days', () => {
  it('a view counts the page, referrer, device and language', () => {
    expect(hitKeys({ t: 'view', p: '/', d: 't', l: 'en' })).toEqual(['v|/', 'ref|direct', 'dev|t', 'lang|en']);
  });
  it('23:30 on 31 October Istanbul is still 31 October', () => {
    const ms = Date.parse('2026-10-31T23:30:00+03:00');
    expect(istanbulDay(ms)).toBe('2026-10-31');
    expect(istanbulHour(ms)).toBe('2026103123');
  });
  it('reads add up per post over days', () => {
    expect(readsByPost({ '2026-10-01': { 'rd|a': 2, 'v|/': 9 }, '2026-10-02': { 'rd|a': 1, 'rd|b': 4 } })).toEqual({ a: 3, b: 4 });
  });
});
