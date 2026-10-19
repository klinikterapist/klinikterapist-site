/**
 * Talepler and Randevu takibi (owner's design 2026-10-20), in the owner's Drive:
 *   `randevular/talepler.json`   requests from the site, with the person's details, until decided:
 *                                declined or cancelled → deleted when the e-mail goes; approved →
 *                                deleted when moved to Randevu takibi; any → deleted after 30 days.
 *   `randevular/danisanlar.json` clients: a number (D-001…) and a weekly session, no names.
 * The weekly sessions take their times in the calendar every week (`clientBusy`).
 */
import type { BookingRequest, Client, RequestDecision } from '../../src/admin/api/types';
import type { FolderLike, Gas } from './gas';
import { ApiError, badRequest } from './respond';
import { activeEntries, addConfirmed, busyOf, removeEntry } from './calendar';
import { minutesOf, weeklyBusy, type BookingConfig, type BookingInput, type BusyInterval } from '../../src/lib/booking-form';

export const REQUEST_KEEP_MS = 30 * 24 * 3600 * 1000;
const FOLDER = 'randevular';
const REQUESTS = 'talepler.json';
const CLIENTS = 'danisanlar.json';
const SEQ = 'clients.seq';
const NOT_FOUND = 'Bu talep bulunamadı. Başka bir yerde karara bağlanmış ya da silinmiş olabilir.';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function folder(gas: Gas): FolderLike {
  const root = gas.drive.rootFolder();
  return root.findFolder(FOLDER) ?? root.createFolder(FOLDER);
}

function read<T>(gas: Gas, name: string): T[] {
  const file = gas.drive.rootFolder().findFolder(FOLDER)?.findFile(name);
  if (!file) return [];
  try {
    const v = JSON.parse(file.read()) as { items?: T[] };
    return Array.isArray(v.items) ? v.items : [];
  } catch {
    return [];
  }
}

function write<T>(gas: Gas, name: string, items: T[]): void {
  const f = folder(gas);
  const text = JSON.stringify({ items });
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

/**
 * The owner's decision. The e-mail (subject and body as the owner edited them) goes to the address
 * in the request only. Approve: the time goes into the calendar for good. Not available / cancel:
 * the hold is removed and the request with its personal data is deleted.
 */
export function decideRequest(gas: Gas, cfg: BookingConfig, p: Record<string, unknown>): Record<string, never> {
  const decision = (['approve', 'unavailable', 'cancel'] as const).find((d) => d === p.decision) as RequestDecision | undefined;
  const subject = str(p.subject, 200);
  const body = str(p.body, 5000);
  if (!decision || !subject || !body) throw badRequest('E-postanın konusu ve metni boş olamaz.');
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

function nextNumber(gas: Gas): string {
  const n = (Number(gas.props.get(SEQ) ?? '0') || 0) + 1;
  gas.props.set(SEQ, String(n));
  return `D-${String(n).padStart(3, '0')}`;
}

/**
 * Moves an approved request to Randevu takibi. A booking keeps the weekday and time the person
 * chose; an intro call needs the weekday and time the owner sets (`weekday`, `time`, `since`). The
 * request — name, e-mail, phone, note, topics — is deleted; the client is a number and a weekly slot.
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
    const client: Client = { id: gas.uuid().slice(0, 12), number: nextNumber(gas), type, weekday, time, minutes: minutesOf('session', type), since };
    // The weekly slot now holds this time; a one-off session entry at the same start would double it.
    if (r.kind === 'session' && r.calendarId) removeEntry(gas, { id: r.calendarId });
    write(gas, CLIENTS, [...read<Client>(gas, CLIENTS), client]);
    write(gas, REQUESTS, requests.filter((x) => x.id !== r.id));
    return { client };
  });
}

export function listClients(gas: Gas): { clients: Client[] } {
  return { clients: read<Client>(gas, CLIENTS).sort((a, b) => a.number.localeCompare(b.number)) };
}

export function endClient(gas: Gas, p: Record<string, unknown>): Record<string, never> {
  gas.withLock(() => write(gas, CLIENTS, read<Client>(gas, CLIENTS).filter((c) => c.id !== p.id)));
  return {};
}

/** Everything that takes time from now on: calendar entries and the weekly sessions (next 8 weeks). */
export function allBusy(gas: Gas, cfg: BookingConfig, now: number): BusyInterval[] {
  return [...busyOf(activeEntries(gas, now), cfg.restMinutes), ...weeklyBusy(read<Client>(gas, CLIENTS), cfg.restMinutes, now, now + 8 * 7 * 24 * 3600 * 1000)];
}
