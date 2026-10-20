/**
 * The client's own page (owner's decisions 2026-10-20): a secret link per client, sent from the
 * panel, opens `/randevum/` (`/en/my-appointment/`) with the code after `#`, so it never reaches a
 * server log or a referrer. The page shows the next sessions — no name, no e-mail, no notes — and
 * lets the client cancel a session (at once, and only 24 hours or more before it: the owner chose a
 * hard rule), ask for another time, or say they want to end therapy. Each goes to the owner by
 * e-mail and is written on the client's sessions in Seans takip as "danışan istedi".
 * Shared by the site page and the backend.
 */
import { slotInstant } from './booking-form';
import { pastAndNext, type SessionKind, type SessionStatus, type TrackedClient } from './sessions';

export const TRACK_PATH = { tr: '/randevum/', en: '/en/my-appointment/' } as const;
/** The code's name after `#` in the link. */
export const TRACK_PARAM = 'k';
/** A session closer than this can no longer be cancelled or moved on the page. */
export const LATE_MS = 24 * 3600 * 1000;
/** Longest note the client may add (cancellation reason, times that suit them, why they want to end). */
export const TRACK_NOTE_MAX = 300;

/** `<client id>.<signature>` (see apps-script/src/tracking.ts). */
export const TRACK_CODE_RE = /^[\w-]{4,40}\.[\w-]{32}$/;

export type TrackAsk = 'cancel' | 'reschedule' | 'end';

/** One session as the client sees it. */
export type TrackSession = {
  day: string;
  time: string;
  kind: SessionKind;
  minutes: number;
  status: SessionStatus;
  /** Who cancelled or postponed it. */
  by?: 'client' | 'owner';
  /** The client asked for another time and the owner has not answered yet. */
  asked?: boolean;
  /** Less than 24 hours to go (or started): it cannot be cancelled or moved here. */
  late: boolean;
};

export type TrackView = {
  lang: 'tr' | 'en';
  type: string;
  weekday: number;
  time: string;
  /** The owner asked for a closing session. */
  closing: boolean;
  /** The client has already said they want to end therapy. */
  endAsked: boolean;
  next: TrackSession[];
};

/** Why the page could not do what was asked; the page shows its own text for each. */
export type TrackFailure = 'link' | 'late' | 'gone' | 'busy' | 'invalid';

export type TrackClient = TrackedClient & {
  type: string;
  status?: 'active' | 'closing';
  contact: { lang: 'tr' | 'en' };
  endAsked?: { at: number; note?: string };
};

export const isLate = (s: { day: string; time: string }, now: number) => slotInstant(s.day, s.time) - now < LATE_MS;

/** What the page shows: the next four sessions, without the owner's notes. */
export function trackView(c: TrackClient, now: number): TrackView {
  return {
    lang: c.contact.lang,
    type: c.type,
    weekday: c.weekday,
    time: c.time,
    closing: c.status === 'closing',
    endAsked: !!c.endAsked,
    next: pastAndNext(c, now).next.map((s) => ({
      day: s.day,
      time: s.time,
      kind: s.kind,
      minutes: s.minutes,
      status: s.status,
      ...(s.by ? { by: s.by } : {}),
      ...(s.asked ? { asked: true } : {}),
      late: isLate(s, now),
    })),
  };
}

/** The code in a link's `#k=…`, or null. */
export function codeFromHash(hash: string): string | null {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get(TRACK_PARAM);
  return code && TRACK_CODE_RE.test(code) ? code : null;
}
