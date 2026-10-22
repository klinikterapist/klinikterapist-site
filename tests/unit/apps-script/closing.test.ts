import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { handle, runHourly } from '../../../apps-script/src/main';
import { runClosing } from '../../../apps-script/src/closing';
import { issueSession } from '../../../apps-script/src/auth';
import { fakeGas } from './fake-gas';
import { FakeGitHub } from './fake-github';
import { ghProps } from './publish-fixtures';

// Tuesday 20 October 2026, 10:00 Istanbul.
const NOW = Date.parse('2026-10-20T10:00:00+03:00');
const at = (s: string) => Date.parse(`${s}+03:00`);
const mail = { subject: 'Konu', body: 'Sayın Ayşe Yılmaz, …' };

type Session = { day: string; time: string; kind: string; minutes: number; status: string };
type Res = { ok: boolean; data?: Record<string, unknown> };

/** A couples client with weekly sessions on Thursdays 19:20 from 22 October, invited to the closing session at NOW. */
function invited() {
  const gh = new FakeGitHub({ 'src/data/booking.json': readFileSync('src/data/booking.json', 'utf8') });
  const gas = fakeGas({ props: { ...ghProps, OWNER_EMAIL: 'merhaba@klinikterapist.com' }, routes: [gh.route], now: NOW });
  const call = <T = unknown>(action: string, p: Record<string, unknown> = {}) =>
    handle(gas, JSON.stringify({ action, session: issueSession(gas, 'merhaba@klinikterapist.com').session, ...p })) as { ok: boolean; data: T };
  handle(gas, JSON.stringify({ action: 'booking.request', name: 'Ayşe Yılmaz', email: 'ayse@example.com', phone: '0532 123 45 67', note: '', consent: true, lang: 'tr', kind: 'session', type: 'couple', day: '2026-10-22', time: '19:20' }));
  const id = call<{ requests: { id: string }[] }>('requests.list').data.requests[0].id;
  call('requests.decide', { id, decision: 'approve', ...mail });
  const cid = call<{ client: { id: string } }>('requests.toClient', { id }).data.client.id;
  const code = call<{ link: string }>('clients.link', { id: cid }).data.link.split('#k=')[1];
  expect(call('clients.end', { id: cid, mode: 'closing', ...mail }).ok).toBe(true);
  gas.mails.length = 0;
  const pub = (action: string, p: Record<string, unknown> = {}) => handle(gas, JSON.stringify({ action, code, ...p })) as Res;
  const client = () => call<{ clients: { sessions?: Session[]; closingAsk?: Record<string, unknown> }[] }>('clients.list').data.clients[0];
  return { gas, call, cid, pub, client };
}

describe('the closing session: picking a time on the page', () => {
  it('the invitation gives until the end of the third day; the page shows it and the session that would become the closing one', () => {
    const t = invited();
    expect(t.client().closingAsk).toEqual({ at: NOW, until: at('2026-10-24T00:00:00') });
    expect(t.pub('track.view').data!.closingPick).toEqual({ lastDay: '2026-10-23', target: { day: '2026-10-29', time: '19:20' } });
  });

  it('a free intro-call time books the free 30-minute closing session, tells both and ends the wait', () => {
    const t = invited();
    expect(t.pub('track.ask', { ask: 'closing', day: '2026-10-24', time: '11:00' }).ok).toBe(true);
    expect(t.client().sessions).toContainEqual({ day: '2026-10-24', time: '11:00', kind: 'closing', minutes: 30, status: 'planned' });
    expect(t.client().closingAsk).toMatchObject({ done: NOW });
    expect(t.gas.mails.map((m) => [m.to, m.subject])).toEqual([
      ['merhaba@klinikterapist.com', 'KT001AY sonlandırma görüşmesinin saatini seçti – 24 Ekim 2026, Cumartesi, 11.00'],
      ['ayse@example.com', 'Sonlandırma görüşmeniz planlandı – klinikterapist.com'],
    ]);
    expect(t.gas.mails[1].body).toContain('– Tarih: 24 Ekim 2026, Cumartesi');
    expect(t.gas.mails[1].body).toContain('→ Randevu sayfama git: https://klinikterapist.com/randevum/#k=');
    const view = t.pub('track.view').data!;
    expect(view.closingPick).toBeUndefined();
    expect(view.next).toContainEqual(expect.objectContaining({ day: '2026-10-24', kind: 'closing', minutes: 30 }));
    // Once is enough.
    expect(t.pub('track.ask', { ask: 'closing', day: '2026-10-25', time: '11:00' })).toMatchObject({ ok: false, data: { reason: 'gone' } });
  });

  it('a time outside the intro-call calendar, or a taken one, is refused', () => {
    const t = invited();
    expect(t.pub('track.ask', { ask: 'closing', day: '2026-10-22', time: '19:20' })).toMatchObject({ ok: false, data: { reason: 'taken' } });
    t.call('calendar.close', { day: '2026-10-24', from: '10:00', to: '12:00', note: '' });
    expect(t.pub('track.ask', { ask: 'closing', day: '2026-10-24', time: '11:00' })).toMatchObject({ ok: false, data: { reason: 'taken' } });
    expect(t.pub('track.ask', { ask: 'closing', day: 'yarın', time: '11:00' })).toMatchObject({ ok: false, data: { reason: 'invalid' } });
    expect(t.gas.mails).toEqual([]);
  });

  it('after the time to pick, the page offers no more picking', () => {
    const t = invited();
    t.gas.clock.now = at('2026-10-24T00:00:00');
    expect(t.pub('track.view').data!.closingPick).toBeUndefined();
    expect(t.pub('track.ask', { ask: 'closing', day: '2026-10-25', time: '11:00' })).toMatchObject({ ok: false, data: { reason: 'gone' } });
  });
});

describe('the closing session: the hourly reminder and the session that becomes it', () => {
  it('a day before the end, one reminder to the client and one note to the owner', async () => {
    const t = invited();
    t.gas.clock.now = at('2026-10-22T23:00:00');
    expect(runClosing(t.gas)).toBe(0);
    t.gas.clock.now = at('2026-10-23T00:30:00');
    await runHourly(t.gas);
    expect(t.gas.mails.map((m) => [m.to, m.subject])).toEqual([
      ['ayse@example.com', 'Sonlandırma görüşmesi için saat seçimi – klinikterapist.com'],
      ['merhaba@klinikterapist.com', 'KT001AY sonlandırma görüşmesinin saatini henüz seçmedi'],
    ]);
    expect(t.gas.mails[0].body).toContain('23 Ekim 2026, Cuma gününün sonuna kadar');
    expect(t.gas.mails[0].body).toContain('29 Ekim 2026, Perşembe, saat 19.20 seansınızı');
    expect(t.gas.mails[1].body).toContain('– Seçim için son gün: 23 Ekim 2026, Cuma');
    t.gas.clock.now += 3600e3;
    expect(runClosing(t.gas)).toBe(0);
  });

  it('with no time picked, the next session at least a day ahead becomes the free 30-minute closing session', () => {
    const t = invited();
    t.gas.clock.now = at('2026-10-24T00:30:00');
    expect(runClosing(t.gas)).toBe(2);
    const s = t.client().sessions!;
    expect(s).toContainEqual(expect.objectContaining({ day: '2026-10-29', time: '19:20', kind: 'closing', minutes: 30, status: 'planned' }));
    expect(t.client().closingAsk).toMatchObject({ done: at('2026-10-24T00:30:00'), auto: { day: '2026-10-29', time: '19:20' } });
    expect(t.gas.mails.map((m) => [m.to, m.subject])).toEqual([
      ['merhaba@klinikterapist.com', 'KT001AY: sonlandırma görüşmesi için saat seçilmedi'],
      ['ayse@example.com', 'Sonlandırma görüşmeniz planlandı – klinikterapist.com'],
    ]);
    expect(t.gas.mails[0].body).toContain('– Tarih: 29 Ekim 2026, Perşembe');
    expect(t.gas.mails[0].body).not.toContain('bulunamadı');
    expect(t.gas.mails[1].body).toContain('– Ücret: Ücretsiz');
    // The page: the week's session is the closing session now; the next week is a session again.
    const next = t.pub('track.view').data!.next as Session[];
    expect(next.slice(0, 2).map((x) => [x.day, x.kind, x.minutes])).toEqual([
      ['2026-10-29', 'closing', 30],
      ['2026-11-05', 'weekly', 60],
    ]);
    // Done once.
    t.gas.clock.now += 3600e3;
    expect(runClosing(t.gas)).toBe(0);
  });

  it('a closing session the owner adds ends the wait: nothing is reminded or changed', () => {
    const t = invited();
    expect(t.call('clients.session', { id: t.cid, op: 'add', kind: 'closing', day: '2026-10-27', time: '12:00' }).ok).toBe(true);
    t.gas.clock.now = at('2026-10-23T01:00:00');
    expect(runClosing(t.gas)).toBe(0);
    t.gas.clock.now = at('2026-10-24T01:00:00');
    expect(runClosing(t.gas)).toBe(0);
    expect(t.client().sessions!.filter((x) => x.kind === 'closing').map((x) => x.day)).toEqual(['2026-10-27']);
    expect(t.client().closingAsk).toMatchObject({ done: at('2026-10-23T01:00:00') });
    expect(t.gas.mails).toEqual([]);
  });

  it('with no planned session left, only the owner hears of it', () => {
    const t = invited();
    for (const day of ['2026-10-29', '2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26', '2026-12-03', '2026-12-10', '2026-12-17', '2026-12-24'])
      t.call('clients.session', { id: t.cid, op: 'mark', day, time: '19:20', status: 'cancelled', by: 'owner' });
    t.gas.clock.now = at('2026-10-24T00:30:00');
    expect(runClosing(t.gas)).toBe(1);
    expect(t.gas.mails[0].to).toBe('merhaba@klinikterapist.com');
    expect(t.gas.mails[0].body).toContain('dönüştürülecek seans bulunamadı');
    expect(t.client().closingAsk).toMatchObject({ done: at('2026-10-24T00:30:00') });
    expect(t.client().closingAsk).not.toHaveProperty('auto');
  });
});
