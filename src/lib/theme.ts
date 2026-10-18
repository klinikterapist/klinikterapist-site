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
  let keyHandled = false;
  let keyDownOnChip = false;

  const current = (): 'light' | 'dark' => (doc.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

  const sync = (flashSystem = false): void => {
    const choice: ThemeChoice = stored(win) ?? 'system';
    doc.querySelectorAll<HTMLElement>('[data-theme-set]').forEach((el) => {
      const value = el.dataset.themeSet;
      if (value === 'toggle') {
        // Visible labels are swapped by CSS from html[data-theme]; the accessible name is kept in step here
        // so it always contains the visible mode word (WCAG 2.5.3).
        const mode = flashSystem ? 'system' : current();
        if (flashSystem) el.dataset.flash = 'system';
        else delete el.dataset.flash;
        const name = el.dataset[`aria${mode[0].toUpperCase()}${mode.slice(1)}`];
        if (name) el.setAttribute('aria-label', name);
      } else {
        el.setAttribute('aria-pressed', String(value === choice));
      }
    });
  };

  const toggleEl = (target: EventTarget | null): HTMLElement | null =>
    (target as Element | null)?.closest?.<HTMLElement>('[data-theme-set="toggle"]') ?? null;

  const startPress = (): void => {
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

  const onClick = (e: Event): void => {
    const el = (e.target as Element).closest<HTMLElement>('[data-theme-set]');
    if (!el) return;
    if (longPressed || keyHandled) {
      // The click that ends a long-press (or follows a handled key) is not a tap.
      longPressed = false;
      keyHandled = false;
      return;
    }
    const value = el.dataset.themeSet;
    setTheme(value === 'toggle' ? (current() === 'dark' ? 'light' : 'dark') : (value as ThemeChoice), win);
    sync();
  };

  const onDown = (e: Event): void => {
    if (toggleEl(e.target)) startPress();
  };
  // Released anywhere (even off the button): stop the timer and drop the long-press flag after the click phase.
  const onPointerEnd = (): void => {
    cancel();
    win.setTimeout(() => {
      longPressed = false;
    }, 0);
  };
  // Capture-phase leave fires for children too; only the chip itself ends the press.
  const onLeave = (e: Event): void => {
    if (e.target === toggleEl(e.target)) onPointerEnd();
  };

  // Keyboard: Enter/Space is handled here (not as a synthetic click) so a hold can mean "system".
  const isActivationKey = (e: KeyboardEvent): boolean => e.key === 'Enter' || e.key === ' ';
  const onKeyDown = (e: KeyboardEvent): void => {
    if (!toggleEl(e.target) || !isActivationKey(e)) return;
    e.preventDefault();
    keyDownOnChip = true;
    if (!e.repeat) startPress();
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (!toggleEl(e.target) || !isActivationKey(e)) return;
    e.preventDefault();
    // A keyup without a keydown on the chip (focus arrived mid-press) is not a tap.
    if (!keyDownOnChip) return;
    keyDownOnChip = false;
    cancel();
    if (longPressed) {
      longPressed = false;
      return;
    }
    keyHandled = true;
    win.setTimeout(() => {
      keyHandled = false;
    }, 0);
    setTheme(current() === 'dark' ? 'light' : 'dark', win);
    sync();
  };

  // Focus leaving the chip mid-press abandons the press: no timer, no pending key release.
  const onFocusOut = (e: Event): void => {
    if (!toggleEl(e.target) || !keyDownOnChip) return;
    keyDownOnChip = false;
    longPressed = false;
    cancel();
  };

  doc.addEventListener('click', onClick);
  doc.addEventListener('pointerdown', onDown);
  doc.addEventListener('pointerup', onPointerEnd);
  doc.addEventListener('pointercancel', onPointerEnd);
  doc.addEventListener('pointerleave', onLeave, true);
  doc.addEventListener('keydown', onKeyDown);
  doc.addEventListener('keyup', onKeyUp);
  doc.addEventListener('focusout', onFocusOut);

  const mq = win.matchMedia?.('(prefers-color-scheme: dark)');
  const onSystemChange = (): void => sync();
  mq?.addEventListener?.('change', onSystemChange);
  sync();

  return () => {
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('pointerdown', onDown);
    doc.removeEventListener('pointerup', onPointerEnd);
    doc.removeEventListener('pointercancel', onPointerEnd);
    doc.removeEventListener('pointerleave', onLeave, true);
    doc.removeEventListener('keydown', onKeyDown);
    doc.removeEventListener('keyup', onKeyUp);
    doc.removeEventListener('focusout', onFocusOut);
    mq?.removeEventListener?.('change', onSystemChange);
    cancel();
    win.clearTimeout(flashTimer);
  };
}
