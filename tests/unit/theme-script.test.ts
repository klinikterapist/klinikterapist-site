// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_KEY, THEME_SCRIPT, initThemeToggles, setTheme } from '../../src/lib/theme';

function mockMatchMedia(dark: boolean) {
  const listeners: Array<() => void> = [];
  const mq = {
    matches: dark,
    addEventListener: (_: string, f: () => void) => listeners.push(f),
    removeEventListener: () => {},
  };
  vi.stubGlobal('matchMedia', () => mq);
  (window as any).matchMedia = () => mq;
  return { mq, fire: () => listeners.forEach((f) => f()) };
}

const run = () => new Function(THEME_SCRIPT)();
const theme = () => document.documentElement.dataset.theme;

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('theme script', () => {
  it('applies the stored dark choice', () => {
    mockMatchMedia(false);
    localStorage.setItem(THEME_KEY, 'dark');
    run();
    expect(theme()).toBe('dark');
  });

  it('follows the OS when nothing is stored', () => {
    mockMatchMedia(true);
    run();
    expect(theme()).toBe('dark');
  });

  it('defaults to light when the OS is light', () => {
    mockMatchMedia(false);
    run();
    expect(theme()).toBe('light');
  });

  it('ignores junk stored values', () => {
    mockMatchMedia(true);
    localStorage.setItem(THEME_KEY, 'purple');
    run();
    expect(theme()).toBe('dark');
  });

  it('still follows matchMedia when getItem throws', () => {
    mockMatchMedia(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    run();
    expect(theme()).toBe('dark');
  });

  it('follows OS changes while in system mode only', () => {
    const m = mockMatchMedia(false);
    run();
    expect(theme()).toBe('light');
    m.mq.matches = true;
    m.fire();
    expect(theme()).toBe('dark');
    localStorage.setItem(THEME_KEY, 'light');
    m.fire();
    expect(theme()).toBe('dark'); // stored choice present: the listener leaves the page alone
  });
});

describe('theme toggling', () => {
  it('writes site.theme and applies it', () => {
    mockMatchMedia(false);
    setTheme('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(theme()).toBe('dark');
  });

  it('"system" removes the key and falls back to the OS', () => {
    mockMatchMedia(true);
    setTheme('light');
    setTheme('system');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(theme()).toBe('dark');
  });

  it('still applies when storage is blocked', () => {
    mockMatchMedia(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setTheme('dark');
    expect(theme()).toBe('dark');
  });
});

describe('toggle controls', () => {
  let cleanup: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    document.body.innerHTML = `
      <div>
        <button data-theme-set="system" aria-pressed="false">S</button>
        <button data-theme-set="light" aria-pressed="false">L</button>
        <button data-theme-set="dark" aria-pressed="false">D</button>
      </div>
      <button id="chip" data-theme-set="toggle" aria-label="Appearance: Day" data-aria-light="Appearance: Day" data-aria-dark="Appearance: Night" data-aria-system="Appearance: System"><span class="l-light">x</span></button>`;
    run();
    cleanup = initThemeToggles();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  const pressed = () => [...document.querySelectorAll('[aria-pressed]')].map((b) => b.getAttribute('aria-pressed'));
  const chip = () => document.getElementById('chip')!;

  it('marks System pressed initially, then follows clicks', () => {
    expect(pressed()).toEqual(['true', 'false', 'false']);
    (document.querySelector('[data-theme-set="dark"]') as HTMLElement).click();
    expect(pressed()).toEqual(['false', 'false', 'true']);
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    (document.querySelector('[data-theme-set="system"]') as HTMLElement).click();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(pressed()).toEqual(['true', 'false', 'false']);
  });

  it('chip tap toggles light and dark', () => {
    chip().click();
    expect(theme()).toBe('dark');
    chip().click();
    expect(theme()).toBe('light');
  });

  it('chip long-press resets to system and flashes for 1.5 s', () => {
    setTheme('dark');
    chip().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(600);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(chip().dataset.flash).toBe('system');
    chip().click(); // the click ending the press is swallowed
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    vi.advanceTimersByTime(1500);
    expect(chip().dataset.flash).toBeUndefined();
  });

  it('a short press is a tap, not a long-press', () => {
    chip().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(300);
    chip().dispatchEvent(new Event('pointerup', { bubbles: true }));
    vi.advanceTimersByTime(1000);
    chip().click();
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('keeps the chip accessible name in step with the visible mode', () => {
    expect(chip().getAttribute('aria-label')).toBe('Appearance: Day');
    chip().click();
    expect(chip().getAttribute('aria-label')).toBe('Appearance: Night');
    chip().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(600);
    expect(chip().getAttribute('aria-label')).toBe('Appearance: System');
    vi.advanceTimersByTime(1500);
    expect(chip().getAttribute('aria-label')).toBe('Appearance: Day');
  });

  it('a long-press released off the button does not swallow the next tap', () => {
    chip().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(600);
    document.body.dispatchEvent(new Event('pointerup', { bubbles: true }));
    vi.advanceTimersByTime(0);
    chip().click();
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('leaving a child of the chip does not cancel the press', () => {
    chip().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    chip().querySelector('span')!.dispatchEvent(new Event('pointerleave', { bubbles: true }));
    vi.advanceTimersByTime(600);
    expect(chip().dataset.flash).toBe('system');
  });

  const key = (type: 'keydown' | 'keyup', k: string, repeat = false) =>
    chip().dispatchEvent(new KeyboardEvent(type, { key: k, repeat, bubbles: true, cancelable: true }));

  it('a short Enter or Space toggles day and night', () => {
    key('keydown', 'Enter');
    key('keyup', 'Enter');
    expect(theme()).toBe('dark');
    key('keydown', ' ');
    key('keyup', ' ');
    expect(theme()).toBe('light');
  });

  it('holding Enter or Space for 600 ms resets to system; auto-repeat does not toggle', () => {
    setTheme('dark');
    key('keydown', 'Enter');
    for (let i = 0; i < 3; i++) key('keydown', 'Enter', true);
    vi.advanceTimersByTime(600);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(chip().dataset.flash).toBe('system');
    key('keyup', 'Enter');
    expect(localStorage.getItem(THEME_KEY)).toBeNull(); // release after a hold is not a tap

    setTheme('dark');
    key('keydown', ' ');
    vi.advanceTimersByTime(600);
    key('keyup', ' ');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });
});
