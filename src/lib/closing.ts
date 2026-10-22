/**
 * The closing session's invitation (owner's decisions 2026-10-22): "Sonlandırma görüşmesi talep et"
 * gives the client until the end of the third day after it (Turkey time) to pick a day and time for
 * the free closing session on their own page, from the free times of the intro-call calendar. A day
 * before that, the client gets a reminder and the owner a note. If no time was picked by then, the
 * client's next planned session at least 24 hours ahead becomes the closing session: free, 30
 * minutes from the session's time (the rest of its time is free again); both get an e-mail.
 * Any closing session the client picks or the owner adds ends the wait.
 * Shared by the panel, the page and the backend.
 */
import { INTRO_MINUTES, slotInstant } from './booking-form';
import { FREE_KINDS, addDays, isWeekly, sessionKey, sessionsOf, type SessionRecord, type TrackedClient } from './sessions';

/** Days the client has to pick a time; the last one ends at midnight, Turkey time. */
export const CLOSING_PICK_DAYS = 3;
/** The reminder goes this long before the end. */
export const CLOSING_REMIND_MS = 24 * 3600 * 1000;
/** The session that becomes the closing session starts at least this long after the end. */
export const CLOSING_NOTICE_MS = 24 * 3600 * 1000;
/** How long the closing session takes (as the intro call). */
export const CLOSING_MINUTES = INTRO_MINUTES;

/** Kept on the client from the invitation on. */
export type ClosingAsk = {
  /** When the invitation went (epoch ms). */
  at: number;
  /** The end of the time to pick (epoch ms). */
  until: number;
  /** The reminder went. */
  reminded?: true;
  /** The wait is over (a time was picked, a session became the closing session, or none could). */
  done?: number;
  /** The session that became the closing session on its own. */
  auto?: { day: string; time: string };
};

export type ClosingClient = TrackedClient & { status?: 'active' | 'closing'; closingAsk?: ClosingAsk };

const istanbulDay = (ms: number) => new Date(ms + 3 * 3600 * 1000).toISOString().slice(0, 10);

/** The last day to pick (`YYYY-MM-DD`) and its end (epoch ms), for an invitation sent at `now`. */
export function closingDeadline(now: number): { day: string; until: number } {
  const day = addDays(istanbulDay(now), CLOSING_PICK_DAYS);
  return { day, until: slotInstant(addDays(day, 1), '00:00') };
}

/** The last day to pick, from the stored end. */
export const closingDay = (ask: ClosingAsk) => istanbulDay(ask.until - 1);

/** A closing session from the invitation on that still counts (not cancelled or postponed). */
export function closingSession(c: ClosingClient): SessionRecord | undefined {
  const from = c.closingAsk ? istanbulDay(c.closingAsk.at) : '';
  return (c.sessions ?? []).find((s) => s.kind === 'closing' && s.day >= from && s.status !== 'cancelled' && s.status !== 'postponed');
}

/** Whether the client may still pick a time on their page. */
export function canPickClosing(c: ClosingClient, now: number): boolean {
  const a = c.closingAsk;
  return c.status === 'closing' && !!a && !a.done && now < a.until && !closingSession(c);
}

/** The session that becomes the closing session if no time is picked: the next planned paid one at least a day after `after`. */
export function closingTarget(c: ClosingClient, after: number): SessionRecord | undefined {
  const from = after + CLOSING_NOTICE_MS;
  return sessionsOf(c, istanbulDay(from), addDays(istanbulDay(from), 8 * 7)).find(
    (s) => s.status === 'planned' && !FREE_KINDS.includes(s.kind) && slotInstant(s.day, s.time) >= from,
  );
}

/** What the hourly task does for this client now. */
export function closingStep(c: ClosingClient, now: number): 'none' | 'remind' | 'convert' | 'settle' {
  const a = c.closingAsk;
  if (c.status !== 'closing' || !a || a.done) return 'none';
  // Picked on the page or added by the owner: nothing more to wait for.
  if (closingSession(c)) return 'settle';
  if (now >= a.until) return 'convert';
  if (!a.reminded && now >= a.until - CLOSING_REMIND_MS) return 'remind';
  return 'none';
}

/**
 * The client's sessions with `target` as the closing session: free, 30 minutes, at the same time.
 * A weekly one gets a record of its own in its place; reminders sent and a payment made stay noted.
 */
export function convertToClosing(c: ClosingClient, target: { day: string; time: string }): SessionRecord[] {
  const key = sessionKey(target);
  const sessions = c.sessions ?? [];
  const old = sessions.find((s) => sessionKey(s) === key);
  if (!old && !isWeekly(c, target.day, target.time)) throw new Error('No session at this time.');
  const base: SessionRecord = old ?? { day: target.day, time: target.time, kind: 'weekly', minutes: c.minutes, status: 'planned' };
  // A payment made for it stays noted, so the owner sees it.
  const next: SessionRecord = { ...base, kind: 'closing', minutes: CLOSING_MINUTES };
  return [...sessions.filter((s) => s !== old), next];
}

export type ClosingState =
  | { step: 'none' }
  | { step: 'wait'; lastDay: string; target?: SessionRecord }
  | { step: 'planned' | 'auto'; session: SessionRecord };

/** Where the closing session stands, for the panel: waiting for the client's pick, planned (picked or added), or made from a session. */
export function closingState(c: ClosingClient, now: number): ClosingState {
  const a = c.closingAsk;
  const session = closingSession(c);
  if (session) return { step: a?.auto && sessionKey(a.auto) === sessionKey(session) ? 'auto' : 'planned', session };
  if (c.status !== 'closing' || !a || a.done) return { step: 'none' };
  const target = closingTarget(c, Math.max(a.until, now));
  return { step: 'wait', lastDay: closingDay(a), ...(target ? { target } : {}) };
}
