import { describe, it, expect } from 'vitest';
import { handle } from '../../../apps-script/src/main';
import { CONTACT_RATE, normaliseEmail } from '../../../apps-script/src/contact';
import { CONTACT_TOPICS, validateContact } from '../../../src/lib/contact-form';
import { fakeGas } from './fake-gas';

const props = { GOOGLE_CLIENT_ID: 'c', OWNER_EMAIL: 'merhaba@klinikterapist.com' };
const valid = {
  action: 'contact.send',
  name: 'Ayşe Yılmaz',
  email: 'Ayse@Example.com',
  topic: 'collaboration',
  message: 'Merhaba, bir iş birliği önerim var.',
  consent: true,
  lang: 'tr',
};
const send = (gas: ReturnType<typeof fakeGas>, extra: Record<string, unknown> = {}) => handle(gas, JSON.stringify({ ...valid, ...extra }));

describe('contact.send', () => {
  it('needs no session and mails the owner once, replying to the visitor', () => {
    const gas = fakeGas({ props });
    expect(send(gas)).toEqual({ ok: true, data: { sent: true } });
    expect(gas.mails).toHaveLength(1);
    const m = gas.mails[0];
    expect(m.to).toBe('merhaba@klinikterapist.com');
    expect(m.replyTo).toBe('ayse@example.com');
    expect(m.subject).toBe('İş birliği – Ayşe Yılmaz');
    expect(m.body).toContain('– Ad soyad: Ayşe Yılmaz');
    expect(m.body).toContain('– E-posta: ayse@example.com');
    expect(m.body).toContain('– Konu: İş birliği');
    expect(m.body).toContain('Merhaba, bir iş birliği önerim var.');
  });

  it('uses the owner address from the script properties', () => {
    const gas = fakeGas({ props: { ...props, OWNER_EMAIL: ' sahibi@example.com ' } });
    send(gas);
    expect(gas.mails[0].to).toBe('sahibi@example.com');
    const unset = fakeGas({ props: {} });
    expect(send(unset)).toMatchObject({ ok: false, error: { code: 'internal' } });
    expect(unset.mails).toHaveLength(0);
  });

  it('subject topic is the Turkish label for every fixed topic; an unknown topic is refused', () => {
    for (const t of CONTACT_TOPICS) {
      const gas = fakeGas({ props });
      send(gas, { topic: t.id });
      expect(gas.mails[0].subject).toBe(`${t.tr} – Ayşe Yılmaz`);
    }
    for (const topic of ['appointment', 'Genel mesaj', '', 'toString', '__proto__']) {
      const gas = fakeGas({ props });
      expect(send(gas, { topic }), topic).toMatchObject({ ok: false, error: { code: 'bad_request' } });
      expect(gas.mails).toHaveLength(0);
    }
  });

  it('validates every field on the server', () => {
    const bad: Record<string, unknown>[] = [
      { name: '' },
      { name: '   ' },
      { name: 'a'.repeat(101) },
      { email: 'not-an-email' },
      { email: 'a@b' },
      { email: '' },
      { message: 'kısa' },
      { message: '         x' },
      { message: 'a'.repeat(5001) },
      { consent: false },
      { consent: 'true' },
      { name: 42 },
      { message: ['dizi'] },
    ];
    for (const extra of bad) {
      const gas = fakeGas({ props });
      expect(send(gas, extra), JSON.stringify(extra).slice(0, 60)).toMatchObject({ ok: false, error: { code: 'bad_request' } });
      expect(gas.mails).toHaveLength(0);
    }
    const edge = fakeGas({ props });
    expect(send(edge, { name: 'a'.repeat(100), message: 'b'.repeat(5000) }).ok).toBe(true);
    expect(send(edge, { message: '0123456789' }).ok).toBe(true);
  });

  it('a filled honeypot (hp_field) is answered like a success but sends nothing', () => {
    const gas = fakeGas({ props });
    expect(send(gas, { hp_field: 'http://spam.example' })).toEqual({ ok: true, data: { sent: true } });
    expect(gas.mails).toHaveLength(0);
    // The old, autofill-prone name is just an unknown field now.
    expect(send(gas, { website: 'https://example.com' }).ok).toBe(true);
    expect(gas.mails).toHaveLength(1);
  });

  it('newlines in the name never reach the subject line', () => {
    const gas = fakeGas({ props });
    send(gas, { name: 'Ayşe\r\nBcc: x@y.com' });
    expect(gas.mails[0].subject).toBe('İş birliği – Ayşe Bcc: x@y.com');
    expect(gas.mails[0].subject).not.toMatch(/[\r\n]/);
  });

  /** 10:15 UTC: a quarter past a clock hour, so the window boundary is 45 minutes ahead. */
  const quarterPast = Date.UTC(2026, 9, 17, 10, 15);

  it(`limits one address to ${CONTACT_RATE.perEmail} per clock hour (fixed window), then frees it`, () => {
    const gas = fakeGas({ props, now: quarterPast });
    for (let i = 0; i < CONTACT_RATE.perEmail; i++) {
      expect(send(gas).ok).toBe(true);
      gas.clock.now += 5 * 60 * 1000; // spread over the hour: a refreshed TTL would not matter
    }
    const res = send(gas, { email: 'AYSE@example.com' });
    expect(res).toMatchObject({ ok: false, error: { code: 'bad_request' } });
    if (!res.ok) expect(res.error.message).toContain('daha sonra');
    expect(gas.mails).toHaveLength(CONTACT_RATE.perEmail);
    // Another visitor still gets through.
    expect(send(gas, { email: 'baska@example.com' }).ok).toBe(true);
    // 10:59: still the same window.
    gas.clock.now = Date.UTC(2026, 9, 17, 10, 59);
    expect(send(gas).ok).toBe(false);
    // 11:00: a new window, although the last send was a minute ago.
    gas.clock.now = Date.UTC(2026, 9, 17, 11, 0);
    expect(send(gas).ok).toBe(true);
  });

  it('one mailbox written differently shares the per-address limit', () => {
    const gas = fakeGas({ props, now: quarterPast });
    const forms = ['ayse.yilmaz@gmail.com', 'AyseYilmaz@gmail.com', 'ayse.yilmaz+form@gmail.com', 'a.y.s.e.yilmaz@googlemail.com', 'ayseyilmaz+x@GMAIL.com'];
    for (const email of forms) expect(send(gas, { email }).ok, email).toBe(true);
    expect(send(gas, { email: 'ayseyilmaz@gmail.com' }).ok).toBe(false);
    // Dots matter outside Gmail.
    expect(send(gas, { email: 'a.b@example.com' }).ok).toBe(true);
    expect(normaliseEmail('A.B+tag@Example.com')).toBe('a.b@example.com');
    expect(normaliseEmail('a.b+tag@googlemail.com')).toBe('ab@gmail.com');
  });

  it('a very long address works: the cache key is a short hash, never the address', () => {
    const gas = fakeGas({ props, now: quarterPast });
    const keys: string[] = [];
    const put = gas.cache.put;
    gas.cache.put = (k, v, ttl) => {
      keys.push(k);
      put(k, v, ttl);
    };
    const long = `${'a'.repeat(64)}@${'b'.repeat(180)}.com`;
    expect(long.length).toBeGreaterThan(240);
    expect(send(gas, { email: long }).ok).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      expect(k.length).toBeLessThanOrEqual(250);
      expect(k).not.toContain('@');
    }
  });

  it(`caps the whole site at ${CONTACT_RATE.globalHour} per clock hour`, () => {
    const gas = fakeGas({ props, now: quarterPast });
    for (let i = 0; i < CONTACT_RATE.globalHour; i++) expect(send(gas, { email: `k${i}@example.com` }).ok).toBe(true);
    expect(send(gas, { email: 'yeni@example.com' }).ok).toBe(false);
    expect(gas.mails).toHaveLength(CONTACT_RATE.globalHour);
    gas.clock.now = Date.UTC(2026, 9, 17, 11, 0);
    expect(send(gas, { email: 'yeni@example.com' }).ok).toBe(true);
  });

  it(`caps the whole site at ${CONTACT_RATE.globalDay} per UTC day`, () => {
    const gas = fakeGas({ props, now: Date.UTC(2026, 9, 17, 0, 5) });
    let sent = 0;
    for (let h = 0; sent < CONTACT_RATE.globalDay; h++) {
      gas.clock.now = Date.UTC(2026, 9, 17, h, 5);
      for (let i = 0; i < 40 && sent < CONTACT_RATE.globalDay; i++, sent++) {
        expect(send(gas, { email: `d${sent}@example.com` }).ok).toBe(true);
      }
    }
    gas.clock.now = Date.UTC(2026, 9, 17, 23, 30);
    expect(send(gas, { email: 'gec@example.com' }).ok).toBe(false);
    expect(gas.mails).toHaveLength(CONTACT_RATE.globalDay);
    gas.clock.now = Date.UTC(2026, 9, 18, 0, 1);
    expect(send(gas, { email: 'gec@example.com' }).ok).toBe(true);
  });

  it('a blocked address does not use up the site-wide allowance', () => {
    const gas = fakeGas({ props, now: quarterPast });
    for (let i = 0; i < CONTACT_RATE.perEmail; i++) send(gas);
    for (let i = 0; i < 100; i++) expect(send(gas).ok).toBe(false);
    for (let i = 0; i < CONTACT_RATE.globalHour - CONTACT_RATE.perEmail; i++) {
      expect(send(gas, { email: `k${i}@example.com` }).ok).toBe(true);
    }
  });

  it('a refused send does not use up the allowance (validation runs first)', () => {
    const gas = fakeGas({ props });
    for (let i = 0; i < 10; i++) send(gas, { message: 'kısa' });
    for (let i = 0; i < CONTACT_RATE.perEmail; i++) expect(send(gas).ok).toBe(true);
  });

  it('the panel actions still need a session', () => {
    const gas = fakeGas({ props });
    expect(handle(gas, JSON.stringify({ action: 'site.tree' }))).toMatchObject({ ok: false, error: { code: 'unauthorized' } });
  });
});

describe('validateContact (shared by the form and the backend)', () => {
  const ok = { name: 'Ali', email: 'ali@example.com', topic: 'general', message: 'En az on karakter.', consent: true };
  it('accepts a complete form', () => {
    expect(validateContact(ok)).toEqual({});
  });
  it('names each problem', () => {
    expect(validateContact({ name: '', email: 'x', topic: '', message: 'kısa', consent: false })).toEqual({
      name: 'required',
      email: 'invalid',
      topic: 'required',
      message: 'tooShort',
      consent: 'required',
    });
    expect(validateContact({ ...ok, name: 'a'.repeat(101), message: 'a'.repeat(5001), topic: 'x' })).toEqual({
      name: 'tooLong',
      message: 'tooLong',
      topic: 'invalid',
    });
    expect(validateContact({ ...ok, email: '' })).toEqual({ email: 'required' });
  });
  it('has the seven fixed topics in order, without an appointment topic', () => {
    expect(CONTACT_TOPICS.map((t) => t.tr)).toEqual([
      'Genel mesaj', 'İstek ve öneri', 'Şikâyet', 'İş birliği', 'Reklam ve sponsorluk', 'Basın ve röportaj', 'Diğer',
    ]);
    expect(CONTACT_TOPICS.map((t) => t.en)).toEqual([
      'General message', 'Request or suggestion', 'Complaint', 'Collaboration', 'Advertising and sponsorship', 'Press and interviews', 'Other',
    ]);
  });
});
