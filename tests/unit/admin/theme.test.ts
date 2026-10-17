// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { resolveTheme, applyTheme } from '../../../src/admin/ui/theme';

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
