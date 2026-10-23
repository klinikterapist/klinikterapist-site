import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { handle } from '../../../apps-script/src/main';
import { CONTACT_RATE } from '../../../apps-script/src/contact';
import { fakeGas } from './fake-gas';
import { FakeGitHub } from './fake-github';
import { ghProps } from './publish-fixtures';

const NOW = Date.parse('2026-10-20T10:00:00+03:00');

function setup(props: Record<string, string> = { OWNER_EMAIL: 'merhaba@klinikterapist.com' }) {
  // English booking open too, so the English acknowledgement can be checked (it starts closed).
  const booking = { ...JSON.parse(readFileSync('src/data/booking.json', 'utf8')), intake: { tr: true, en: true } };
  const gh = new FakeGitHub({ 'src/data/booking.json': JSON.stringify(booking) });
  const gas = fakeGas({ props: { ...ghProps, ...props }, routes: [gh.route], now: NOW });
  const send = (p: Record<string, unknown>) => handle(gas, JSON.stringify({ action: 'booking.request', ...p }));
  return { gas, gh, send };
}

const session = {
  kind: 'session', type: 'couple', day: '2026-10-22', time: '15:00', name: 'Ayşe Yılmaz', email: 'Ayse@Example.com', phone: '0532 123 45 67', note: 'Akşamları daha uygun.', consent: true, lang: 'tr',
};
const intro = {
  kind: 'intro', day: '2026-10-24', time: '12:00', name: 'Ali Kaya', email: 'ali@example.com', phone: '05321234567', note: '', consent: true,
  forWhom: 'couple', topics: [2, 11], before: 'yes', age: 3, healthConsent: true, lang: 'en',
};

describe('booking.request', () => {
  it('a session request e-mails the owner everything and the visitor a fixed acknowledgement', () => {
    const { gas, send } = setup();
    expect(send(session)).toEqual({ ok: true, data: { sent: true } });
    expect(gas.mails).toHaveLength(2);
    const [owner, visitor] = gas.mails;
    expect(owner).toMatchObject({ to: 'merhaba@klinikterapist.com', replyTo: 'ayse@example.com' });
    expect(owner.subject).toBe('Randevu talebi – Ayşe Yılmaz – 22 Ekim 2026, Perşembe, 15.00');
    expect(owner.body).toContain('Görüşme türü: Çift terapisi');
    expect(owner.body).toContain('Telefon: 0532 123 45 67');
    expect(owner.body).toContain('■ Danışanın notu\n\nAkşamları daha uygun.');
    expect(visitor).toMatchObject({ to: 'ayse@example.com', replyTo: 'merhaba@klinikterapist.com', subject: 'Randevu talebiniz alındı – klinikterapist.com' });
    expect(visitor.body).toContain('– Görüşme türü: Çift terapisi\n– Tarih ve saat: 22 Ekim 2026, Perşembe, 15.00 (Türkiye saati)\n– Süre ve biçim: 60 dakika, online');
    expect(visitor.body).toMatch(/Saygılarımla,\nOsman Güneş Özkurt\nKlinik Psikolog\nklinikterapist\.com$/);
    // Nothing the visitor typed reaches the acknowledgement.
    expect(visitor.body).not.toContain('Ayşe');
    expect(visitor.body).not.toContain('Akşamları');
    // Nothing about the person is stored: the calendar keeps the time, length and kind only.
    const calendar = gas.root.findFolder('randevular')!.findFile('takvim.json')!.read();
    expect(JSON.parse(calendar).entries).toEqual([
      { id: expect.any(String), start: Date.parse('2026-10-22T15:00:00+03:00'), minutes: 60, kind: 'session', type: 'couple', status: 'hold', holdUntil: NOW + 24 * 3600e3 },
    ]);
    expect(calendar).not.toMatch(/Ayşe|ayse|0532|Akşam/);
    expect(owner.body).toContain('→ Randevu Talepleri ekranını aç: https://klinikterapist.com/admin/#/randevular');
    expect(owner.body).toContain('– Başvuru tarihi: 20 Ekim 2026, Salı, 10.00 (Türkiye saati)');
  });

  it('an intro request lists the topics and age range for the owner; the acknowledgement follows the page language', () => {
    const { gas, send } = setup();
    expect(send(intro).ok).toBe(true);
    const [owner, visitor] = gas.mails;
    expect(owner.body).toContain('Belirttiği konular:\n\n– İlişki sorunları\n– Görüşmede konuşmayı tercih ederim');
    expect(owner.body).toContain('– Yaş aralığı: 35–44');
    expect(owner.body).toContain('– Başvuru: Eşi veya partneriyle birlikte');
    expect(owner.body).toContain('Konuşma dili: İngilizce');
    expect(visitor.subject).toBe('Your request has been received – klinikterapist.com');
    expect(visitor.body).toContain('Free intro call, Saturday 24 October 2026, 12:00');
    expect(visitor.body).not.toContain('İlişki');
    // Asked since 2026-10-22: a form sent before then says "Belirtmedi".
    expect(owner.body).toContain('– Yaşadığı ülke: Belirtmedi');
  });

  it('an intro request says how the call is held, to the owner and in the acknowledgement (owner, 2026-10-23)', () => {
    const { gas, send } = setup();
    expect(send({ ...intro, via: 'phone', lang: 'tr' }).ok).toBe(true);
    const [owner, visitor] = gas.mails;
    expect(owner.body).toContain('– Görüşme şekli: Telefonla (danışanı siz arayacaksınız)');
    expect(visitor.body).toContain('– Görüşme biçimi: Telefonla (sizi ben ararım)');
    expect(visitor.body).toContain('telefon numarasından arayacağım');
    expect(visitor.body).not.toContain('0532');
    const other = setup();
    expect(other.send({ ...intro, via: 'video' }).ok).toBe(true);
    expect(other.gas.mails[0].body).toContain('– Görüşme şekli: Görüntülü görüşme');
    expect(other.gas.mails[1].body).toContain('a video call');
  });

  it('a session note comes with its explicit consent; without it the request is refused (owner’s note 2026-10-22)', () => {
    const { gas, send } = setup();
    expect(send({ ...session, healthConsent: true }).ok).toBe(true);
    expect(gas.mails[0].body).toContain('– Not için açık rıza: Verildi');
    const other = setup();
    expect(other.send({ ...session, healthConsent: false }).ok).toBe(false);
  });

  it('the intro call keeps where the person lives and tells the owner; an unknown country is refused', () => {
    const { gas, send } = setup();
    expect(send({ ...intro, country: 'DE', phone: '+49 15112345678' }).ok).toBe(true);
    expect(gas.mails[0].body).toContain('– Yaşadığı ülke: Almanya');
    expect(gas.mails[0].body).toContain('Telefon: +49 15112345678');
    const other = setup();
    expect(other.send({ ...intro, country: 'XX' })).toMatchObject({ ok: false, error: { message: 'Formdaki bilgiler eksik ya da hatalı. Lütfen kontrol edip tekrar deneyin.' } });
  });

  it('the session form asks where the person lives too, and a name typed in lower case gets capitals (owner’s review 2026-10-23)', () => {
    const { gas, send } = setup();
    expect(send({ ...session, name: 'ayşe ilkay yılmaz', country: 'NL', healthConsent: true }).ok).toBe(true);
    const [owner] = gas.mails;
    expect(owner.subject).toBe('Randevu talebi – Ayşe İlkay Yılmaz – 22 Ekim 2026, Perşembe, 15.00');
    expect(owner.body).toContain('– Ad soyad: Ayşe İlkay Yılmaz');
    expect(owner.body).toContain('– Yaşadığı ülke: Hollanda');
    const other = setup();
    expect(other.send({ ...session, country: 'XX', healthConsent: true }).ok).toBe(false);
  });

  it('a time that is not free says so; other bad input is refused as a whole', () => {
    const { gas, send } = setup();
    const taken = send({ ...session, time: '09:00' });
    expect(taken).toMatchObject({ ok: false, error: { code: 'bad_request', message: 'Seçtiğiniz saat artık uygun değil. Lütfen başka bir saat seçin.' }, data: { reason: 'taken' } });
    expect(send({ ...session, consent: false })).toMatchObject({ ok: false, error: { message: 'Formdaki bilgiler eksik ya da hatalı. Lütfen kontrol edip tekrar deneyin.' } });
    expect(send({ ...intro, healthConsent: false }).ok).toBe(false);
    expect(gas.mails).toHaveLength(0);
  });

  it('a filled honeypot looks sent and sends nothing', () => {
    const { gas, send } = setup();
    expect(send({ ...session, hp_field: 'bot' })).toEqual({ ok: true, data: { sent: true } });
    expect(gas.mails).toHaveLength(0);
  });

  it('counts two e-mails per request against the contact form limits', () => {
    const { gas, send } = setup();
    const perEmail = Math.floor(CONTACT_RATE.perEmail / 2);
    // Different free times: a request holds its time, so the same time twice would be taken.
    const times = ['10:00', '13:30', '16:30', '18:00'];
    for (let i = 0; i < perEmail; i++) expect(send({ ...session, time: times[i] }).ok).toBe(true);
    expect(send({ ...session, time: times[perEmail] })).toMatchObject({ ok: false, error: { code: 'bad_request', message: expect.stringContaining('çok fazla') } });
    expect(gas.mails).toHaveLength(perEmail * 2);
  });

  it('without OWNER_EMAIL it says the form is not set up', () => {
    const { send } = setup({});
    expect(send(session)).toMatchObject({ ok: false, error: { code: 'internal', message: 'Randevu formu henüz kurulmadı. Lütfen doğrudan e-posta gönderin.' } });
  });

  it('reads booking.json from the repository once per 10 minutes', () => {
    const { gas, send } = setup();
    send(session);
    const reads = gas.calls.length;
    send({ ...session, email: 'baska@example.com' });
    expect(gas.calls.length).toBe(reads);
  });
});
