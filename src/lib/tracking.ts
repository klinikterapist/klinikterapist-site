/**
 * The client's own page (owner's decisions 2026-10-20, review a5): a secret link per client, sent
 * from the panel, opens `/randevum/` (`/en/my-appointment/`) with the code after `#`, so it never
 * reaches a server log or a referrer. The page shows what the owner sees of the therapy — the
 * weekly session, the session type, when therapy began and the chart of the sessions so far — and
 * the next sessions, with no name, no e-mail and no notes. The client can cancel a session, move it
 * to a free time of the booking calendar, or say they want to end therapy. Less than 24 hours before
 * a session, the page first says the full fee is due and that this is the client's responsibility.
 * Each goes to the owner by e-mail and is written on the client's sessions in Seans takip.
 * Shared by the site page and the backend.
 */
import { holdOf, slotInstant, timesFor, overlaps, type BookingConfig, type BusyInterval } from './booking-form';
import { clientsBusy, pastAndNext, sessionKey, sessionStats, type SessionKind, type SessionRecord, type SessionStats, type SessionStatus, type TrackedClient } from './sessions';

export const TRACK_PATH = { tr: '/randevum/', en: '/en/my-appointment/' } as const;
/** The code's name after `#` in the link. */
export const TRACK_PARAM = 'k';
/** Closer than this to a session, the full fee is due for a cancellation or a postponement. */
export const LATE_MS = 24 * 3600 * 1000;
/** Longest note the client may add (why they cancel, why they want to end). */
export const TRACK_NOTE_MAX = 300;

/** `<client id>.<signature>` (see apps-script/src/tracking.ts). */
export const TRACK_CODE_RE = /^[\w-]{4,40}\.[\w-]{32}$/;

export type TrackAsk = 'cancel' | 'postpone' | 'end';

/** One session as the client sees it. */
export type TrackSession = {
  day: string;
  time: string;
  kind: SessionKind;
  minutes: number;
  status: SessionStatus;
  /** Who cancelled or postponed it. */
  by?: 'client' | 'owner';
  /** A postponed session: its new date. */
  movedTo?: { day: string; time: string };
  /** Less than 24 hours to go: a change costs the full fee (the page warns first). */
  late: boolean;
};

export type TrackView = {
  lang: 'tr' | 'en';
  type: string;
  weekday: number;
  time: string;
  minutes: number;
  since: string;
  /** The owner asked for a closing session. */
  closing: boolean;
  /** The client has already said they want to end therapy. */
  endAsked: boolean;
  stats: SessionStats;
  next: TrackSession[];
  /** Times taken by others from now on (rest included), for the free times of a postponement. */
  busy: BusyInterval[];
};

/** Why the page could not do what was asked; the page shows its own text for each. */
export type TrackFailure = 'link' | 'late' | 'gone' | 'taken' | 'busy' | 'invalid';

export type TrackClient = TrackedClient & {
  type: string;
  status?: 'active' | 'closing';
  contact: { lang: 'tr' | 'en' };
  endAsked?: { at: number; note?: string };
};

export const isLate = (s: { day: string; time: string }, now: number) => slotInstant(s.day, s.time) - now < LATE_MS;

/** What the page shows. `busy`: the others' times (the backend leaves this client's own out). */
export function trackView(c: TrackClient, now: number, busy: BusyInterval[] = []): TrackView {
  return {
    lang: c.contact.lang,
    type: c.type,
    weekday: c.weekday,
    time: c.time,
    minutes: c.minutes,
    since: c.since,
    closing: c.status === 'closing',
    endAsked: !!c.endAsked,
    stats: sessionStats(c, now),
    next: pastAndNext(c, now).next.map((s) => ({
      day: s.day,
      time: s.time,
      kind: s.kind,
      minutes: s.minutes,
      status: s.status,
      ...(s.by ? { by: s.by } : {}),
      ...(s.movedTo ? { movedTo: s.movedTo } : {}),
      late: isLate(s, now),
    })),
    busy,
  };
}

/**
 * Where a session can move: the booking calendar's session times from now on (working hours,
 * holidays, notice, weeks ahead), minus the times others take and the client's own other sessions.
 */
export function freeTimes(cfg: BookingConfig, v: Pick<TrackView, 'weekday' | 'time' | 'minutes' | 'since' | 'next' | 'busy'>, moving: { day: string; time: string }, day: string, now: number): string[] {
  const own: TrackedClient = {
    weekday: v.weekday,
    time: v.time,
    minutes: v.minutes,
    since: v.since,
    sessions: v.next.map((s): SessionRecord => ({ day: s.day, time: s.time, kind: s.kind, minutes: s.minutes, status: sessionKey(s) === sessionKey(moving) ? 'postponed' : s.status })),
  };
  const taken = [...v.busy, ...clientsBusy([own], cfg.restMinutes, now, now + (cfg.session.weeksAhead + 1) * 7 * 24 * 3600 * 1000)];
  return timesFor(cfg, 'session', day, now).filter((t) => !(day === moving.day && t === moving.time) && !taken.some((b) => overlaps(holdOf(day, t, v.minutes, cfg.restMinutes), b)));
}

/** The code in a link's `#k=…`, or null. */
export function codeFromHash(hash: string): string | null {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get(TRACK_PARAM);
  return code && TRACK_CODE_RE.test(code) ? code : null;
}
