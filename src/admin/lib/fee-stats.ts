/**
 * The figures on top of Ücretlendirme (owner's review 2026-10-23): what came in this month and this
 * year, what is still due, and what the next seven days bring, from the clients' sessions and their fees
 * (the client's own fee, else the fee of their session type). Free sessions (intro, closing), postponed
 * ones and cancellations in time do not count; a late cancellation does (hasFee).
 */
import type { Client } from '../api/types';
import { slotInstant } from '../../lib/booking-form';
import { feeOf, type PaymentSettings } from '../../lib/payment';
import { addDays, sessionsOf } from '../../lib/sessions';
import { hasFee } from './attention';

const istanbulDay = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);

export type Due = { clientId: string; number: string; day: string; time: string; fee: number };
export type Sum = { amount: number; count: number };
export type FeeStats = { month: Sum; year: Sum; due: Sum; next7: Sum; dueList: Due[] };

export function feeStats(clients: Client[], payment: PaymentSettings, now: number): FeeStats {
  const today = istanbulDay(now);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const until = addDays(today, 7);
  const out: FeeStats = { month: { amount: 0, count: 0 }, year: { amount: 0, count: 0 }, due: { amount: 0, count: 0 }, next7: { amount: 0, count: 0 }, dueList: [] };
  const add = (s: Sum, fee: number) => {
    s.amount += fee;
    s.count += 1;
  };
  for (const c of clients) {
    const fee = feeOf(payment, c.type, c.fee);
    for (const s of sessionsOf(c, c.since, until)) {
      if (!hasFee(s)) continue;
      if (s.paid) {
        const paidOn = istanbulDay(s.paid);
        if (paidOn.startsWith(month)) add(out.month, fee);
        if (paidOn.startsWith(year)) add(out.year, fee);
      } else if (slotInstant(s.day, s.time) <= now) {
        add(out.due, fee);
        out.dueList.push({ clientId: c.id, number: c.number, day: s.day, time: s.time, fee });
      } else if (s.status === 'planned' && s.day <= until) {
        add(out.next7, fee);
      }
    }
  }
  out.dueList.sort((a, b) => `${a.day}T${a.time}`.localeCompare(`${b.day}T${b.time}`));
  return out;
}
