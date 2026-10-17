// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { resolveTheme, applyTheme, useTheme, THEME_KEY } from '../../../src/admin/ui/theme';

describe('theme', () => {
  it('stored choice wins, else the device setting', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme('bogus', false)).toBe('light');
  });
  it('applyTheme sets data-theme on the root', () => {
    applyTheme('dark', document.documentElement);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('useTheme', () => {
  it('toggling flips the theme and stores the choice', () => {
    localStorage.clear();
    const { result } = renderHook(() => useTheme());
    const first = result.current[0];
    act(() => result.current[1]());
    expect(result.current[0]).toBe(first === 'dark' ? 'light' : 'dark');
    expect(localStorage.getItem(THEME_KEY)).toBe(result.current[0]);
    expect(document.documentElement.dataset.theme).toBe(result.current[0]);
  });
  it('a throwing storage does not crash', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useTheme());
    const first = result.current[0];
    expect(() => act(() => result.current[1]())).not.toThrow();
    expect(result.current[0]).toBe(first === 'dark' ? 'light' : 'dark');
    get.mockRestore();
    set.mockRestore();
  });
});
