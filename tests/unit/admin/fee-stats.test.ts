import { describe, expect, it } from 'vitest';
import { feeStats } from '../../../src/admin/lib/fee-stats';
import { EMPTY_PAYMENT } from '../../../src/lib/payment';
import type { Client } from '../../../src/admin/api/types';

const NOW = Date.parse('2026-10-23T12:00:00+03:00'); // a Friday
const pay = { ...EMPTY_PAYMENT, year: 2026, fees: { individual: 1500, couple: 2000 } };
const client = (c: Partial<Client>): Client => ({
  id: 'c1',
  number: 'KT001AY',
  type: 'individual',
  weekday: 3,
  time: '10:00',
  minutes: 50,
  since: '2026-10-07',
  status: 'active',
  contact: { name: 'Ayşe Yılmaz', email: 'ayse@example.com', lang: 'tr' },
  ...c,
});

describe('feeStats', () => {
  it('adds up what came in, what is due and the next seven days; free and postponed sessions do not count', () => {
    const paidThisMonth = Date.parse('2026-10-08T12:00:00+03:00');
    const c = client({
      sessions: [
        { day: '2026-10-07', time: '10:00', kind: 'weekly', minutes: 50, status: 'attended', paid: paidThisMonth },
        { day: '2026-10-14', time: '10:00', kind: 'weekly', minutes: 50, status: 'attended' },
        { day: '2026-10-21', time: '10:00', kind: 'weekly', minutes: 50, status: 'postponed', movedTo: { day: '2026-10-22', time: '15:00' } },
        { day: '2026-10-22', time: '15:00', kind: 'extra', minutes: 50, status: 'attended', from: '2026-10-21T10:00' },
        { day: '2026-10-05', time: '11:00', kind: 'intro', minutes: 30, status: 'attended' },
      ],
    });
    const other = client({ id: 'c2', number: 'KT002AK', type: 'couple', weekday: 6, time: '11:00', since: '2026-10-24', fee: 1800 });
    const s = feeStats([c, other], pay, NOW);
    expect(s.month).toEqual({ amount: 1500, count: 1 });
    expect(s.year).toEqual({ amount: 1500, count: 1 });
    expect(s.due).toEqual({ amount: 3000, count: 2 });
    expect(s.dueList.map((d) => d.day)).toEqual(['2026-10-14', '2026-10-22']);
    // Next Wednesday for the first, Saturday for the other at their own fee.
    expect(s.next7).toEqual({ amount: 1500 + 1800, count: 2 });
  });
});
