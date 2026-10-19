import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { handle } from '../../../apps-script/src/main';
import { bookingBusy } from '../../../apps-script/src/booking';
import { issueSession } from '../../../apps-script/src/auth';
import { HOLD_MS } from '../../../apps-script/src/calendar';
import { fakeGas } from './fake-gas';
import { FakeGitHub } from './fake-github';
import { ghProps } from './publish-fixtures';

const NOW = Date.parse('2026-10-20T10:00:00+03:00');
const at = (s: string) => Date.parse(`${s}+03:00`);

function setup() {
  const gh = new FakeGitHub({ 'src/data/booking.json': readFileSync('src/data/booking.json', 'utf8') });
  const gas = fakeGas({ props: { ...ghProps, OWNER_EMAIL: 'merhaba@klinikterapist.com' }, routes: [gh.route], now: NOW });
  // A fresh session each time: some tests move the clock past the 12-hour session.
  const call = (action: string, p: Record<string, unknown> = {}) =>
    handle(gas, JSON.stringify({ action, session: issueSession(gas, 'merhaba@klinikterapist.com').session, ...p }));
  const request = (time: string, type = 'individual') =>
    handle(gas, JSON.stringify({ action: 'booking.request', kind: 'session', type, day: '2026-10-22', time, name: 'Ali', email: `ali${time.replace(':', '')}@example.com`, phone: '05321234567', note: '', consent: true }));
  return { gas, call, request };
}

describe('booking calendar', () => {
  it('a request holds its time for 24 hours; then it frees itself', () => {
    const { gas, request } = setup();
    expect(request('19:20').ok).toBe(true);
    expect(bookingBusy(gas).busy).toEqual([{ start: at('2026-10-22T19:20:00'), end: at('2026-10-22T20:40:00') }]);
    // 19:50 would overlap the hold (19:20–20:40).
    expect(request('19:50')).toMatchObject({ ok: false, error: { message: expect.stringContaining('artık uygun değil') } });
    expect(request('20:50').ok).toBe(true);
    gas.clock.now = NOW + HOLD_MS + 1;
    gas.cache.put('booking.busy', '', 1);
    expect(bookingBusy(gas).busy).toEqual([]);
  });

  it('the owner confirms a hold: it becomes an appointment and no longer expires', () => {
    const { gas, call, request } = setup();
    request('19:20');
    const added = call('calendar.add', { day: '2026-10-22', time: '19:20', kind: 'session', type: 'individual' });
    expect(added).toMatchObject({ ok: true, data: { entry: { status: 'confirmed', minutes: 50 } } });
    const list = call('calendar.list') as { ok: true; data: { entries: { status: string }[] } };
    expect(list.data.entries.map((e) => e.status)).toEqual(['confirmed']);
    gas.clock.now = NOW + HOLD_MS + 1;
    expect((call('calendar.list') as typeof list).data.entries).toHaveLength(1);
  });

  it('a confirmed appointment cannot overlap another; removing frees the time', () => {
    const { call, gas } = setup();
    const first = call('calendar.add', { day: '2026-10-22', time: '10:00', kind: 'session', type: 'individual' }) as { ok: true; data: { entry: { id: string } } };
    expect(call('calendar.add', { day: '2026-10-22', time: '11:00', kind: 'session', type: 'couple' })).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(call('calendar.remove', { id: first.data.entry.id }).ok).toBe(true);
    expect(call('calendar.add', { day: '2026-10-22', time: '11:00', kind: 'session', type: 'couple' }).ok).toBe(true);
    expect(bookingBusy(gas).busy).toEqual([{ start: at('2026-10-22T11:00:00'), end: at('2026-10-22T12:30:00') }]);
  });

  it('the calendar actions need the owner session; the busy list shows no kinds', () => {
    const { gas, request } = setup();
    expect(handle(gas, JSON.stringify({ action: 'calendar.list' })).ok).toBe(false);
    request('15:00', 'couple');
    expect(JSON.stringify(bookingBusy(gas))).not.toMatch(/couple|session|Ali/);
  });

  it('a past appointment drops out of the calendar', () => {
    const { gas, call } = setup();
    call('calendar.add', { day: '2026-10-22', time: '10:00', kind: 'session', type: 'individual' });
    gas.clock.now = at('2026-10-22T11:00:00');
    expect((call('calendar.list') as { ok: true; data: { entries: unknown[] } }).data.entries).toHaveLength(0);
  });
});
