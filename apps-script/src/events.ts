/**
 * Bildirimler (owner's decision 2026-10-20, Faz 2): what happened, in one stream for the panel —
 * a request came, a decision, a client moved to Seans takip, a client cancelled or moved a session,
 * a payment, an unpaid session at its due time, a hold running out, someone on the "Haber et" list,
 * an information request. Little personal data: initials or the client number, never an e-mail
 * address. Sealed in the owner's Drive (`randevular/olaylar.json`), kept 90 days, at most 500.
 * Writing it never stops what it records: a failure is only logged.
 */
import type { PanelEvent, PanelEventKind } from '../../src/admin/api/types';
import type { Gas } from './gas';
import { readItems, writeItems } from './store';
import { formatDay } from '../../src/lib/booking-form';

const FILE = 'olaylar.json';
const KEEP_MS = 90 * 24 * 3600 * 1000;
const MAX = 500;

/** "Ayşe Yılmaz" → "A. Y." */
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0].toLocaleUpperCase('tr-TR')}.`)
    .join(' ');

/** "22 Ekim, 19.20" */
export const shortWhen = (s: { day: string; time: string }) => `${formatDay(s.day, 'tr').split(', ')[0].replace(/ \d{4}$/, '')}, ${s.time.replace(':', '.')}`;

export function logEvent(gas: Gas, kind: PanelEventKind, text: string, link?: string): void {
  try {
    gas.withLock(() => {
      const now = gas.now();
      const kept = readItems<PanelEvent>(gas, FILE).filter((e) => now - e.at < KEEP_MS);
      const e: PanelEvent = { id: gas.uuid().slice(0, 10), at: now, kind, text: text.replace(/[\r\n\t]+/g, ' ').slice(0, 200), ...(link ? { link } : {}) };
      writeItems(gas, FILE, [...kept, e].slice(-MAX));
    });
  } catch (err) {
    gas.log(`events: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** `events.list` (panel): newest first. */
export function listEvents(gas: Gas): { events: PanelEvent[] } {
  const now = gas.now();
  // Reversed first: of two at the same moment, the one written later comes first.
  return { events: readItems<PanelEvent>(gas, FILE).filter((e) => now - e.at < KEEP_MS).reverse().sort((a, b) => b.at - a.at) };
}
