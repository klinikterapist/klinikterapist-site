/**
 * Day/night theme. The inline head script (THEME_SCRIPT) applies the mode before first paint;
 * initThemeToggles() wires the visible toggles. A missing storage key means "system".
 */
export const THEME_KEY = 'site.theme';
export type ThemeChoice = 'system' | 'light' | 'dark';

/**
 * Inline, first child of <head>. Plain ES5, no dependencies. Sets data-theme explicitly
 * (stored choice, else the OS preference) and follows OS changes while in system mode.
 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement,k='${THEME_KEY}',m=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)');function g(){try{var v=localStorage.getItem(k);return v==='light'||v==='dark'?v:null}catch(e){return null}}function a(){d.dataset.theme=g()||(m&&m.matches?'dark':'light')}a();if(m&&m.addEventListener)m.addEventListener('change',function(){if(!g())a()})})();`;

function stored(win: Window): 'light' | 'dark' | null {
  try {
    const v = win.localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(win: Window): 'light' | 'dark' {
  return win.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Persist the choice ('system' removes the key) and apply it to <html>. */
export function setTheme(choice: ThemeChoice, win: Window = window): void {
  try {
    if (choice === 'system') win.localStorage.removeItem(THEME_KEY);
    else win.localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* private mode or blocked storage: the choice still applies to this page */
  }
  win.document.documentElement.dataset.theme = choice === 'system' ? systemTheme(win) : choice;
}

const LONG_PRESS_MS = 600;
const SYSTEM_FLASH_MS = 1500;

/** Wire every [data-theme-set] control (segmented buttons and the chip). Returns a cleanup. */
export function initThemeToggles(win: Window = window): () => void {
  const doc = win.document;
  let pressTimer: number | undefined;
  let flashTimer: number | undefined;
  let longPressed = false;

  const current = (): 'light' | 'dark' => (doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  const sync = (flashSystem = false): void => {
    const choice: ThemeChoice = stored(win) ?? 'system';
    doc.querySelectorAll<HTMLElement>('[data-theme-set]').forEach((el) => {
      const value = el.dataset.themeSet;
      if (value === 'toggle') {
        // The chip's three labels are swapped by CSS from html[data-theme]; only the flash needs state.
        if (flashSystem) el.dataset.flash = 'system';
        else delete el.dataset.flash;
      } else {
        el.setAttribute('aria-pressed', String(value === choice));
      }
    });
  };

  const onClick = (e: Event): void => {
    const el = (e.target as Element).closest<HTMLElement>('[data-theme-set]');
    if (!el) return;
    if (longPressed) {
      longPressed = false; // the click that ends a long-press is not a tap
      return;
    }
    const value = el.dataset.themeSet;
    setTheme(value === 'toggle' ? (current() === 'dark' ? 'light' : 'dark') : (value as ThemeChoice), win);
    sync();
  };

  const onDown = (e: Event): void => {
    const el = (e.target as Element).closest<HTMLElement>('[data-theme-set="toggle"]');
    if (!el) return;
    win.clearTimeout(pressTimer);
    pressTimer = win.setTimeout(() => {
      longPressed = true;
      setTheme('system', win);
      sync(true);
      win.clearTimeout(flashTimer);
      flashTimer = win.setTimeout(() => sync(), SYSTEM_FLASH_MS);
    }, LONG_PRESS_MS);
  };

  const cancel = (): void => win.clearTimeout(pressTimer);

  doc.addEventListener('click', onClick);
  doc.addEventListener('pointerdown', onDown);
  doc.addEventListener('pointerup', cancel);
  doc.addEventListener('pointercancel', cancel);
  doc.addEventListener('pointerleave', cancel, true);

  const mq = win.matchMedia?.('(prefers-color-scheme: dark)');
  const onSystemChange = (): void => sync();
  mq?.addEventListener?.('change', onSystemChange);
  sync();

  return () => {
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('pointerdown', onDown);
    doc.removeEventListener('pointerup', cancel);
    doc.removeEventListener('pointercancel', cancel);
    doc.removeEventListener('pointerleave', cancel, true);
    mq?.removeEventListener?.('change', onSystemChange);
    cancel();
    win.clearTimeout(flashTimer);
  };
}
