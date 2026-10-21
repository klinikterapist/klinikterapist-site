/** "Kendi ziyaretlerimi sayma": the site's counter skips this browser while `kt.noTrack` is '1' (Counter.astro). '0' = count me. */
import { useEffect, useState } from 'react';

const NO_TRACK = 'kt.noTrack';

export function useNoTrack(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(NO_TRACK) !== '0';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(NO_TRACK, on ? '1' : '0');
    } catch {
      /* private mode: nothing to remember */
    }
  }, [on]);
  return [on, setOn];
}
