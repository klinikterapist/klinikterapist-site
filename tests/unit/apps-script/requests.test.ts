import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { handle } from '../../../apps-script/src/main';
import { bookingBusy } from '../../../apps-script/src/booking';
import { issueSession } from '../../../apps-script/src/auth';
import { REQUEST_KEEP_MS } from '../../../apps-script/src/requests';
import { fakeGas } from './fake-gas';
import { FakeGitHub } from './fake-github';
import { ghProps } from './publish-fixtures';

const NOW = Date.parse('2026-10-20T10:00:00+03:00');
const at = (s: string) => Date.parse(`${s}+03:00`);

function setup() {
  const gh = new FakeGitHub({ 'src/data/booking.json': readFileSync('src/data/booking.json', 'utf8') });
  const gas = fakeGas({ props: { ...ghProps, OWNER_EMAIL: 'merhaba@klinikterapist.com' }, routes: [gh.route], now: NOW });
  const call = <T = unknown>(action: string, p: Record<string, unknown> = {}) =>
    handle(gas, JSON.stringify({ action, session: issueSession(gas, 'merhaba@klinikterapist.com').session, ...p })) as { ok: boolean; data: T; error?: { code: string; message: string } };
  const send = (p: Record<string, unknown>) =>
    handle(gas, JSON.stringify({ action: 'booking.request', name: 'Ayşe Yılmaz', email: 'ayse@example.com', phone: '0532 123 45 67', note: 'Not', consent: true, lang: 'tr', ...p }));
  const requests = () => call<{ requests: { id: string; status: string; name?: string }[] }>('requests.list').data.requests;
  return { gas, call, send, requests };
}

const session = { kind: 'session', type: 'couple', day: '2026-10-22', time: '19:20' };
const intro = { kind: 'intro', day: '2026-10-24', time: '11:00', forWhom: 'individual', topics: [0], before: 'no', age: 2, healthConsent: true };
const mail = { subject: 'Konu', body: 'Sayın Ayşe Yılmaz, …' };

describe('Talepler (backend)', () => {
  it('a request from the site is kept with its details until decided', () => {
    const { send, requests } = setup();
    expect(send(session).ok).toBe(true);
    expect(requests()).toEqual([expect.objectContaining({ kind: 'session', type: 'couple', name: 'Ayşe Yılmaz', email: 'ayse@example.com', status: 'pending' })]);
  });

  it('approve sends the owner text to the requester only, confirms the time and keeps the request', () => {
    const { gas, call, send, requests } = setup();
    send(session);
    const id = requests()[0].id;
    gas.mails.length = 0;
    expect(call('requests.decide', { id, decision: 'approve', ...mail }).ok).toBe(true);
    expect(gas.mails).toEqual([expect.objectContaining({ to: 'ayse@example.com', replyTo: 'merhaba@klinikterapist.com', subject: 'Konu', body: mail.body })]);
    expect(requests()[0].status).toBe('approved');
    const entries = call<{ entries: { status: string }[] }>('calendar.list').data.entries;
    expect(entries.map((e) => e.status)).toEqual(['confirmed']);
  });

  it('not available and cancel delete the request with its details and free the time', () => {
    const { gas, call, send, requests } = setup();
    send(session);
    send({ ...session, time: '13:30' });
    const [a, b] = requests();
    expect(call('requests.decide', { id: a.id, decision: 'unavailable', ...mail }).ok).toBe(true);
    expect(call('requests.decide', { id: b.id, decision: 'cancel', ...mail }).ok).toBe(true);
    expect(requests()).toEqual([]);
    gas.cache.put('booking.busy', '', 1);
    expect(bookingBusy(gas).busy).toEqual([]);
    const file = gas.root.findFolder('randevular')!.findFile('talepler.json')!.read();
    expect(file).not.toContain('Ayşe');
  });

  it('an empty e-mail is refused and nothing changes', () => {
    const { call, send, requests } = setup();
    send(session);
    expect(call('requests.decide', { id: requests()[0].id, decision: 'cancel', subject: ' ', body: '' }).ok).toBe(false);
    expect(requests()).toHaveLength(1);
  });

  it('a booking moves to Randevu takibi with its weekday and time; the details are deleted and the weekly time is taken', () => {
    const { gas, call, send, requests } = setup();
    send(session);
    const id = requests()[0].id;
    expect(call('requests.toClient', { id }).ok).toBe(false); // approve first
    call('requests.decide', { id, decision: 'approve', ...mail });
    const moved = call<{ client: Record<string, unknown> }>('requests.toClient', { id });
    expect(moved.data.client).toEqual({ id: expect.any(String), number: 'D-001', type: 'couple', weekday: 4, time: '19:20', minutes: 60, since: '2026-10-22' });
    expect(requests()).toEqual([]);
    const folder = gas.root.findFolder('randevular')!;
    expect(folder.findFile('talepler.json')!.read()).not.toMatch(/Ayşe|ayse|0532/);
    expect(folder.findFile('danisanlar.json')!.read()).not.toMatch(/Ayşe|ayse|0532/);
    // Every Thursday at 19:20 is now taken (60 min + 30 rest), the one-off entry is gone.
    gas.cache.put('booking.busy', '', 1);
    const busy = bookingBusy(gas).busy;
    expect(busy).toContainEqual({ start: at('2026-10-22T19:20:00'), end: at('2026-10-22T20:50:00') });
    expect(busy).toContainEqual({ start: at('2026-10-29T19:20:00'), end: at('2026-10-29T20:50:00') });
    expect(busy.filter((b) => b.start === at('2026-10-22T19:20:00'))).toHaveLength(1);
    expect(send({ ...session, day: '2026-11-05', time: '19:50', email: 'baska@example.com' })).toMatchObject({ ok: false });
  });

  it('an intro call needs the weekly day, time and start date', () => {
    const { call, send, requests } = setup();
    send(intro);
    const id = requests()[0].id;
    call('requests.decide', { id, decision: 'approve', ...mail });
    expect(call('requests.toClient', { id }).ok).toBe(false);
    const moved = call<{ client: { weekday: number; time: string; type: string; number: string } }>('requests.toClient', { id, weekday: 3, time: '19:50', since: '2026-10-28' });
    expect(moved.data.client).toMatchObject({ number: 'D-001', weekday: 3, time: '19:50', type: 'individual' });
    expect(call<{ clients: unknown[] }>('clients.list').data.clients).toHaveLength(1);
  });

  it('ending therapy removes the client and frees the weekly time; numbers keep counting', () => {
    const { gas, call, send, requests } = setup();
    send(session);
    const id = requests()[0].id;
    call('requests.decide', { id, decision: 'approve', ...mail });
    const c = call<{ client: { id: string } }>('requests.toClient', { id }).data.client;
    expect(call('clients.end', { id: c.id }).ok).toBe(true);
    gas.cache.put('booking.busy', '', 1);
    expect(bookingBusy(gas).busy).toEqual([]);
    send({ ...session, email: 'yeni@example.com' });
    const id2 = requests()[0].id;
    call('requests.decide', { id: id2, decision: 'approve', ...mail });
    expect(call<{ client: { number: string } }>('requests.toClient', { id: id2 }).data.client.number).toBe('D-002');
  });

  it('a request is deleted after 30 days, decided or not', () => {
    const { gas, send, requests } = setup();
    send(session);
    gas.clock.now = NOW + REQUEST_KEEP_MS + 1;
    expect(requests()).toEqual([]);
  });
});
