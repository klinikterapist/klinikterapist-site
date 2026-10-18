import { describe, expect, it } from 'vitest';
import { readCount, readsLabel } from '../../src/lib/read-counts';

describe('readsLabel', () => {
  it('shows nothing without data or below 50 reads', () => {
    expect(readsLabel(null, 'tr')).toBeNull();
    expect(readsLabel(null, 'en')).toBeNull();
    expect(readsLabel(0, 'tr')).toBeNull();
    expect(readsLabel(49, 'tr')).toBeNull();
    expect(readsLabel(49, 'en')).toBeNull();
  });

  it('writes counts below 1000 as they are', () => {
    expect(readsLabel(50, 'tr')).toBe('50 okunma');
    expect(readsLabel(50, 'en')).toBe('50 reads');
    expect(readsLabel(980, 'tr')).toBe('980 okunma');
    expect(readsLabel(999, 'en')).toBe('999 reads');
  });

  it('shortens thousands and millions, Turkish style on TR pages', () => {
    expect(readsLabel(1200, 'tr')).toBe('1,2B okunma');
    expect(readsLabel(12500, 'tr')).toBe('12,5B okunma');
    expect(readsLabel(1_200_000, 'tr')).toBe('1,2M okunma');
    expect(readsLabel(1000, 'tr')).toBe('1B okunma');
  });

  it('shortens thousands and millions, English style on EN pages', () => {
    expect(readsLabel(1200, 'en')).toBe('1.2K reads');
    expect(readsLabel(12500, 'en')).toBe('12.5K reads');
    expect(readsLabel(1_200_000, 'en')).toBe('1.2M reads');
  });

  it('never prints 1000K: a count that rounds up to a million moves to M', () => {
    expect(readsLabel(999_960, 'en')).toBe('1M reads');
    expect(readsLabel(999_960, 'tr')).toBe('1M okunma');
  });

  it('the stub has no data yet', () => {
    expect(readCount('any-post')).toBeNull();
  });
});
