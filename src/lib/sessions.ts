/**
 * A client's sessions in Seans takip (owner's request 2026-10-20): the weekly session repeats from
 * `since`; the owner marks each one (attended, no-show, cancelled, postponed) and adds the free
 * ones (the closing session) or a one-off extra. A cancelled or postponed weekly session frees its
 * time in the calendar; a postponed one adds an extra session on the new date.
 * Shared by the panel and the backend.
 */
import { holdOf, slotInstant, type BusyInterval } from './booking-form';
import { DAY_RE, TIME_RE } from './field-rules';

export type SessionKind = 'weekly' | 'intro' | 'closing' | 'extra';
export type SessionStatus = 'planned' | 'attended' | 'noshow' | 'cancelled' | 'postponed';
export type SessionRecord = {
  day: string;
  time: string;
  kind: SessionKind;
  minutes: number;
  status: SessionStatus;
  /** Who asked for a cancellation or a postponement. */
  by?: 'client' | 'owner';
  note?: string;
  /** A postponed session: where it went. */
  movedTo?: { day: string; time: string };
  /** An extra session made by a postponement: the session it replaces (`YYYY-MM-DDTHH:MM`). */
  from?: string;
  /**
   * Cancelled or postponed by the client on their own page less than 24 hours before, after the page
   * told them the full fee is due (owner's review a5). It goes when the owner marks the session again.
   */
  late?: true;
  /** The owner marked it paid (epoch ms); a postponement takes the payment to the new date. */
  paid?: number;
  /** Reminders already sent for it (Faz 1): `r72`, `r48` to the client, `due` to the owner. */
  sent?: ReminderKind[];
};

export type ReminderKind = 'r72' | 'r48' | 'due';
export type TrackedClient = { weekday: number; time: string; minutes: number; since: string; sessions?: SessionRecord[] };

/** The free ones: the intro call before therapy and the closing session at its end. */
export const FREE_KINDS: SessionKind[] = ['intro', 'closing'];
/** Sessions that do not take their time any more. */
const OFF: SessionStatus[] = ['cancelled', 'postponed'];

const DAY = 24 * 3600 * 1000;
export const sessionKey = (s: { day: string; time: string }) => `${s.day}T${s.time}`;
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const istanbulDay = (ms: number) => new Date(ms + 3 * 3600 * 1000).toISOString().slice(0, 10);

/** Whether `day`/`time` is one of the client's weekly sessions. */
export const isWeekly = (c: TrackedClient, day: string, time: string) => time === c.time && day >= c.since && weekdayOf(day) === c.weekday;

/**
 * Every session from `from` to `to` (days, inclusive), soonest first: the weekly ones with their
 * marks, and the others. A record of another kind at a weekly time (a weekly session that became
 * the closing session, closing.ts) takes that week's place.
 */
export function sessionsOf(c: TrackedClient, from: string, to: string): SessionRecord[] {
  const atWeekly = (s: SessionRecord) => s.kind === 'weekly' || isWeekly(c, s.day, s.time);
  const marks = new Map((c.sessions ?? []).filter(atWeekly).map((s) => [sessionKey(s), s]));
  const out: SessionRecord[] = [];
  let d = from > c.since ? from : c.since;
  while (weekdayOf(d) !== c.weekday) d = addDays(d, 1);
  for (; d <= to; d = addDays(d, 7)) out.push(marks.get(sessionKey({ day: d, time: c.time })) ?? { day: d, time: c.time, kind: 'weekly', minutes: c.minutes, status: 'planned' });
  for (const s of c.sessions ?? []) if (!atWeekly(s) && s.day >= from && s.day <= to) out.push(s);
  return out.sort((a, b) => sessionKey(a).localeCompare(sessionKey(b)));
}

/** The last `n` sessions before `now` and the next `n` from `now` on. */
export function pastAndNext(c: TrackedClient, now: number, n = 4): { past: SessionRecord[]; next: SessionRecord[] } {
  const today = istanbulDay(now);
  const first = [c.since, ...(c.sessions ?? []).map((s) => s.day)].sort()[0];
  const all = sessionsOf(c, first < today ? first : today, addDays(today, 7 * (n + 2)));
  const started = (s: SessionRecord) => slotInstant(s.day, s.time) <= now;
  return { past: all.filter(started).slice(-n), next: all.filter((s) => !started(s)).slice(0, n) };
}

/** The times the clients' sessions take between `from` and `to` (epoch ms), rest included. */
export function clientsBusy(clients: TrackedClient[], restMinutes: number, from: number, to: number): BusyInterval[] {
  const out: BusyInterval[] = [];
  for (const c of clients) {
    for (const s of sessionsOf(c, istanbulDay(from - DAY), istanbulDay(to + DAY))) {
      if (OFF.includes(s.status)) continue;
      const hold = holdOf(s.day, s.time, s.minutes, restMinutes);
      if (hold.end > from && hold.start < to) out.push(hold);
    }
  }
  return out;
}

/** Counts of the marked sessions, for the summary line. */
export function tally(c: TrackedClient): Record<Exclude<SessionStatus, 'planned'>, number> {
  const t = { attended: 0, noshow: 0, cancelled: 0, postponed: 0 };
  for (const s of c.sessions ?? []) if (s.status !== 'planned') t[s.status]++;
  return t;
}

/** A change the owner makes on the client's page (the wire shape of `clients.session`). */
export type SessionChangeInput = {
  op: 'mark' | 'add' | 'remove' | 'pay';
  /** `pay`: paid or not, and when (the backend's clock; defaults to now). */
  paid?: boolean;
  paidAt?: number;
  day: string;
  time: string;
  status?: SessionStatus;
  by?: 'client' | 'owner';
  note?: string;
  newDay?: string;
  newTime?: string;
  kind?: 'closing' | 'extra';
};

/** A change that cannot be made; the message is for the owner. */
export class SessionError extends Error {}

const STATUSES: SessionStatus[] = ['planned', 'attended', 'noshow', 'cancelled', 'postponed'];

/**
 * The client's records after a change. `added`: a new session that takes a time (an added one, or
 * the new date of a postponement) — the caller checks that time is free.
 * `mark`: attended, no-show, cancelled or postponed, with who asked and a note; postponed with a
 * new date adds an extra session there (a free one stays free); `planned` takes the mark off.
 * `add`: the free closing session or a one-off extra. `remove`: an added session.
 */
export function applyChange(c: TrackedClient, ch: SessionChangeInput, closingMinutes: number): { sessions: SessionRecord[]; added?: SessionRecord } {
  if (!DAY_RE.test(ch.day) || !TIME_RE.test(ch.time)) throw new SessionError('Tarih ve saat eksik ya da hatalı.');
  let sessions = [...(c.sessions ?? [])];
  const key = sessionKey(ch);
  const taken = (day: string, time: string) => sessions.some((s) => sessionKey(s) === sessionKey({ day, time })) || isWeekly(c, day, time);

  if (ch.op === 'add') {
    const kind = ch.kind === 'closing' ? 'closing' : 'extra';
    if (taken(ch.day, ch.time)) throw new SessionError('Bu tarihte zaten bir seans var.');
    const added: SessionRecord = { day: ch.day, time: ch.time, kind, minutes: kind === 'closing' ? closingMinutes : c.minutes, status: 'planned' };
    return { sessions: [...sessions, added], added };
  }
  if (ch.op === 'remove') {
    const s = sessions.find((x) => sessionKey(x) === key && x.kind !== 'weekly');
    if (!s) throw new SessionError('Yalnızca sonradan eklenen bir seans silinebilir.');
    sessions = sessions.filter((x) => x !== s);
    if (s.from) sessions = sessions.map((x) => (sessionKey(x) === s.from && x.status === 'postponed' ? { ...x, movedTo: undefined } : x));
    return { sessions };
  }
  if (ch.op === 'pay') {
    const old = sessions.find((x) => sessionKey(x) === key);
    if (!old && !isWeekly(c, ch.day, ch.time)) throw new SessionError('Bu tarihte bir seans yok.');
    const base: SessionRecord = old ?? { day: ch.day, time: ch.time, kind: 'weekly', minutes: c.minutes, status: 'planned' };
    if (FREE_KINDS.includes(base.kind)) throw new SessionError('Ücretsiz görüşmenin ödemesi olmaz.');
    const next: SessionRecord = { ...base };
    if (ch.paid) next.paid = ch.paidAt ?? Date.now();
    else delete next.paid;
    return { sessions: [...sessions.filter((x) => x !== old), next] };
  }
  if (ch.op !== 'mark') throw new SessionError('İşlem anlaşılamadı.');
  const status = STATUSES.find((st) => st === ch.status);
  if (!status) throw new SessionError('Durum eksik.');
  const old = sessions.find((x) => sessionKey(x) === key);
  if (!old && !isWeekly(c, ch.day, ch.time)) throw new SessionError('Bu tarihte bir seans yok.');
  const base: SessionRecord = old ?? { day: ch.day, time: ch.time, kind: 'weekly', minutes: c.minutes, status: 'planned' };
  // A postponement made earlier and now changed: its extra session goes.
  if (old?.movedTo) sessions = sessions.filter((x) => x.from !== key);
  sessions = sessions.filter((x) => x !== old);
  const asked = status === 'cancelled' || status === 'postponed';
  const note = ch.note?.trim() ? ch.note.trim().slice(0, 300) : undefined;
  const next: SessionRecord = { ...base, status, by: asked && (ch.by === 'client' || ch.by === 'owner') ? ch.by : undefined, note, movedTo: undefined };
  if (!next.by) delete next.by;
  if (!next.note) delete next.note;
  delete next.movedTo;
  // A mark made again by the owner is not the client's late one any more.
  delete next.late;
  if (status === 'postponed' && ch.newDay && ch.newTime) {
    if (!DAY_RE.test(ch.newDay) || !TIME_RE.test(ch.newTime)) throw new SessionError('Yeni tarih ya da saat hatalı.');
    if (taken(ch.newDay, ch.newTime)) throw new SessionError('Yeni tarihte zaten bir seans var.');
    next.movedTo = { day: ch.newDay, time: ch.newTime };
    const added: SessionRecord = { day: ch.newDay, time: ch.newTime, kind: base.kind === 'weekly' ? 'extra' : base.kind, minutes: base.minutes, status: 'planned', from: key };
    // A payment made for the session goes with it to the new date (and is not counted twice).
    if (next.paid) {
      added.paid = next.paid;
      delete next.paid;
    }
    return { sessions: [...sessions, next, added], added };
  }
  // An unmarked weekly session needs no record, unless it holds a payment or sent reminders.
  if (base.kind === 'weekly' && status === 'planned' && !note && !next.paid && !next.sent?.length) return { sessions };
  return { sessions: [...sessions, next] };
}

/** The client's sessions with `kind` noted as sent for the session at `day`/`time` (a weekly one gets a record). */
export function markSent(c: TrackedClient, day: string, time: string, kind: ReminderKind): SessionRecord[] {
  const key = sessionKey({ day, time });
  const sessions = c.sessions ?? [];
  const old = sessions.find((x) => sessionKey(x) === key);
  const base: SessionRecord = old ?? { day, time, kind: 'weekly', minutes: c.minutes, status: 'planned' };
  const next: SessionRecord = { ...base, sent: [...new Set([...(base.sent ?? []), kind])] };
  return [...sessions.filter((x) => x !== old), next];
}

export type SessionStats = {
  /** Paid sessions so far that took place or were due (attended, no-show, not marked yet). */
  held: number;
  /** Shares of the past paid sessions, cancelled and postponed included (they add up to `total`). */
  attended: number;
  noshow: number;
  cancelled: number;
  postponed: number;
  unmarked: number;
  total: number;
  /** Free sessions so far (intro call, closing session). */
  free: number;
};

const countsAsSession = (s: SessionRecord) => !FREE_KINDS.includes(s.kind) && !OFF.includes(s.status);

/**
 * The client's running count since therapy began (owner's review 2026-10-20: the page shows four
 * sessions each way, but the counter goes on): every past session counted, not only those shown.
 */
export function sessionStats(c: TrackedClient, now: number): SessionStats {
  const today = istanbulDay(now);
  const first = [c.since, ...(c.sessions ?? []).map((s) => s.day)].sort()[0];
  const past = sessionsOf(c, first < today ? first : today, today).filter((s) => slotInstant(s.day, s.time) <= now);
  const t: SessionStats = { held: 0, attended: 0, noshow: 0, cancelled: 0, postponed: 0, unmarked: 0, total: 0, free: 0 };
  for (const s of past) {
    if (FREE_KINDS.includes(s.kind)) {
      if (!OFF.includes(s.status)) t.free++;
      continue;
    }
    t.total++;
    if (s.status === 'planned') t.unmarked++;
    else t[s.status]++;
    if (countsAsSession(s)) t.held++;
  }
  return t;
}

/** Each paid session's number since therapy began ("7. seans"), by `sessionKey`; cancelled, postponed and free ones have none. */
export function sessionNumbers(c: TrackedClient, upTo: string): Map<string, number> {
  const first = [c.since, ...(c.sessions ?? []).map((s) => s.day)].sort()[0];
  const out = new Map<string, number>();
  let n = 0;
  for (const s of sessionsOf(c, first, upTo)) if (countsAsSession(s)) out.set(sessionKey(s), ++n);
  return out;
}
