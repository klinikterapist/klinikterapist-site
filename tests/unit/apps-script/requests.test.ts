import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { handle, runHourly } from '../../../apps-script/src/main';
import { bookingBusy } from '../../../apps-script/src/booking';
import { issueSession } from '../../../apps-script/src/auth';
import { REQUEST_KEEP_MS } from '../../../apps-script/src/requests';
import { seal, unseal } from '../../../apps-script/src/seal';
import { fakeGas, type MemFile } from './fake-gas';
import { FakeGitHub } from './fake-github';
import { ghProps } from './publish-fixtures';
import { parseBooking } from '../../../src/lib/schemas';
import { freeTimes, type TrackView } from '../../../src/lib/tracking';

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
      sessions: [],
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

  it('every write of the appointment files happens under the script lock (a request coming in at the same moment is not lost)', () => {
    const s = setup();
    let depth = 0;
    const unlocked: string[] = [];
    s.gas.withLock = (fn) => {
      depth++;
      try {
        return fn();
      } finally {
        depth--;
      }
    };
    const folder = s.gas.root.findFolder('randevular') ?? s.gas.root.createFolder('randevular');
    const create = folder.createFile.bind(folder);
    const watch = (f: MemFile) => {
      const write = f.write.bind(f);
      f.write = (text: string) => {
        if (!depth) unlocked.push(f.name);
        write(text);
      };
      return f;
    };
    folder.createFile = (name, content, kind) => {
      if (!depth) unlocked.push(name);
      return watch(create(name, content, kind));
    };
    expect(s.send(session).ok).toBe(true);
    expect(s.send(intro).ok).toBe(true);
    const [a] = s.requests();
    expect(s.call('requests.decide', { id: a.id, decision: 'cancel', ...mail }).ok).toBe(true);
    s.gas.clock.now = NOW + REQUEST_KEEP_MS + 1;
    expect(s.requests()).toEqual([]);
    s.call('booking.setOpen', { open: false });
    handle(s.gas, JSON.stringify({ action: 'booking.waitlist', name: 'Elif Bekler', email: 'elif@example.com', phone: '0534 000 00 00', kinds: ['individual'], times: [], reason: '', consent: true, healthConsent: false, lang: 'tr' }));
    s.gas.clock.now += 91 * 24 * 3600 * 1000;
    expect(s.call<{ waiting: number }>('booking.state').data.waiting).toBe(0);
    s.call('waitlist.list');
    expect(unlocked).toEqual([]);
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

describe('Randevu ekle, e-mail check, sessions, closing booking and "Haber et" (backend)', () => {
  const codeIn = (body: string) => decodeURIComponent(body.match(/\?dogrula=([^\s]+)/)![1]);
  const manual = { kind: 'session', type: 'individual', day: '2026-10-22', time: '19:20', name: 'Osman Güneş Özkurt', email: 'Osman@Example.com', phone: '', lang: 'tr', note: '' };

  it('Randevu ekle confirms the time, keeps the person as approved, sends the e-mail with a check link; the link marks it checked', () => {
    const s = setup();
    const out = s.call<{ request: { id: string; status: string; source: string; email: string } }>('requests.add', { ...manual, mail });
    expect(out.ok).toBe(true);
    expect(out.data.request).toMatchObject({ status: 'approved', source: 'manual', email: 'osman@example.com' });
    expect(s.call<{ entries: { status: string }[] }>('calendar.list').data.entries.map((e) => e.status)).toEqual(['confirmed']);
    const sent = s.gas.mails.at(-1)!;
    expect(sent).toMatchObject({ to: 'osman@example.com', subject: 'Konu' });
    expect(sent.body).toContain('https://klinikterapist.com/randevu/?dogrula=');
    expect(handle(s.gas, JSON.stringify({ action: 'booking.verify', code: codeIn(sent.body) }))).toMatchObject({ ok: true });
    expect(s.requests()[0]).toMatchObject({ verified: true });
    // A forged code does nothing.
    expect(handle(s.gas, JSON.stringify({ action: 'booking.verify', code: `r:${out.data.request.id}.forged` }))).toMatchObject({ ok: false });
    // The same time again clashes.
    expect(s.call('requests.add', { ...manual, email: 'b@example.com' }).ok).toBe(false);
    expect(s.call('requests.add', { ...manual, email: 'not-an-email', day: '2026-10-23' }).ok).toBe(false);
  });

  it('the site acknowledgement carries the check link; the client it becomes is checked too', () => {
    const s = setup();
    s.send(session);
    const ack = s.gas.mails.find((m) => m.to === 'ayse@example.com')!;
    const id = s.requests()[0].id;
    s.call('requests.decide', { id, decision: 'approve', ...mail });
    s.call('requests.toClient', { id });
    handle(s.gas, JSON.stringify({ action: 'booking.verify', code: codeIn(ack.body) }));
    expect(s.call<{ clients: { contact: { verified?: boolean } }[] }>('clients.list').data.clients[0].contact.verified).toBe(true);
  });

  it('a cancelled weekly session frees its time on the site; a postponement takes the new one; a clash is refused', () => {
    const s = setup();
    s.send(session);
    const id = s.requests()[0].id;
    s.call('requests.decide', { id, decision: 'approve', ...mail });
    const c = s.call<{ client: { id: string } }>('requests.toClient', { id }).data.client;
    const busyAt = (t: string) => {
      s.gas.cache.put('booking.busy', '', 1);
      return bookingBusy(s.gas).busy.some((b) => b.start === at(t));
    };
    expect(busyAt('2026-10-29T19:20:00')).toBe(true);
    expect(s.call('clients.session', { id: c.id, op: 'mark', day: '2026-10-29', time: '19:20', status: 'cancelled', by: 'client' }).ok).toBe(true);
    expect(busyAt('2026-10-29T19:20:00')).toBe(false);
    const moved = s.call<{ client: { sessions: { kind: string; day: string }[] } }>('clients.session', { id: c.id, op: 'mark', day: '2026-11-05', time: '19:20', status: 'postponed', by: 'owner', newDay: '2026-11-06', newTime: '10:00' });
    expect(moved.ok).toBe(true);
    expect(moved.data.client.sessions).toContainEqual(expect.objectContaining({ kind: 'extra', day: '2026-11-06' }));
    expect(busyAt('2026-11-06T10:00:00')).toBe(true);
    // Into the weekly session of 12 November: a clash.
    expect(s.call('clients.session', { id: c.id, op: 'add', kind: 'extra', day: '2026-11-12', time: '19:50' })).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(s.call('clients.session', { id: c.id, op: 'add', kind: 'closing', day: '2026-11-13', time: '10:00' }).ok).toBe(true);
  });

  it('closing booking: the site hears it, requests are refused, "Haber et" fills the list; the owner writes and takes people off', () => {
    const s = setup();
    expect(s.call('booking.setOpen', { open: false }).ok).toBe(true);
    expect(bookingBusy(s.gas).closed).toBe(true);
    expect(s.send(session)).toMatchObject({ ok: false });
    const join = { action: 'booking.waitlist', name: 'Elif Bekler', email: 'elif@example.com', phone: '0534 000 00 00', kinds: ['individual'], times: ['weekend'], reason: 'İş stresi', consent: true, healthConsent: true, lang: 'tr' };
    expect(handle(s.gas, JSON.stringify({ ...join, healthConsent: false }))).toMatchObject({ ok: false });
    s.gas.mails.length = 0;
    expect(handle(s.gas, JSON.stringify(join))).toMatchObject({ ok: true });
    expect(s.gas.mails.map((m) => m.to)).toEqual(['merhaba@klinikterapist.com', 'elif@example.com']);
    expect(s.gas.mails[1].body).toContain('bekleme listeme aldım');
    expect(s.gas.root.findFolder('randevular')!.findFile('bekleme.json')!.read()).not.toContain('Elif');
    const list = () => s.call<{ entries: { id: string; offeredAt?: number; verified?: boolean }[] }>('waitlist.list').data.entries;
    expect(s.call<{ open: boolean; waiting: number }>('booking.state').data).toEqual({ open: false, waiting: 1 });
    handle(s.gas, JSON.stringify({ action: 'booking.verify', code: codeIn(s.gas.mails[1].body) }));
    expect(list()[0].verified).toBe(true);
    const wid = list()[0].id;
    expect(s.call('waitlist.mail', { id: wid, ...mail }).ok).toBe(true);
    expect(list()[0].offeredAt).toBe(NOW);
    expect(s.call('waitlist.mail', { id: wid, ...mail, remove: true }).ok).toBe(true);
    expect(list()).toEqual([]);
    s.call('booking.setOpen', { open: true });
    expect(bookingBusy(s.gas).closed).toBe(false);
    expect(s.send(session).ok).toBe(true);
  });
});

describe("The client's own page (tracking.ts)", () => {
  type Res = { ok: boolean; data?: Record<string, unknown> };
  /** A couples client with weekly sessions on Thursdays 19:20 from 22 October (NOW is Tuesday 20 October, 10:00). */
  function withClient() {
    const s = setup();
    s.send(session);
    const id = s.requests()[0].id;
    s.call('requests.decide', { id, decision: 'approve', ...mail });
    const cid = s.call<{ client: { id: string } }>('requests.toClient', { id }).data.client.id;
    const link = s.call<{ link: string }>('clients.link', { id: cid }).data.link;
    const code = link.split('#k=')[1];
    const pub = (action: string, p: Record<string, unknown> = {}) => handle(s.gas, JSON.stringify({ action, ...p })) as Res;
    const client = () =>
      s.call<{ clients: { sessions: { day: string; status: string; by?: string; note?: string; late?: boolean; time?: string }[]; endAsked?: { note?: string } }[] }>('clients.list').data.clients[0];
    return { ...s, cid, link, code, pub, client };
  }

  it('the link opens the next sessions without the name, the e-mail or the notes', () => {
    const t = withClient();
    expect(t.link).toMatch(/^https:\/\/klinikterapist\.com\/randevum\/#k=[\w-]+\.[\w-]{32}$/);
    t.call('clients.session', { id: t.cid, op: 'mark', day: '2026-10-29', time: '19:20', status: 'cancelled', by: 'owner', note: 'Özel not' });
    const out = t.pub('track.view', { code: t.code });
    expect(out.ok).toBe(true);
    const text = JSON.stringify(out);
    for (const secret of ['Ayşe', 'ayse@example.com', 'Özel not', 'KT001']) expect(text).not.toContain(secret);
    expect((out.data!.next as unknown[]).slice(0, 2)).toEqual([
      expect.objectContaining({ day: '2026-10-22', status: 'planned', late: false }),
      expect.objectContaining({ day: '2026-10-29', status: 'cancelled', by: 'owner' }),
    ]);
  });

  it('a wrong or renewed code tells nothing; 30 wrong codes in an hour close the page for the hour', () => {
    const t = withClient();
    const view = (code: string) => t.pub('track.view', { code });
    expect(view(`${t.cid}.${'A'.repeat(32)}`)).toMatchObject({ ok: false, data: { reason: 'link' } });
    const renewed = t.call<{ link: string }>('clients.link', { id: t.cid, renew: true }).data.link;
    expect(renewed).not.toBe(t.link);
    expect(view(t.code)).toMatchObject({ ok: false, data: { reason: 'link' } });
    const fresh = renewed.split('#k=')[1];
    expect(view(fresh).ok).toBe(true);
    for (let i = 0; i < 28; i++) view('nonsense');
    expect(view(fresh)).toMatchObject({ ok: false, data: { reason: 'busy' } });
    t.gas.clock.now += 3600 * 1000;
    expect(view(fresh).ok).toBe(true);
  });

  it('cancelling a session 24 hours or more ahead marks it "danışan istedi", frees the time and tells the owner', () => {
    const t = withClient();
    t.gas.mails.length = 0;
    expect(t.pub('track.ask', { code: t.code, ask: 'cancel', day: '2026-10-29', time: '19:20', note: 'Hastayım' }).ok).toBe(true);
    expect(t.client().sessions).toContainEqual(expect.objectContaining({ day: '2026-10-29', status: 'cancelled', by: 'client', note: 'Hastayım' }));
    expect(t.gas.mails).toEqual([
      expect.objectContaining({ to: 'merhaba@klinikterapist.com', replyTo: 'ayse@example.com' }),
      expect.objectContaining({ to: 'ayse@example.com', replyTo: 'merhaba@klinikterapist.com', subject: 'Seansınız iptal edildi – klinikterapist.com' }),
    ]);
    expect(t.gas.mails[0].subject).toContain('KT001AY seansını iptal etti');
    expect(t.gas.mails[0].body).toContain('Hastayım');
    // E1: the client's own copy is fixed text: the date, the page link; not their note, no fee line.
    expect(t.gas.mails[1].body).toContain('29 Ekim 2026, Perşembe, 19.20 seansınız');
    expect(t.gas.mails[1].body).toContain('https://klinikterapist.com/randevum/#k=');
    expect(t.gas.mails[1].body).not.toContain('Hastayım');
    expect(t.gas.mails[1].body).not.toContain('ücretinin tamamı');
    t.gas.cache.put('booking.busy', '', 1);
    expect(bookingBusy(t.gas).busy.some((b) => b.start === at('2026-10-29T19:20:00'))).toBe(false);
  });

  it('less than 24 hours before: refused until the full-fee warning is accepted; then done, marked late, and the owner is told', () => {
    const t = withClient();
    t.gas.clock.now = at('2026-10-21T19:30:00'); // 23 h 50 min before 22 October 19:20
    expect((t.pub('track.view', { code: t.code }).data!.next as { late: boolean }[])[0].late).toBe(true);
    expect(t.pub('track.ask', { code: t.code, ask: 'cancel', day: '2026-10-22', time: '19:20' })).toMatchObject({ ok: false, data: { reason: 'late' } });
    expect(t.client().sessions).toEqual([]);
    t.gas.mails.length = 0;
    expect(t.pub('track.ask', { code: t.code, ask: 'cancel', day: '2026-10-22', time: '19:20', lateOk: true }).ok).toBe(true);
    expect(t.client().sessions).toContainEqual(expect.objectContaining({ day: '2026-10-22', status: 'cancelled', by: 'client', late: true }));
    expect(t.gas.mails[0].subject).toContain('iptal etti (24 saatten az kala)');
    expect(t.gas.mails[0].body).toContain('seans ücretinin tamamının ödeneceğini');
    expect(t.gas.mails[1]).toMatchObject({ to: 'ayse@example.com' });
    expect(t.gas.mails[1].body).toContain('seans ücretinin tamamı ödenir');
    // Not one of their sessions.
    expect(t.pub('track.ask', { code: t.code, ask: 'cancel', day: '2026-10-30', time: '19:20' })).toMatchObject({ ok: false, data: { reason: 'gone' } });
  });

  it('postponing moves the session to a free time of the booking calendar; a taken or made-up time is refused; asking to end marks the client', () => {
    const t = withClient();
    const cfg = parseBooking(JSON.parse(readFileSync('src/data/booking.json', 'utf8')));
    const view = t.pub('track.view', { code: t.code }).data as unknown as TrackView;
    expect(view).toMatchObject({ since: '2026-10-22', minutes: 60, stats: expect.objectContaining({ held: 0 }) });
    // A free time a week on, and one in the calendar on that day that someone else takes.
    const day = '2026-11-03';
    const times = freeTimes(cfg, view, { day: '2026-10-29', time: '19:20' }, day, NOW);
    const [free, other] = [times[0], times.at(-1)!];
    expect(free && other).toBeTruthy();
    t.call('calendar.add', { day, time: other, kind: 'session', type: 'individual' });
    expect(t.pub('track.ask', { code: t.code, ask: 'postpone', day: '2026-10-29', time: '19:20', newDay: day, newTime: other })).toMatchObject({ ok: false, data: { reason: 'taken' } });
    expect(t.pub('track.ask', { code: t.code, ask: 'postpone', day: '2026-10-29', time: '19:20', newDay: day, newTime: '03:00' })).toMatchObject({ ok: false, data: { reason: 'taken' } });
    t.gas.mails.length = 0;
    const out = t.pub('track.ask', { code: t.code, ask: 'postpone', day: '2026-10-29', time: '19:20', newDay: day, newTime: free });
    expect(out.ok).toBe(true);
    expect(t.client().sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ day: '2026-10-29', status: 'postponed', by: 'client' }),
        expect.objectContaining({ day, time: free, kind: 'extra', status: 'planned' }),
      ]),
    );
    expect(t.client().sessions.find((x) => x.day === '2026-10-29')).not.toHaveProperty('late');
    expect(t.gas.mails[0].subject).toContain('KT001AY seansını erteledi');
    expect(t.gas.mails[1]).toMatchObject({ to: 'ayse@example.com', subject: 'Seansınız ertelendi – klinikterapist.com' });
    t.gas.cache.put('booking.busy', '', 1);
    const busy = bookingBusy(t.gas).busy;
    expect(busy.some((b) => b.start === at(`${day}T${free}:00`))).toBe(true);
    expect(busy.some((b) => b.start === at('2026-10-29T19:20:00'))).toBe(false);
    // Each change sends two e-mails (the owner's and the client's copy): at most five an hour per address.
    t.gas.clock.now += 3600 * 1000;
    expect(t.pub('track.ask', { code: t.code, ask: 'end', note: 'Kendimi iyi hissediyorum' }).ok).toBe(true);
    expect(t.client().endAsked).toMatchObject({ note: 'Kendimi iyi hissediyorum' });
    expect(t.gas.mails.at(-2)!.subject).toContain('terapiyi sonlandırmak istiyor');
    expect(t.gas.mails.at(-1)!).toMatchObject({ to: 'ayse@example.com', subject: 'İsteğiniz bana ulaştı – klinikterapist.com' });
  });

  it('the owner sends the link from the panel; ending therapy kills it', () => {
    const t = withClient();
    t.gas.mails.length = 0;
    expect(t.call('clients.linkMail', { id: t.cid, subject: 'Randevu sayfanız', body: `Bağlantı: ${t.link}` }).ok).toBe(true);
    expect(t.gas.mails).toEqual([expect.objectContaining({ to: 'ayse@example.com', subject: 'Randevu sayfanız' })]);
    t.call('clients.end', { id: t.cid, mode: 'delete' });
    expect(t.pub('track.view', { code: t.code })).toMatchObject({ ok: false, data: { reason: 'link' } });
  });
});

describe('H1: the panel’s own bookings respect the clients’ sessions', () => {
  /** KT001AY: couples therapy every Thursday 19:20 from 22 October. */
  function withWeekly() {
    const s = setup();
    s.send(session);
    const id = s.requests()[0].id;
    s.call('requests.decide', { id, decision: 'approve', ...mail });
    s.call('requests.toClient', { id });
    return s;
  }
  const manual = { kind: 'session', type: 'individual', name: 'Elif Deneme', email: 'elif@example.com', phone: '', lang: 'tr', note: '' };

  it('Randevu ekle and takvime ekle refuse a client’s weekly time and name the client', () => {
    const s = withWeekly();
    const added = s.call('requests.add', { ...manual, day: '2026-10-29', time: '19:20' });
    expect(added).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(added.error!.message).toContain('KT001AY');
    expect(s.call('calendar.add', { day: '2026-10-29', time: '19:50', kind: 'session', type: 'individual' })).toMatchObject({ ok: false, error: { code: 'conflict' } });
    // A free time still works.
    expect(s.call('requests.add', { ...manual, day: '2026-10-30', time: '10:00' }).ok).toBe(true);
  });

  it('approving a waiting request refuses a time a client took after it came', () => {
    const s = setup();
    s.send({ ...session, day: '2026-11-05' }); // waiting: Thursday 5 November 19:20
    const late = s.requests()[0].id;
    s.call('requests.add', { ...manual, kind: 'session', type: 'couple', day: '2026-10-22', time: '19:20' });
    const first = s.requests().find((r) => r.id !== late)!.id;
    expect(s.call('requests.toClient', { id: first }).ok).toBe(true); // weekly Thursdays 19:20 from 22 October
    expect(s.call('requests.decide', { id: late, decision: 'approve', ...mail })).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(s.requests().find((r) => r.id === late)!.status).toBe('pending');
  });

  it('Seans takibe geçir refuses a weekly time that falls on another client’s session', () => {
    const s = withWeekly();
    s.send(intro);
    const id = s.requests().find((r) => r.status === 'pending')!.id;
    s.call('requests.decide', { id, decision: 'approve', ...mail });
    expect(s.call('requests.toClient', { id, weekday: 4, time: '19:20', since: '2026-11-05' })).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(s.call('requests.toClient', { id, weekday: 4, time: '10:00', since: '2026-11-05' }).ok).toBe(true);
  });
});

describe('E4: an approved request keeps its person until its appointment has passed', () => {
  it('a booking six weeks ahead is not deleted at 30 days; after the appointment it goes with its calendar entry', () => {
    const s = setup();
    s.send({ ...session, day: '2026-11-26' }); // Thursday 26 November 19:20, 37 days ahead
    const id = s.requests()[0].id;
    s.call('requests.decide', { id, decision: 'approve', ...mail });
    s.gas.clock.now = NOW + REQUEST_KEEP_MS + 1;
    expect(s.requests()).toEqual([expect.objectContaining({ id, status: 'approved' })]);
    const entries = () => s.call<{ entries: { status: string }[] }>('calendar.list').data.entries;
    expect(entries()).toHaveLength(1);
    s.gas.clock.now = at('2026-11-27T20:30:00');
    expect(s.requests()).toEqual([]);
    expect(s.gas.root.findFolder('randevular')!.findFile('takvim.json')!.read()).not.toContain('"confirmed"');
  });
});

describe('E3: the owner hears of a hold running out', () => {
  it('after 20 hours one e-mail lists the undecided requests, each only once; decided ones are left out', async () => {
    const s = setup();
    s.send(session);
    s.send(intro);
    const [, decided] = s.requests();
    s.call('requests.decide', { id: decided.id, decision: 'approve', ...mail });
    s.gas.mails.length = 0;
    s.gas.clock.now = NOW + 19 * 3600 * 1000;
    await runHourly(s.gas);
    expect(s.gas.mails).toEqual([]);
    s.gas.clock.now = NOW + 21 * 3600 * 1000;
    await runHourly(s.gas);
    expect(s.gas.mails).toEqual([expect.objectContaining({ to: 'merhaba@klinikterapist.com', subject: '[klinikterapist] Bir talebin tutma süresi doluyor' })]);
    expect(s.gas.mails[0].body).toContain('Ayşe Yılmaz · Seans randevusu (Çift terapisi) · 22 Ekim 2026, Perşembe, 19.20 · tutma 3 sa 0 dk sonra bitiyor');
    expect(s.gas.mails[0].body).not.toContain('ön görüşme');
    await runHourly(s.gas);
    expect(s.gas.mails).toHaveLength(1);
  });
});
