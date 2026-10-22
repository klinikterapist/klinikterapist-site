/**
 * The closing session's wait, hourly (src/lib/closing.ts, owner's decisions 2026-10-22): a day
 * before the time to pick ends, the client gets a reminder and the owner a note; when it has ended
 * with no time picked, the client's next planned session at least a day ahead becomes the free,
 * 30-minute closing session, and both get an e-mail (the owner's says so when there was none).
 * A closing session picked on the page or added by the owner just ends the wait.
 */
import type { Gas, MailMessage } from './gas';
import { readItems, writeItems } from './store';
import { CLIENTS, type StoredClient } from './requests';
import { trackLink } from './tracking';
import { PANEL_URL, SENDER_NAME } from './text';
import { logEvent, shortWhen } from './events';
import { asSender, notifyTo } from './mailboxes';
import { formatDay } from '../../src/lib/booking-form';
import { closingDay, closingStep, closingTarget, convertToClosing } from '../../src/lib/closing';
import { mailTr } from '../../src/lib/mail-texts';
import { whenVars } from '../../src/lib/mail-vars';

const SIGN_EN = ['Kind regards,', 'Osman Güneş Özkurt', 'Clinical Psychologist', 'klinikterapist.com'];

type Mail = { subject: string; body: string };
type When = { day: string; time: string };

const atEn = (s: When) => `${formatDay(s.day, 'en')}, at ${s.time.replace(':', '.')}`;

function reminderMail(gas: Gas, c: StoredClient, lastDay: string, target: When | undefined): Mail {
  const link = trackLink(gas, c);
  if (c.contact.lang === 'en') {
    return {
      subject: 'Picking a time for our closing session – klinikterapist.com',
      body: [
        `Dear ${c.contact.name.trim()},`,
        '',
        `A gentle reminder that the day and time of our closing session have not been picked yet. You can pick them on your appointment page until the end of ${formatDay(lastDay, 'en')}: ${link}`,
        ...(target ? [`If no time is picked by then, I will plan your session on ${atEn(target)} (Turkey time) as the free closing session of 25–30 minutes.`] : []),
        '',
        ...SIGN_EN,
      ].join('\n'),
    };
  }
  return mailTr('oto.sonlandirma-hatirlatma', {
    ad: c.contact.name.trim(),
    son_tarih: formatDay(lastDay, 'tr'),
    sayfa_baglantisi: link,
    ...(target ? whenVars(target.day, target.time) : {}),
    '#hedef': target ? '1' : '',
  });
}

function convertedMail(gas: Gas, c: StoredClient, s: When): Mail {
  const link = trackLink(gas, c);
  if (c.contact.lang === 'en') {
    return {
      subject: 'Your closing session is planned – klinikterapist.com',
      body: [
        `Dear ${c.contact.name.trim()},`,
        '',
        `As no time was picked for our closing session, I have planned your session on ${atEn(s)} (Turkey time) as the free closing session. It takes 25–30 minutes and is held online; I will send you the link before it.`,
        `If this time does not suit you, you can move it on your appointment page: ${link}`,
        '',
        ...SIGN_EN,
      ].join('\n'),
    };
  }
  return mailTr('oto.sonlandirma-otomatik', { ad: c.contact.name.trim(), ...whenVars(s.day, s.time), sayfa_baglantisi: link });
}

/** The hourly step. Returns the e-mails sent, for the log and the tests. */
export function runClosing(gas: Gas): number {
  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) return 0;
  const out: MailMessage[] = [];
  gas.withLock(() => {
    const now = gas.now();
    const clients = readItems<StoredClient>(gas, CLIENTS);
    let changed = false;
    const next = clients.map((c): StoredClient => {
      const step = closingStep(c, now);
      if (step === 'none') return c;
      const a = c.closingAsk!;
      const lastDay = closingDay(a);
      const toClient = (m: Mail) => out.push({ to: c.contact.email, ...asSender(gas, 'booking', owner), subject: m.subject, body: m.body, name: SENDER_NAME });
      const toOwner = (m: Mail) => out.push({ to: notifyTo(gas, owner), replyTo: c.contact.email, subject: m.subject, body: m.body, name: 'klinikterapist.com randevu sistemi' });
      const panel = `${PANEL_URL}#/seans-takip/${c.id}`;
      changed = true;
      if (step === 'settle') return { ...c, closingAsk: { ...a, done: now } };
      if (step === 'remind') {
        const target = closingTarget(c, a.until);
        toClient(reminderMail(gas, c, lastDay, target));
        toOwner(mailTr('bildirim.sonlandirma-hatirlatma', { danisan_kodu: c.number, son_tarih: formatDay(lastDay, 'tr'), ...(target ? whenVars(target.day, target.time) : {}), '#hedef': target ? '1' : '', panel_baglantisi: panel }));
        return { ...c, closingAsk: { ...a, reminded: true } };
      }
      // The time to pick has ended.
      const target = closingTarget(c, now);
      toOwner(mailTr('bildirim.sonlandirma-otomatik', { danisan_kodu: c.number, son_tarih: formatDay(lastDay, 'tr'), ...(target ? whenVars(target.day, target.time) : {}), '#hedef': target ? '1' : '', '#yok': target ? '' : '1', panel_baglantisi: panel }));
      if (!target) {
        logEvent(gas, 'client', `${c.number}: sonlandırma görüşmesi için saat seçilmedi; dönüşecek seans yok`, `#/seans-takip/${c.id}`);
        return { ...c, closingAsk: { ...a, done: now } };
      }
      const s = { day: target.day, time: target.time };
      toClient(convertedMail(gas, c, s));
      logEvent(gas, 'client', `${c.number}: saat seçilmedi; seans sonlandırma görüşmesine dönüştü · ${shortWhen(s)}`, `#/seans-takip/${c.id}`);
      return { ...c, sessions: convertToClosing(c, s), closingAsk: { ...a, done: now, auto: s } };
    });
    if (changed) writeItems(gas, CLIENTS, next);
  });
  let sent = 0;
  for (const m of out) {
    try {
      gas.mail.send(m);
      sent++;
    } catch (e) {
      // The address is left out of the log; the subject says which e-mail it was.
      gas.log(`hourly/closing "${m.subject}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return sent;
}
