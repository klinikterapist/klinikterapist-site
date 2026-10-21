/**
 * The bell in the corner and the menu badges (owner's request 2026-10-21): the latest events and the
 * waiting requests, fetched when the panel opens and again every few minutes while the tab is in view,
 * so a new request or a client's change shows without reloading. "Seen" is the time of the last look
 * (the bell or Bildirimler), kept in this browser only.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Api, PanelEvent } from '../api/types';

export const SEEN_KEY = 'kt.events.seen';
const SEEN_EVENT = 'kt:events-seen';
/** How often the panel asks again while it is open and in view. */
export const POLL_MS = 3 * 60e3;

export function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Marks everything up to now as seen, here and in every open bell. */
export function markSeen(at = Date.now()) {
  try {
    localStorage.setItem(SEEN_KEY, String(at));
  } catch {
    /* no storage: everything stays new */
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

export type NotificationState = { events: PanelEvent[]; pending: number; seen: number; loaded: boolean; failed: boolean };

/** Newest first. */
export const unseenOf = (events: PanelEvent[], seen: number) => events.filter((e) => e.at > seen).length;

export function useNotifications(api: Api): NotificationState & { refresh: () => void } {
  const [state, setState] = useState<NotificationState>(() => ({ events: [], pending: 0, seen: readSeen(), loaded: false, failed: false }));
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.eventsList(), api.requestsList()])
      .then(([ev, rq]) => {
        if (!alive) return;
        const events = [...ev.events].sort((a, b) => b.at - a.at);
        setState((s) => ({ ...s, events, pending: rq.requests.filter((r) => r.status === 'pending').length, loaded: true, failed: false }));
      })
      .catch(() => alive && setState((s) => ({ ...s, failed: true })));
    return () => {
      alive = false;
    };
  }, [api, tick]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    const onSeen = () => setState((s) => ({ ...s, seen: readSeen() }));
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(SEEN_EVENT, onSeen);
    };
  }, [refresh]);

  return { ...state, refresh };
}
