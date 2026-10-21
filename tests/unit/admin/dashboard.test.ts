import { describe, it, expect } from 'vitest';
import { dashboard, greeting, istanbulHour, todayAgenda, waitingRequests } from '../../../src/admin/lib/dashboard';
import type { BookingRequest, Client, DraftSummary } from '../../../src/admin/api/types';
import type { LivePost } from '../../../src/admin/lib/publish';

const live = (key: string, publishedAt: string) =>
  ({ key, tr: { fm: { title: key, publishedAt }, sha: 's' }, en: { fm: { title: key, publishedAt }, sha: 's' }, files: [] }) as unknown as LivePost;
const draft = (key: string, updatedAt: string, tr = 'T', en = 'E'): DraftSummary => ({
  key,
  rev: 1,
  updatedAt,
  published: false,
  category: 'terapi',
  title: { tr, en },
});
const now = new Date('2026-10-17T10:00:00Z');

describe('dashboard', () => {
  it('picks the latest live post and counts this month', () => {
    const d = dashboard([live('a', '2026-09-30'), live('b', '2026-10-05'), live('c', '2026-10-01')], [], now);
    expect(d.lastLive?.key).toBe('b');
    expect(d.publishedThisMonth).toBe(2);
  });
  it('has no last post when nothing is live', () => {
    expect(dashboard([], [], now).lastLive).toBeNull();
  });
  it('keeps at most 5 recent drafts, newest first', () => {
    const drafts = [1, 2, 3, 4, 5, 6, 7].map((n) => draft(`d${n}`, `2026-10-0${n}T00:00:00Z`));
    const d = dashboard([], drafts, now);
    expect(d.recentDrafts.map((x) => x.key)).toEqual(['d7', 'd6', 'd5', 'd4', 'd3']);
  });
  it('lists drafts missing one language, but not fully empty ones', () => {
    const d = dashboard([], [draft('x', '2026-10-01T00:00:00Z', 'Bağlanma', ''), draft('y', '2026-10-02T00:00:00Z', '', ''), draft('z', '2026-10-03T00:00:00Z', '', 'Bonding')], now);
    expect(d.incomplete).toEqual([
      { key: 'x', title: 'Bağlanma', missing: 'en' },
      { key: 'z', title: 'Bonding', missing: 'tr' },
    ]);
  });
});

describe('dashboard month boundary (final review M4)', () => {
  it('"this month" is the local month: 1 November 01:00 in Istanbul (UTC+3) counts November posts', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'Europe/Istanbul';
    try {
      const firstOfMonth = new Date('2026-11-01T01:00:00+03:00'); // still 31 October in UTC
      expect(firstOfMonth.getDate()).toBe(1);
      const d = dashboard([live('ekim1', '2026-10-31'), live('ekim2', '2026-10-05'), live('kasim', '2026-11-01')], [], firstOfMonth);
      expect(d.publishedThisMonth).toBe(1);
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });
});

describe('home greeting, agenda and waiting requests', () => {
  it('greets by the hour in Istanbul', () => {
    expect(istanbulHour(new Date('2026-10-21T05:30:00Z'))).toBe(8);
    expect([4, 5, 11, 12, 17, 18, 22, 23, 0].map(greeting)).toEqual([
      'İyi geceler', 'Günaydın', 'Günaydın', 'İyi günler', 'İyi günler', 'İyi akşamlar', 'İyi akşamlar', 'İyi geceler', 'İyi geceler',
    ]);
  });

  const client = (id: string, number: string, weekday: number, time: string, sessions: Client['sessions'] = []): Client => ({
    id,
    number,
    type: 'bireysel',
    weekday,
    time,
    minutes: 50,
    since: '2026-09-01',
    status: 'active',
    contact: { name: 'X', email: 'x@y.z', lang: 'tr' },
    sessions,
  });

  it("lists today's sessions earliest first, without the cancelled ones", () => {
    // 21 October 2026 is a Wednesday (3).
    const now = new Date('2026-10-21T06:00:00Z');
    const agenda = todayAgenda(
      [
        client('a', 'KT002', 3, '18:00'),
        client('b', 'KT001', 3, '10:00'),
        client('c', 'KT003', 3, '12:00', [{ day: '2026-10-21', time: '12:00', kind: 'weekly', minutes: 50, status: 'cancelled' }]),
        client('d', 'KT004', 4, '10:00', [{ day: '2026-10-21', time: '15:00', kind: 'extra', minutes: 50, status: 'planned' }]),
      ],
      now,
    );
    expect(agenda.map((x) => `${x.time} ${x.number} ${x.kind}`)).toEqual(['10:00 KT001 weekly', '15:00 KT004 extra', '18:00 KT002 weekly']);
  });

  it('counts the waiting requests and the late ones, oldest first', () => {
    const now = new Date('2026-10-21T12:00:00Z');
    const req = (id: string, hoursAgo: number, status: 'pending' | 'approved' = 'pending') =>
      ({ id, status, createdAt: now.getTime() - hoursAgo * 3600e3 }) as BookingRequest;
    const w = waitingRequests([req('new', 2), req('old', 30), req('done', 50, 'approved')], now);
    expect(w.pending.map((r) => r.id)).toEqual(['old', 'new']);
    expect(w.late).toBe(1);
  });
});
