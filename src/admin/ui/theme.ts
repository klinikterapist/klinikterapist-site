import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'panel.theme';

/** The stored choice wins; anything else falls back to the device setting. */
export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function applyTheme(t: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = t;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** What the owner picked: a theme, or "follow the device" ('system'). */
export type ThemeChoice = Theme | 'system';
const THEME_EVENT = 'kt:theme';

export function readChoice(): ThemeChoice {
  const v = readStored();
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** Stores the choice, applies it and tells every open switch (menu and Ayarlar › Görünüm). */
export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* private mode: the choice just lasts for this visit */
  }
  applyTheme(resolveTheme(choice === 'system' ? null : choice, prefersDark()));
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useTheme(): [Theme, () => void, ThemeChoice] {
  const [state, setState] = useState(() => ({ theme: resolveTheme(readStored(), prefersDark()), choice: readChoice() }));
  useEffect(() => {
    const sync = () => setState({ theme: resolveTheme(readStored(), prefersDark()), choice: readChoice() });
    // "Cihaza göre": follow the device when it switches between day and night.
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const onDevice = () => {
      if (readChoice() !== 'system') return;
      applyTheme(resolveTheme(null, prefersDark()));
      sync();
    };
    window.addEventListener(THEME_EVENT, sync);
    mq?.addEventListener?.('change', onDevice);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      mq?.removeEventListener?.('change', onDevice);
    };
  }, []);
  const toggle = useCallback(() => {
    const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
    setThemeChoice(next);
    // Set after the event, so the switch flips even when the storage cannot be read back.
    setState({ theme: next, choice: next });
  }, [state.theme]);
  return [state.theme, toggle, state.choice];
}
