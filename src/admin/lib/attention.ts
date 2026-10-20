/**
 * What needs the owner's attention (Faz 2: Bildirimler and Terapist profili), worked out in the
 * panel from the clients and the requests, so it is always current:
 * - sessions with a fee that took place (or were cancelled late) and are not marked paid;
 * - past sessions not marked yet;
 * - inactive clients: no session marked attended or missed for 45 days (owner's suggestion accepted);
 * - clients who said on their page that they want to end therapy;
 * - requests waiting 20 hours or more (the 24-hour hold is running out).
 */
import type { BookingRequest, Client } from '../api/types';
import { slotInstant } from '../../lib/booking-form';
import { FREE_KINDS, sessionsOf, type SessionRecord } from '../../lib/sessions';

export const INACTIVE_DAYS = 45;
const DAY = 24 * 3600e3;
const istanbulDay = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);

/** A session with a fee: not free, not postponed (its payment went with it); a late cancellation keeps its fee. */
export const hasFee = (s: SessionRecord) => !FREE_KINDS.includes(s.kind) && s.status !== 'postponed' && (s.status !== 'cancelled' || !!s.late);

export type Attention = { key: string; tone: 'err' | 'warn'; text: string; link: string };

/** Every session of a client from therapy's start to `now`. */
function pastSessions(c: Client, now: number): SessionRecord[] {
  const first = [c.since, ...(c.sessions ?? []).map((s) => s.day)].sort()[0];
  return sessionsOf(c, first, istanbulDay(now)).filter((s) => slotInstant(s.day, s.time) <= now);
}

export function attentionOf(clients: Client[], requests: BookingRequest[], now: number): Attention[] {
  const out: Attention[] = [];
  for (const c of clients) {
    const link = `#/seans-takip/${c.id}`;
    const past = pastSessions(c, now);
    const unpaid = past.filter((s) => hasFee(s) && s.status !== 'planned' && !s.paid);
    if (unpaid.length) out.push({ key: `unpaid-${c.id}`, tone: 'err', text: `${c.number}: ${unpaid.length} seansın ödemesi işaretlenmedi`, link });
    const unmarked = past.filter((s) => s.status === 'planned' && s.kind !== 'intro');
    if (unmarked.length) out.push({ key: `unmarked-${c.id}`, tone: 'warn', text: `${c.number}: ${unmarked.length} geçmiş seans işaretlenmeyi bekliyor`, link });
    if (c.endAsked) out.push({ key: `end-${c.id}`, tone: 'warn', text: `${c.number} terapiyi sonlandırmak istiyor`, link });
    const lastMarked = past.filter((s) => s.status === 'attended' || s.status === 'noshow').map((s) => slotInstant(s.day, s.time));
    const since = Math.max(slotInstant(c.since, c.time), ...lastMarked);
    if (now - since > INACTIVE_DAYS * DAY) out.push({ key: `idle-${c.id}`, tone: 'warn', text: `${c.number}: ${INACTIVE_DAYS} günden uzun süredir katıldı ya da gelmedi diye işaretlenen seans yok. Terapisi sürüyor mu?`, link });
  }
  for (const r of requests) {
    if (r.status === 'pending' && now - r.createdAt >= 20 * 3600e3) {
      out.push({ key: `hold-${r.id}`, tone: 'err', text: `${r.name}: talebe ${Math.floor((now - r.createdAt) / 3600e3)} saattir karar verilmedi`, link: '#/randevular' });
    }
  }
  return out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'err' ? -1 : 1));
}
