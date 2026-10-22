/**
 * Fees, payments and reminders (src/lib/payment.ts; owner's decisions 2026-10-20, roadmap Faz 1).
 *
 * - `payment.get` / `payment.set` (panel): the fees by year, the bank details and an optional
 *   payment link, kept in the script's properties: never in the repository, never on the site.
 * - `clients.pay` (panel): a session marked paid or not; when paid, the owner's (edited) thank-you
 *   goes to the client.
 * - The hourly job (`runReminders`): 72 hours before a session the client gets a reminder (with the
 *   payment when it is a paid session not yet marked paid, the rule and their page link); 48 hours
 *   before, still unpaid, a payment reminder; `dueHours` before, still unpaid, the owner is told.
 *   Nothing moves by itself. Each reminder goes once (`sent` on the session record). Approved
 *   one-off appointments not yet in Seans takip get the 72-hour reminder too.
 * The flags are written before the e-mails go: a failed e-mail is not sent again every hour.
 */
import type { BookingRequest, Client } from '../../src/admin/api/types';
import type { Gas, MailMessage } from './gas';
import { ApiError, badRequest } from './respond';
import { readItems, writeItems } from './store';
import { CLIENTS, REQUESTS, publicClient, sendMail, type StoredClient } from './requests';
import { trackLink } from './tracking';
import { PANEL_URL, SENDER_NAME } from './text';
import { logEvent, shortWhen } from './events';
import { INTRO_MINUTES, slotInstant } from '../../src/lib/booking-form';
import { FREE_KINDS, SessionError, applyChange, markSent, sessionsOf, type SessionRecord } from '../../src/lib/sessions';
import { EMPTY_PAYMENT, parsePayment, paymentReminderMail, sessionReminderMail, type PaymentSettings } from '../../src/lib/payment';
import { DAY_RE, TIME_RE } from '../../src/lib/field-rules';
import { asSender, notifyTo, noticeFrom } from './mailboxes';
import { readQr, saveQr } from './qr';
import { mailTr } from '../../src/lib/mail-texts';
import { whenVars } from '../../src/lib/mail-vars';

const PROP = 'PAYMENT_SETTINGS';
const HOUR = 3600 * 1000;
const NO_CLIENT = 'Bu danışan bulunamadı. Başka bir yerde takipten çıkarılmış olabilir.';

export function getPayment(gas: Gas): PaymentSettings {
  try {
    return parsePayment(JSON.parse(gas.props.get(PROP) ?? 'null'));
  } catch {
    return EMPTY_PAYMENT;
  }
}

/** `payment.get` (panel), with the QR code image. */
export const readPayment = (gas: Gas) => ({ payment: { ...getPayment(gas), qr: readQr(gas) } });

/** `payment.set` (panel): only known fields are kept (src/lib/payment.ts `parsePayment`). */
export function savePayment(gas: Gas, p: Record<string, unknown>): { payment: PaymentSettings } {
  const payment = parsePayment(p.payment);
  if (!payment.year) throw badRequest('Ücretlerin geçerli olduğu yılı girin.');
  const qr = (p.payment as { qr?: unknown } | null)?.qr;
  if (typeof qr === 'string') saveQr(gas, qr);
  gas.props.set(PROP, JSON.stringify(payment));
  return { payment: { ...payment, qr: readQr(gas) } };
}

/** `clients.pay` (panel): paid or not; with `mail`, the owner's thank-you goes to the client. */
export function payClient(gas: Gas, p: Record<string, unknown>): { client: Client } {
  if (typeof p.day !== 'string' || !DAY_RE.test(p.day) || typeof p.time !== 'string' || !TIME_RE.test(p.time)) throw badRequest('Tarih ve saat eksik ya da hatalı.');
  const day = p.day;
  const time = p.time;
  return gas.withLock(() => {
    const clients = readItems<StoredClient>(gas, CLIENTS);
    const c = clients.find((x) => x.id === p.id);
    if (!c) throw new ApiError('not_found', NO_CLIENT);
    let sessions: SessionRecord[];
    try {
      sessions = applyChange(c, { op: 'pay', day, time, paid: p.paid === true, paidAt: gas.now() }, INTRO_MINUTES).sessions;
    } catch (e) {
      if (e instanceof SessionError) throw badRequest(e.message);
      throw e;
    }
    const mail = p.mail && typeof p.mail === 'object' ? (p.mail as Record<string, unknown>) : null;
    // The e-mail first: when it cannot go, the mark is not made either and the owner can try again.
    if (p.paid === true && mail) sendMail(gas, c.contact.email, mail);
    const updated: StoredClient = { ...c, sessions };
    writeItems(gas, CLIENTS, clients.map((x) => (x.id === c.id ? updated : x)));
    logEvent(gas, 'payment', `${c.number}: ${shortWhen({ day, time })} seansı ${p.paid === true ? 'ödendi' : 'için ödeme işareti kaldırıldı'}`, `#/seans-takip/${c.id}`);
    return { client: publicClient(updated) };
  });
}


/** The hourly reminders. Returns the e-mails sent, for the log and the tests. */
export function runReminders(gas: Gas): number {
  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) return 0;
  const pay = getPayment(gas);
  const qr = !!readQr(gas);
  const out: MailMessage[] = [];
  const toClient = (c: { email: string }, m: { subject: string; body: string }) => out.push({ to: c.email, ...asSender(gas, 'booking', owner), subject: m.subject, body: m.body, name: SENDER_NAME });
  gas.withLock(() => {
    const now = gas.now();
    const day = (ms: number) => new Date(ms + 3 * HOUR).toISOString().slice(0, 10);

    // Clients in Seans takip.
    const clients = readItems<StoredClient>(gas, CLIENTS);
    let changed = false;
    const next = clients.map((c) => {
      let cur = c;
      for (const s of sessionsOf(c, day(now), day(now + 4 * 24 * HOUR))) {
        if (s.status !== 'planned' || s.kind === 'intro') continue;
        const left = slotInstant(s.day, s.time) - now;
        if (left <= 0 || left > 72 * HOUR) continue;
        const free = FREE_KINDS.includes(s.kind);
        const sent = s.sent ?? [];
        const paid = !!s.paid;
        const mark = (k: 'r72' | 'r48' | 'due') => {
          cur = { ...cur, sessions: markSent(cur, s.day, s.time, k) };
          changed = true;
        };
        if (!sent.includes('r72') && left > 24 * HOUR) {
          toClient(c.contact, sessionReminderMail(c.contact, s, { type: c.type, free, paid }, pay, trackLink(gas, c), qr));
          mark('r72');
          // Sent late (the client came in under 48 hours): it already asked for the payment.
          if (left <= 48 * HOUR) mark('r48');
        } else if (!free && !paid && !sent.includes('r48') && left <= 48 * HOUR && left > 24 * HOUR) {
          toClient(c.contact, paymentReminderMail(c.contact, s, c.type, pay, trackLink(gas, c), qr));
          mark('r48');
        }
        if (!free && !paid && !sent.includes('due') && left <= pay.dueHours * HOUR) {
          const m = mailTr('bildirim.odeme-yok', {
            danisan_kodu: c.number,
            ...whenVars(s.day, s.time),
            odeme_suresi: String(Math.max(1, Math.round(left / HOUR))),
            panel_baglantisi: `${PANEL_URL}#/seans-takip/${c.id}`,
          });
          out.push({ ...noticeFrom(gas), to: notifyTo(gas, owner), replyTo: c.contact.email, ...m, name: 'Randevu Sistemi' });
          mark('due');
          logEvent(gas, 'payment', `${c.number}: ödeme alınmadı · ${shortWhen(s)}`, `#/seans-takip/${c.id}`);
        }
      }
      return cur;
    });
    if (changed) writeItems(gas, CLIENTS, next);

    // Approved one-off appointments not yet in Seans takip: the 72-hour reminder only.
    const requests = readItems<BookingRequest>(gas, REQUESTS);
    let reqChanged = false;
    const reqNext = requests.map((r) => {
      if (r.status !== 'approved' || r.reminded) return r;
      const left = slotInstant(r.day, r.time) - now;
      if (left <= 24 * HOUR || left > 72 * HOUR) return r;
      const free = r.kind === 'intro';
      toClient(r, sessionReminderMail({ name: r.name, lang: r.lang }, r, { type: r.type ?? 'individual', free, paid: false }, pay, undefined, qr));
      reqChanged = true;
      return { ...r, reminded: true };
    });
    if (reqChanged) writeItems(gas, REQUESTS, reqNext);
  });
  let sent = 0;
  for (const m of out) {
    try {
      gas.mail.send(m);
      sent++;
    } catch (e) {
      // The address is left out of the log; the subject says which reminder it was.
      gas.log(`hourly/reminder "${m.subject}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return sent;
}
