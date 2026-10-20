import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { handle } from '../../../apps-script/src/main';
import { bookingBusy } from '../../../apps-script/src/booking';
import { issueSession } from '../../../apps-script/src/auth';
import { REQUEST_KEEP_MS } from '../../../apps-script/src/requests';
import { seal, unseal } from '../../../apps-script/src/seal';
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
    expect(moved.data.client).toEqual({
      id: expect.any(String), number: 'KT001AY', type: 'couple', weekday: 4, time: '19:20', minutes: 60, since: '2026-10-22', status: 'active',
      contact: { name: 'Ayşe Yılmaz', email: 'ayse@example.com', lang: 'tr' },
    });
    expect(requests()).toEqual([]);
    // Sealed on disk: nothing readable without the script's key.
    const folder = gas.root.findFolder('randevular')!;
    expect(folder.findFile('talepler.json')!.read()).not.toMatch(/Ayşe|ayse|0532/);
    expect(folder.findFile('danisanlar.json')!.read()).not.toMatch(/Ayşe|ayse|0532|couple/);
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
    expect(moved.data.client).toMatchObject({ number: 'KT001AY', weekday: 3, time: '19:50', type: 'individual' });
    expect(call<{ clients: unknown[] }>('clients.list').data.clients).toHaveLength(1);
  });

  const tracked = (s: ReturnType<typeof setup>, p: Record<string, unknown> = {}) => {
    s.send({ ...session, ...p });
    const id = s.requests().at(-1)!.id;
    s.call('requests.decide', { id, decision: 'approve', ...mail });
    return s.call<{ client: { id: string; number: string } }>('requests.toClient', { id }).data.client;
  };
  const clients = (s: ReturnType<typeof setup>) => s.call<{ clients: { id: string; status: string }[] }>('clients.list').data.clients;
  const free = (s: ReturnType<typeof setup>) => {
    s.gas.cache.put('booking.busy', '', 1);
    return bookingBusy(s.gas).busy;
  };

  it('Terapi tamamlandı sends the e-mail, deletes the client with the contact and frees the weekly time; numbers keep counting', () => {
    const s = setup();
    const c = tracked(s);
    s.gas.mails.length = 0;
    expect(s.call('clients.end', { id: c.id, mode: 'complete', subject: ' ', body: '' }).ok).toBe(false);
    expect(clients(s)).toHaveLength(1);
    expect(s.call('clients.end', { id: c.id, mode: 'complete', ...mail }).ok).toBe(true);
    expect(s.gas.mails).toEqual([expect.objectContaining({ to: 'ayse@example.com', subject: 'Konu' })]);
    expect(clients(s)).toEqual([]);
    expect(free(s)).toEqual([]);
    expect(tracked(s, { name: 'Osman Güneş Özkurt', email: 'yeni@example.com' }).number).toBe('KT002OGO');
  });

  it('Sonlandırma görüşmesi sends the invitation and marks the client; the weekly time stays', () => {
    const s = setup();
    const c = tracked(s);
    expect(s.call('clients.end', { id: c.id, mode: 'closing', ...mail }).ok).toBe(true);
    expect(clients(s)).toEqual([expect.objectContaining({ id: c.id, status: 'closing' })]);
    expect(free(s)).toContainEqual({ start: at('2026-10-29T19:20:00'), end: at('2026-10-29T20:50:00') });
  });

  it('Sil removes the client with no e-mail', () => {
    const s = setup();
    const c = tracked(s);
    s.gas.mails.length = 0;
    expect(s.call('clients.end', { id: c.id, mode: 'delete' }).ok).toBe(true);
    expect(s.gas.mails).toEqual([]);
    expect(clients(s)).toEqual([]);
  });

  it('Geri al on a client sends the apology and puts the request back as pending, holding its time again', () => {
    const s = setup();
    const c = tracked(s);
    s.gas.mails.length = 0;
    expect(s.call('clients.revert', { id: c.id, ...mail }).ok).toBe(true);
    expect(s.gas.mails).toEqual([expect.objectContaining({ to: 'ayse@example.com' })]);
    expect(clients(s)).toEqual([]);
    expect(s.requests()).toEqual([expect.objectContaining({ status: 'pending', name: 'Ayşe Yılmaz', phone: '0532 123 45 67', day: '2026-10-22', time: '19:20', type: 'couple' })]);
    const entries = s.call<{ entries: { status: string; start: number }[] }>('calendar.list').data.entries;
    expect(entries).toEqual([expect.objectContaining({ status: 'hold', start: at('2026-10-22T19:20:00') })]);
    // The weekly time is gone: next Thursday is free again.
    expect(free(s).some((b) => b.start === at('2026-10-29T19:20:00'))).toBe(false);
  });

  it('Geri al on an approved request sends the apology, frees the confirmed time and makes it pending again', () => {
    const s = setup();
    s.send(session);
    const id = s.requests()[0].id;
    s.call('requests.decide', { id, decision: 'approve', ...mail });
    expect(s.call('requests.revert', { id, ...mail }).ok).toBe(true);
    expect(s.requests()[0]).toMatchObject({ status: 'pending' });
    const entries = s.call<{ entries: { status: string }[] }>('calendar.list').data.entries;
    expect(entries.map((e) => e.status)).toEqual(['hold']);
    expect(s.call('requests.revert', { id, ...mail }).ok).toBe(false); // only an approved one
  });

  it('a request is deleted after 30 days, decided or not', () => {
    const { gas, send, requests } = setup();
    send(session);
    gas.clock.now = NOW + REQUEST_KEEP_MS + 1;
    expect(requests()).toEqual([]);
  });
});

describe('Sealing (seal.ts)', () => {
  it('round-trips any text, refuses a changed token or another key', () => {
    const gas = fakeGas({ now: NOW });
    const text = JSON.stringify({ name: 'Şükrü Öğütçü', email: 'a@b.c', emoji: '🙂', long: 'x'.repeat(1000) });
    const token = seal(gas, text);
    expect(token).toMatch(/^s1\./);
    expect(token).not.toContain('Şükrü');
    expect(unseal(gas, token)).toBe(text);
    expect(seal(gas, text)).not.toBe(token); // a fresh nonce every time
    const [v, n, ct, tag] = token.split('.');
    const flipped = ct.slice(0, 5) + (ct[5] === 'A' ? 'B' : 'A') + ct.slice(6);
    expect(unseal(gas, [v, n, flipped, tag].join('.'))).toBeNull();
    expect(unseal(fakeGas({ now: NOW }), token)).toBeNull();
    expect(unseal(gas, 'not a token')).toBeNull();
  });
});
