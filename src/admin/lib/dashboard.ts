/** What the home screen shows, derived from the live posts, the drafts, the tracked clients and the requests. */
import type { BookingRequest, Client, DraftSummary } from '../api/types';
import { sessionsOf, type SessionKind, type SessionStatus } from '../../lib/sessions';
import type { LivePost } from './publish';
import { isoDay } from './draft';

export type Incomplete = { key: string; title: string; missing: 'tr' | 'en' };

const publishedAt = (p: LivePost) => p.tr.fm.publishedAt;

export function dashboard(live: LivePost[], drafts: DraftSummary[], now: Date) {
  // The owner's local month (Istanbul), not UTC: on the 1st before 03:00 UTC is still last month.
  const month = isoDay(now).slice(0, 7);
  const lastLive = live.reduce<LivePost | null>((best, p) => (!best || publishedAt(p) > publishedAt(best) ? p : best), null);
  const recentDrafts = [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const incomplete: Incomplete[] = [];
  for (const d of drafts) {
    const tr = d.title.tr.trim();
    const en = d.title.en.trim();
    if (tr && !en) incomplete.push({ key: d.key, title: tr, missing: 'en' });
    else if (en && !tr) incomplete.push({ key: d.key, title: en, missing: 'tr' });
  }
  // Planned posts in the order they go live; the ones whose publish failed (retried hourly) apart.
  const scheduled = drafts.filter((d) => d.scheduledAt).sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  const scheduleErrors = scheduled.filter((d) => d.scheduleError);
  return { lastLive, recentDrafts, publishedThisMonth: live.filter((p) => publishedAt(p).startsWith(month)).length, incomplete, scheduled, scheduleErrors };
}

/** The hour in Istanbul (UTC+3 all year), 0–23. */
export const istanbulHour = (now: Date) => new Date(now.getTime() + 3 * 3600e3).getUTCHours();

/** The greeting at the top of the home screen, by the hour in Istanbul. */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Günaydın';
  if (hour >= 12 && hour < 18) return 'İyi günler';
  if (hour >= 18 && hour < 23) return 'İyi akşamlar';
  return 'İyi geceler';
}

export type AgendaItem = { clientId: string; number: string; type: string; time: string; kind: SessionKind; minutes: number; status: SessionStatus };

/** Today's sessions of the tracked clients, earliest first; cancelled and postponed ones left out. */
export function todayAgenda(clients: Client[], now: Date): AgendaItem[] {
  const today = new Date(now.getTime() + 3 * 3600e3).toISOString().slice(0, 10);
  const out: AgendaItem[] = [];
  for (const c of clients) {
    for (const s of sessionsOf(c, today, today)) {
      if (s.status === 'cancelled' || s.status === 'postponed') continue;
      out.push({ clientId: c.id, number: c.number, type: c.type, time: s.time, kind: s.kind, minutes: s.minutes, status: s.status });
    }
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.number.localeCompare(b.number));
}

/** A request waiting longer than this gets the warning colour (the owner is told at 20 hours too). */
export const REQUEST_LATE_MS = 20 * 3600e3;

/** Requests still waiting for an answer, oldest first, and how many of them are late. */
export function waitingRequests(requests: BookingRequest[], now: Date) {
  const pending = requests.filter((r) => r.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
  return { pending, late: pending.filter((r) => now.getTime() - r.createdAt > REQUEST_LATE_MS).length };
}
