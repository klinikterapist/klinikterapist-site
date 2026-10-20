/**
 * Randevu talepleri and Seans takip (owner's design 2026-10-20), in the owner's Drive:
 *   `randevular/talepler.json`   requests from the site, with the person's details, until decided:
 *                                declined or cancelled → deleted when the e-mail goes; approved →
 *                                deleted when moved to Seans takip; any → deleted after 30 days.
 *   `randevular/danisanlar.json` clients: a number (KT001OGO), a weekly session, and — only so the
 *                                owner can write to them — name, e-mail and language, plus the
 *                                request as it came (for Geri al). All of it goes when therapy ends.
 * Both files are sealed (`seal.ts`): unreadable outside this script.
 * The weekly sessions take their times in the calendar every week (`allBusy`).
 */
import type { BookingRequest, Client, ClientEnd, ManualAppointment, RequestDecision } from '../../src/admin/api/types';
import type { Gas } from './gas';
import { ApiError, badRequest } from './respond';
import { activeEntries, addConfirmed, addHold, busyOf, removeEntry } from './calendar';
import { readItems, writeItems } from './store';
import { verifyLines, verifyLink } from './verify';
import { BOOKING_LIMITS, INTRO_MINUTES, SESSION_TYPES, clientNumber, holdOf, minutesOf, overlaps, type BookingConfig, type BookingInput, type BusyInterval } from '../../src/lib/booking-form';
import { SessionError, applyChange, clientsBusy, type SessionChangeInput, type SessionRecord } from '../../src/lib/sessions';
import { DAY_RE, EMAIL_RE, TIME_RE } from '../../src/lib/field-rules';

export const REQUEST_KEEP_MS = 30 * 24 * 3600 * 1000;
const REQUESTS = 'talepler.json';
export const CLIENTS = 'danisanlar.json';
const SEQ = 'clients.seq';
const NOT_FOUND = 'Bu talep bulunamadı. Başka bir yerde karara bağlanmış ya da silinmiş olabilir.';
const NO_CLIENT = 'Bu danışan bulunamadı. Başka bir yerde takipten çıkarılmış olabilir.';
const EMPTY_MAIL = 'E-postanın konusu ve metni boş olamaz.';

/** The request as it came, kept with a client so Geri al can put it back. */
type Origin = Omit<BookingRequest, 'id' | 'createdAt' | 'status' | 'holdId' | 'calendarId'>;
/** `linkGen`: the client's page link version (tracking.ts); a new link counts it up. */
export type StoredClient = Client & { origin: Origin; requestId?: string; linkGen?: number };

const read = readItems;
const write = writeItems;

/** Requests younger than 30 days (older ones are dropped for good on every read). */
function liveRequests(gas: Gas): BookingRequest[] {
  const now = gas.now();
  const all = read<BookingRequest>(gas, REQUESTS);
  const kept = all.filter((r) => now - r.createdAt < REQUEST_KEEP_MS);
  if (kept.length !== all.length) write(gas, REQUESTS, kept);
  return kept;
}

/** Called by `booking.request` (inside its lock) after the hold is in place. */
export function saveRequest(gas: Gas, input: BookingInput, lang: 'tr' | 'en', holdId: string): BookingRequest {
  const r: BookingRequest = {
    id: gas.uuid().slice(0, 12),
    createdAt: gas.now(),
    kind: input.kind,
    ...(input.kind === 'session' ? { type: input.type } : {}),
    day: input.day,
    time: input.time,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    note: input.note.trim(),
    lang,
    ...(input.kind === 'intro' ? { forWhom: input.forWhom, topics: input.topics, before: input.before, age: input.age } : {}),
    status: 'pending',
    holdId,
    source: 'site',
  };
  write(gas, REQUESTS, [...liveRequests(gas), r]);
  return r;
}

/** The e-mail check link was opened: the request (or the client it became) has a right address. */
export function markVerified(gas: Gas, id: string): void {
  gas.withLock(() => {
    const requests = liveRequests(gas);
    if (requests.some((r) => r.id === id && !r.verified)) write(gas, REQUESTS, requests.map((r) => (r.id === id ? { ...r, verified: true } : r)));
    const clients = read<StoredClient>(gas, CLIENTS);
    if (clients.some((c) => c.requestId === id && !c.contact.verified)) {
      write(gas, CLIENTS, clients.map((c) => (c.requestId === id ? { ...c, contact: { ...c.contact, verified: true } } : c)));
    }
  });
}

/**
 * Randevu ekle: an appointment the owner gives by phone or e-mail, with the person's name and
 * e-mail. It goes into the calendar for good (a clash with a confirmed one is refused) and into
 * Randevu talepleri as approved, ready for Seans takip. With `mail`, the confirmation goes too,
 * with the e-mail check link under it.
 */
export function addManual(gas: Gas, cfg: BookingConfig, p: Record<string, unknown>): { request: BookingRequest } {
  const i = p as Partial<ManualAppointment>;
  const kind = i.kind === 'intro' ? 'intro' : 'session';
  const type = kind === 'session' ? SESSION_TYPES.find((t) => t.id === i.type)?.id : undefined;
  const name = typeof i.name === 'string' ? i.name.trim() : '';
  const email = typeof i.email === 'string' ? i.email.trim().toLowerCase() : '';
  if (kind === 'session' && !type) throw badRequest('Görüşme türünü seçin.');
  if (name.length < 2 || name.length > BOOKING_LIMITS.nameMax) throw badRequest('Ad soyad eksik.');
  if (!EMAIL_RE.test(email) || email.length > BOOKING_LIMITS.emailMax) throw badRequest('E-posta adresi hatalı görünüyor.');
  const lang = i.lang === 'en' ? 'en' : 'tr';
  return gas.withLock(() => {
    const { entry } = addConfirmed(gas, cfg, { day: i.day, time: i.time, kind, type });
    const r: BookingRequest = {
      id: gas.uuid().slice(0, 12),
      createdAt: gas.now(),
      kind,
      ...(type ? { type } : {}),
      day: String(i.day),
      time: String(i.time),
      name,
      email,
      phone: typeof i.phone === 'string' ? i.phone.trim().slice(0, BOOKING_LIMITS.phoneMax) : '',
      note: typeof i.note === 'string' ? i.note.trim().slice(0, BOOKING_LIMITS.noteMax) : '',
      lang,
      status: 'approved',
      holdId: '',
      calendarId: entry.id,
      source: 'manual',
    };
    if (i.mail) {
      const link = verifyLink(gas, `r:${r.id}`, kind === 'intro' ? 'preConsult' : 'appointment', lang);
      const body = typeof i.mail.body === 'string' ? `${i.mail.body.trimEnd()}\n\n${verifyLines(link, lang).join('\n')}` : '';
      sendMail(gas, email, { subject: i.mail.subject, body });
    }
    write(gas, REQUESTS, [...liveRequests(gas), r]);
    return { request: r };
  });
}

/** Under the lock: dropping the old requests writes the file, and a request may be coming in. */
export function listRequests(gas: Gas): { requests: BookingRequest[] } {
  return gas.withLock(() => ({ requests: liveRequests(gas).sort((a, b) => a.createdAt - b.createdAt) }));
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v : null);

/** The owner's (edited) e-mail, to the person's address only. */
export function sendMail(gas: Gas, to: string, p: Record<string, unknown>): void {
  const subject = str(p.subject, 200);
  const body = str(p.body, 5000);
  if (!subject || !body) throw badRequest(EMPTY_MAIL);
  const owner = gas.props.get('OWNER_EMAIL')?.trim() ?? '';
  gas.mail.send({ to, replyTo: owner, subject: subject.replace(/[\r\n]+/g, ' '), body, name: 'Osman Güneş Özkurt' });
}

/** A 24-hour hold for a request put back, when its time is still ahead and free. */
function holdAgain(gas: Gas, cfg: BookingConfig, o: Origin): string {
  const now = gas.now();
  const mine = holdOf(o.day, o.time, minutesOf(o.kind, o.type), cfg.restMinutes);
  if (mine.start <= now || allBusy(gas, cfg, now).some((b) => overlaps(mine, b))) return '';
  return addHold(gas, now, o.day, o.time, o.kind, o.type).id;
}

/**
 * The owner's decision. The e-mail (subject and body as the owner edited them) goes to the address
 * in the request only. Approve: the time goes into the calendar for good. Not available / cancel:
 * the hold is removed and the request with its personal data is deleted.
 */
export function decideRequest(gas: Gas, cfg: BookingConfig, p: Record<string, unknown>): Record<string, never> {
  const decision = (['approve', 'unavailable', 'cancel'] as const).find((d) => d === p.decision) as RequestDecision | undefined;
  const subject = str(p.subject, 200);
  const body = str(p.body, 5000);
  if (!decision || !subject || !body) throw badRequest(EMPTY_MAIL);
  const owner = gas.props.get('OWNER_EMAIL')?.trim() ?? '';
  // Under the lock, like every other write of the file: a request coming in from the site at the
  // same moment would otherwise be lost when this one writes the list back.
  return gas.withLock(() => {
    const requests = liveRequests(gas);
    const r = requests.find((x) => x.id === p.id);
    if (!r) throw new ApiError('not_found', NOT_FOUND);
    if (decision === 'approve' && r.status === 'approved') throw badRequest('Bu talep zaten onaylanmış.');

    let calendarId: string | undefined;
    if (decision === 'approve') {
      calendarId = addConfirmed(gas, cfg, { day: r.day, time: r.time, kind: r.kind, type: r.type }).entry.id;
    } else {
      removeEntry(gas, { id: r.calendarId ?? r.holdId });
      if (r.calendarId) removeEntry(gas, { id: r.holdId });
    }
    gas.mail.send({ to: r.email, replyTo: owner, subject: subject.replace(/[\r\n]+/g, ' '), body, name: 'Osman Güneş Özkurt' });
    write(
      gas,
      REQUESTS,
      decision === 'approve' ? requests.map((x) => (x.id === r.id ? { ...x, status: 'approved' as const, calendarId } : x)) : requests.filter((x) => x.id !== r.id),
    );
    return {};
  });
}

/**
 * Geri al on an approved request (an approval sent by mistake): the apology e-mail goes, the
 * confirmed time is freed and the request is pending again, holding its time for 24 hours.
 */
export function revertRequest(gas: Gas, cfg: BookingConfig, p: Record<string, unknown>): Record<string, never> {
  return gas.withLock(() => {
    const requests = liveRequests(gas);
    const r = requests.find((x) => x.id === p.id);
    if (!r) throw new ApiError('not_found', NOT_FOUND);
    if (r.status !== 'approved') throw badRequest('Yalnızca onaylanmış bir talep geri alınabilir.');
    sendMail(gas, r.email, p);
    if (r.calendarId) removeEntry(gas, { id: r.calendarId });
    const holdId = holdAgain(gas, cfg, r);
    write(gas, REQUESTS, requests.map((x) => (x.id === r.id ? { ...x, status: 'pending' as const, holdId, calendarId: undefined } : x)));
    return {};
  });
}

function nextNumber(gas: Gas, name: string): string {
  const n = (Number(gas.props.get(SEQ) ?? '0') || 0) + 1;
  gas.props.set(SEQ, String(n));
  return clientNumber(n, name);
}

/**
 * Moves an approved request to Seans takip. A booking keeps the weekday and time the person chose;
 * an intro call needs the weekday and time the owner sets (`weekday`, `time`, `since`). The request
 * leaves Randevu talepleri; the client is a number and a weekly slot, with the contact sealed.
 */
export function requestToClient(gas: Gas, cfg: BookingConfig, p: Record<string, unknown>): { client: Client } {
  return gas.withLock(() => {
    const requests = liveRequests(gas);
    const r = requests.find((x) => x.id === p.id);
    if (!r) throw new ApiError('not_found', NOT_FOUND);
    if (r.status !== 'approved') throw badRequest('Önce talebi onaylayın.');
    let weekday: number;
    let time: string;
    let since: string;
    let type: string;
    if (r.kind === 'session') {
      weekday = new Date(`${r.day}T12:00:00Z`).getUTCDay();
      time = r.time;
      since = r.day;
      type = r.type ?? 'individual';
    } else {
      if (typeof p.weekday !== 'number' || p.weekday < 0 || p.weekday > 6 || typeof p.time !== 'string' || !TIME_RE.test(p.time) || typeof p.since !== 'string' || !DAY_RE.test(p.since)) {
        throw badRequest('Haftalık seans günü, saati ve başlangıç tarihi gerekli.');
      }
      weekday = p.weekday;
      time = p.time;
      since = p.since;
      type = r.forWhom ?? 'individual';
    }
    const { id: _id, createdAt: _c, status: _s, holdId: _h, calendarId: _cal, ...origin } = r;
    // An intro call is where it began: it shows in the client's sessions, free and attended.
    const sessions: SessionRecord[] = r.kind === 'intro' ? [{ day: r.day, time: r.time, kind: 'intro', minutes: INTRO_MINUTES, status: 'attended' }] : [];
    const client: StoredClient = {
      id: gas.uuid().slice(0, 12),
      number: nextNumber(gas, r.name),
      type,
      weekday,
      time,
      minutes: minutesOf('session', type),
      since,
      status: 'active',
      contact: { name: r.name, email: r.email, lang: r.lang, ...(r.verified ? { verified: true } : {}) },
      sessions,
      origin,
      requestId: r.id,
    };
    // The weekly slot now holds this time; a one-off session entry at the same start would double it.
    if (r.kind === 'session' && r.calendarId) removeEntry(gas, { id: r.calendarId });
    write(gas, CLIENTS, [...read<StoredClient>(gas, CLIENTS), client]);
    write(gas, REQUESTS, requests.filter((x) => x.id !== r.id));
    return { client: publicClient(client) };
  });
}

/** What the panel sees: everything but the request as it came. */
export const publicClient = ({ origin: _o, requestId: _r, linkGen: _l, ...c }: StoredClient): Client => ({ ...c, status: c.status ?? 'active' });

export function listClients(gas: Gas): { clients: Client[] } {
  return { clients: read<StoredClient>(gas, CLIENTS).map(publicClient).sort((a, b) => a.number.localeCompare(b.number)) };
}

/**
 * Terapiyi sonlandır. `complete`: the owner's e-mail (therapy is over) goes, then the client — with
 * the contact and the request — is deleted and the weekly time is free. `closing`: the closing-
 * session e-mail goes and the client is marked; the weekly time stays. `delete`: no e-mail, deleted.
 */
export function endClient(gas: Gas, p: Record<string, unknown>): Record<string, never> {
  const mode = (['complete', 'closing', 'delete'] as const).find((m) => m === p.mode) as ClientEnd | undefined;
  if (!mode) throw badRequest('Sonlandırma türü eksik.');
  return gas.withLock(() => {
    const clients = read<StoredClient>(gas, CLIENTS);
    const c = clients.find((x) => x.id === p.id);
    if (!c) throw new ApiError('not_found', NO_CLIENT);
    if (mode !== 'delete') sendMail(gas, c.contact.email, p);
    write(gas, CLIENTS, mode === 'closing' ? clients.map((x) => (x.id === c.id ? { ...x, status: 'closing' as const } : x)) : clients.filter((x) => x.id !== c.id));
    return {};
  });
}

/**
 * Geri al on a client (moved by mistake): the apology e-mail goes, the client and the weekly time
 * go, and the request is back in Randevu talepleri as pending — holding its time again when that
 * time is still ahead and free. The number is not reused.
 */
export function revertClient(gas: Gas, cfg: BookingConfig, p: Record<string, unknown>): Record<string, never> {
  return gas.withLock(() => {
    const clients = read<StoredClient>(gas, CLIENTS);
    const c = clients.find((x) => x.id === p.id);
    if (!c) throw new ApiError('not_found', NO_CLIENT);
    sendMail(gas, c.contact.email, p);
    write(gas, CLIENTS, clients.filter((x) => x.id !== c.id));
    const holdId = holdAgain(gas, cfg, c.origin);
    const back: BookingRequest = { ...c.origin, id: gas.uuid().slice(0, 12), createdAt: gas.now(), status: 'pending', holdId };
    write(gas, REQUESTS, [...liveRequests(gas), back]);
    return {};
  });
}

/** Everything that takes time from now on: calendar entries and the clients' sessions (next 8 weeks). */
export function allBusy(gas: Gas, cfg: BookingConfig, now: number, clients: Client[] = read<StoredClient>(gas, CLIENTS)): BusyInterval[] {
  return [...busyOf(activeEntries(gas, now), cfg.restMinutes), ...clientsBusy(clients, cfg.restMinutes, now, now + 8 * 7 * 24 * 3600 * 1000)];
}

const CLASH = 'Bu saat dolu: başka bir randevu ya da seansla çakışıyor. Başka bir saat seçin.';

/**
 * Seans takip › a client's sessions (sessions.ts `applyChange`: mark, add, remove). A new time must
 * be free from now on; the session being moved frees its own time first.
 */
export function changeSession(gas: Gas, cfg: BookingConfig, p: Record<string, unknown>): { client: Client } {
  return gas.withLock(() => {
    const clients = read<StoredClient>(gas, CLIENTS);
    const c = clients.find((x) => x.id === p.id);
    if (!c) throw new ApiError('not_found', NO_CLIENT);
    let result: ReturnType<typeof applyChange>;
    try {
      result = applyChange(c, p as unknown as SessionChangeInput, INTRO_MINUTES);
    } catch (e) {
      if (e instanceof SessionError) throw badRequest(e.message);
      throw e;
    }
    const updated: StoredClient = { ...c, sessions: result.sessions };
    const { added } = result;
    if (added) {
      const now = gas.now();
      const mine = holdOf(added.day, added.time, added.minutes, cfg.restMinutes);
      const others = clients.map((x) => (x.id === c.id ? { ...updated, sessions: result.sessions.filter((s) => s !== added) } : x));
      if (mine.start > now && allBusy(gas, cfg, now, others).some((b) => overlaps(mine, b))) throw new ApiError('conflict', CLASH);
    }
    write(gas, CLIENTS, clients.map((x) => (x.id === c.id ? updated : x)));
    return { client: publicClient(updated) };
  });
}
