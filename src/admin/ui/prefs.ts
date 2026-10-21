/**
 * Small panel preferences kept in this browser (menu rail, folded groups), shared live between the
 * screens that show them: a change in Ayarlar › Görünüm moves the menu at once.
 */
import { useCallback, useEffect, useState } from 'react';

const EVENT = 'kt:pref';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function usePref<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  useEffect(() => {
    const on = (e: Event) => (e as CustomEvent<string>).detail === key && setValue(read(key, fallback));
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
    // `fallback` is a constant at each call site.
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = useCallback(
    (v: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* private mode: lasts for this visit */
      }
      setValue(v);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key],
  );
  return [value, set];
}

/** The desktop menu as a narrow icon rail. */
export const RAIL_KEY = 'kt.nav.rail';
