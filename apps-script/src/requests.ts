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
import type { BookingRequest, Client, ClientEnd, RequestDecision } from '../../src/admin/api/types';
import type { FolderLike, Gas } from './gas';
import { ApiError, badRequest } from './respond';
import { activeEntries, addConfirmed, addHold, busyOf, removeEntry } from './calendar';
import { seal, unseal } from './seal';
import { clientNumber, holdOf, minutesOf, overlaps, weeklyBusy, type BookingConfig, type BookingInput, type BusyInterval } from '../../src/lib/booking-form';

export const REQUEST_KEEP_MS = 30 * 24 * 3600 * 1000;
const FOLDER = 'randevular';
const REQUESTS = 'talepler.json';
const CLIENTS = 'danisanlar.json';
const SEQ = 'clients.seq';
const NOT_FOUND = 'Bu talep bulunamadı. Başka bir yerde karara bağlanmış ya da silinmiş olabilir.';
const NO_CLIENT = 'Bu danışan bulunamadı. Başka bir yerde takipten çıkarılmış olabilir.';
const EMPTY_MAIL = 'E-postanın konusu ve metni boş olamaz.';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function folder(gas: Gas): FolderLike {
  const root = gas.drive.rootFolder();
  return root.findFolder(FOLDER) ?? root.createFolder(FOLDER);
}

/** The request as it came, kept with a client so Geri al can put it back. */
type Origin = Omit<BookingRequest, 'id' | 'createdAt' | 'status' | 'holdId' | 'calendarId'>;
type StoredClient = Client & { origin: Origin };

function read<T>(gas: Gas, name: string): T[] {
  const file = gas.drive.rootFolder().findFolder(FOLDER)?.findFile(name);
  if (!file) return [];
  let v: { items?: T[]; sealed?: string };
  try {
    v = JSON.parse(file.read()) as typeof v;
  } catch {
    return [];
  }
  if (typeof v.sealed === 'string') {
    const text = unseal(gas, v.sealed);
    // Never treat an unreadable file as empty: the next write would wipe it.
    if (text === null) throw new ApiError('internal', 'Randevu dosyası açılamadı (şifre anahtarı uyuşmuyor). Dosyaya dokunmadan destek isteyin.');
    v = JSON.parse(text) as typeof v;
  }
  return Array.isArray(v.items) ? v.items : [];
}

function write<T>(gas: Gas, name: string, items: T[]): void {
  const f = folder(gas);
  const text = JSON.stringify({ sealed: seal(gas, JSON.stringify({ items })) });
  const file = f.findFile(name);
  if (file) file.write(text);
  else f.createFile(name, text, 'json');
}

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
  };
  write(gas, REQUESTS, [...liveRequests(gas), r]);
  return r;
}

export function listRequests(gas: Gas): { requests: BookingRequest[] } {
  return { requests: liveRequests(gas).sort((a, b) => a.createdAt - b.createdAt) };
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v : null);

/** The owner's (edited) e-mail, to the person's address only. */
function sendMail(gas: Gas, to: string, p: Record<string, unknown>): void {
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
    const client: StoredClient = {
      id: gas.uuid().slice(0, 12),
      number: nextNumber(gas, r.name),
      type,
      weekday,
      time,
      minutes: minutesOf('session', type),
      since,
      status: 'active',
      contact: { name: r.name, email: r.email, lang: r.lang },
      origin,
    };
    // The weekly slot now holds this time; a one-off session entry at the same start would double it.
    if (r.kind === 'session' && r.calendarId) removeEntry(gas, { id: r.calendarId });
    write(gas, CLIENTS, [...read<StoredClient>(gas, CLIENTS), client]);
    write(gas, REQUESTS, requests.filter((x) => x.id !== r.id));
    return { client: publicClient(client) };
  });
}

/** What the panel sees: everything but the request as it came. */
const publicClient = ({ origin: _o, ...c }: StoredClient): Client => ({ ...c, status: c.status ?? 'active' });

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

/** Everything that takes time from now on: calendar entries and the weekly sessions (next 8 weeks). */
export function allBusy(gas: Gas, cfg: BookingConfig, now: number): BusyInterval[] {
  return [...busyOf(activeEntries(gas, now), cfg.restMinutes), ...weeklyBusy(read<StoredClient>(gas, CLIENTS), cfg.restMinutes, now, now + 8 * 7 * 24 * 3600 * 1000)];
}
