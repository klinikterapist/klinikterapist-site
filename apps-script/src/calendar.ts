/**
 * The booking calendar: which times are taken. One small file in the owner's Drive
 * (`Klinikterapist Panel/randevular/takvim.json`) with times, lengths and kinds only — no names, no
 * e-mail, no phone. Two sorts of entry:
 *   - `hold`: a request just came in; the time looks taken for 24 hours (owner's decision 2026-10-20)
 *     and frees itself unless the owner confirms it;
 *   - `confirmed`: the owner put it in the calendar (from the request e-mail or by hand).
 * A taken time holds the appointment's length plus the rest (booking.json `restMinutes`).
 */
import type { CalendarEntry } from '../../src/admin/api/types';
import type { Gas, FolderLike } from './gas';
import { ApiError, badRequest } from './respond';
import { holdOf, minutesOf, overlaps, slotInstant, type BookingConfig, type BookingKind, type BusyInterval } from '../../src/lib/booking-form';

export type { CalendarEntry };

export const HOLD_MS = 24 * 3600 * 1000;
const FOLDER = 'randevular';
const FILE = 'takvim.json';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const OVERLAP = 'Bu saat onaylı başka bir randevuyla çakışıyor. Önce o randevuyu silin ya da başka bir saat seçin.';

function folder(gas: Gas, create: boolean): FolderLike | null {
  const root = gas.drive.rootFolder();
  return root.findFolder(FOLDER) ?? (create ? root.createFolder(FOLDER) : null);
}

function readAll(gas: Gas): CalendarEntry[] {
  const file = folder(gas, false)?.findFile(FILE);
  if (!file) return [];
  try {
    const v = JSON.parse(file.read()) as { entries?: CalendarEntry[] };
    return Array.isArray(v.entries) ? v.entries : [];
  } catch {
    return [];
  }
}

function writeAll(gas: Gas, entries: CalendarEntry[]): void {
  const f = folder(gas, true)!;
  const text = JSON.stringify({ entries });
  const file = f.findFile(FILE);
  if (file) file.write(text);
  else f.createFile(FILE, text, 'json');
}

/** Entries still in force: not over yet, and holds not expired. */
export function activeEntries(gas: Gas, now: number): CalendarEntry[] {
  return readAll(gas).filter((e) => e.start + e.minutes * 60 * 1000 > now && (e.status === 'confirmed' || (e.holdUntil ?? 0) > now));
}

export const busyOf = (entries: CalendarEntry[], restMinutes: number): BusyInterval[] =>
  entries.map((e) => ({ start: e.start, end: e.start + (e.minutes + restMinutes) * 60 * 1000 }));

const intervalOf = (e: CalendarEntry, rest: number): BusyInterval => ({ start: e.start, end: e.start + (e.minutes + rest) * 60 * 1000 });

/** Adds a 24-hour hold for a request. Call inside the lock, after checking the time is free. */
export function addHold(gas: Gas, now: number, day: string, time: string, kind: BookingKind, type?: string): CalendarEntry {
  const entry: CalendarEntry = { id: gas.uuid().slice(0, 8), start: slotInstant(day, time), minutes: minutesOf(kind, type), kind, ...(type ? { type } : {}), status: 'hold', holdUntil: now + HOLD_MS };
  writeAll(gas, [...activeEntries(gas, now), entry]);
  return entry;
}

/** Owner: puts an appointment in the calendar. A hold at the same start becomes it; other holds in its way give way. */
export function addConfirmed(gas: Gas, cfg: BookingConfig, p: Record<string, unknown>): { entry: CalendarEntry } {
  const day = typeof p.day === 'string' && DAY_RE.test(p.day) ? p.day : null;
  const time = typeof p.time === 'string' && TIME_RE.test(p.time) ? p.time : null;
  const kind: BookingKind = p.kind === 'intro' ? 'intro' : 'session';
  const type = kind === 'session' && typeof p.type === 'string' ? p.type : undefined;
  if (!day || !time) throw badRequest('Tarih ve saat eksik ya da hatalı.');
  const minutes = minutesOf(kind, type);
  const mine = holdOf(day, time, minutes, cfg.restMinutes);
  return gas.withLock(() => {
    const now = gas.now();
    const entries = activeEntries(gas, now);
    if (entries.some((e) => e.status === 'confirmed' && overlaps(mine, intervalOf(e, cfg.restMinutes)))) throw new ApiError('conflict', OVERLAP);
    const entry: CalendarEntry = { id: gas.uuid().slice(0, 8), start: mine.start, minutes, kind, ...(type ? { type } : {}), status: 'confirmed' };
    writeAll(gas, [...entries.filter((e) => !(e.status === 'hold' && overlaps(mine, intervalOf(e, cfg.restMinutes)))), entry]);
    return { entry };
  });
}

/** Owner: removes an appointment or a hold (a cancellation frees the time at once). */
export function removeEntry(gas: Gas, p: Record<string, unknown>): Record<string, never> {
  const id = typeof p.id === 'string' ? p.id : '';
  gas.withLock(() => writeAll(gas, activeEntries(gas, gas.now()).filter((e) => e.id !== id)));
  return {};
}

/** Owner: the calendar, soonest first. */
export function listEntries(gas: Gas): { entries: CalendarEntry[] } {
  return { entries: activeEntries(gas, gas.now()).sort((a, b) => a.start - b.start) };
}
