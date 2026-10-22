/**
 * "Randevu alımını kapat" and "Haber et" (owner's request 2026-10-20).
 *
 * Closed (booking.json `intake`, per language; booking.ts `setOpen`): the site's booking and
 * intro-call pages of that language say booking is closed and show the "Haber et" form instead;
 * `booking.request` is refused. The
 * form (`booking.waitlist`, public) puts the person on a list in the owner's Drive
 * (`randevular/bekleme.json`, sealed), kept apart from requests, at most 90 days. The owner gets an
 * e-mail; the person gets a fixed acknowledgement with the e-mail check link. From the panel the
 * owner writes to them when a time frees up, takes them off the list, or books them.
 */
import type { WaitlistEntry } from '../../src/admin/api/types';
import type { Gas } from './gas';
import { ApiError, badRequest } from './respond';
import { HONEYPOT, allowSend } from './contact';
import { readItems, writeItems } from './store';
import { verifyLines, verifyLink } from './verify';
import { initials, logEvent } from './events';
import { assertMailDomain } from './mx';
import { WAITLIST_KEEP_DAYS, WAITLIST_LABELS, validateWaitlist, type WaitlistInput } from '../../src/lib/waitlist-form';
import { PANEL_URL, SENDER_NAME, oneLine, str } from './text';
import { asSender, notifyTo } from './mailboxes';
import { isClosed } from './booking';
import { mailTr } from '../../src/lib/mail-texts';

const FILE = 'bekleme.json';
const KEEP_MS = WAITLIST_KEEP_DAYS * 24 * 3600 * 1000;
const NOT_FOUND = 'Bu kişi listede bulunamadı. Başka bir yerde listeden çıkarılmış olabilir.';
const INVALID = 'Formdaki bilgiler eksik ya da hatalı. Lütfen kontrol edip tekrar deneyin.';
const TOO_MANY = 'Şu anda çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin ya da doğrudan e-posta gönderin.';

function live(gas: Gas): WaitlistEntry[] {
  const now = gas.now();
  const all = readItems<WaitlistEntry>(gas, FILE);
  const kept = all.filter((e) => now - e.createdAt < KEEP_MS);
  if (kept.length !== all.length) writeItems(gas, FILE, kept);
  return kept;
}

// Under the lock: dropping the old entries writes the file, and someone may be joining the list.
export const bookingState = (gas: Gas) =>
  gas.withLock(() => ({ open: { tr: !isClosed(gas, 'tr'), en: !isClosed(gas, 'en') }, waiting: live(gas).length }));

export const listWaitlist = (gas: Gas) => gas.withLock(() => ({ entries: live(gas).sort((a, b) => a.createdAt - b.createdAt) }));

export function markWaitlistVerified(gas: Gas, id: string): void {
  gas.withLock(() => {
    const all = live(gas);
    if (all.some((e) => e.id === id && !e.verified)) writeItems(gas, FILE, all.map((e) => (e.id === id ? { ...e, verified: true } : e)));
  });
}

const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const OPEN = 'Randevu alımı şu an açık. Sayfayı yenileyip takvimden size uygun bir saat seçebilirsiniz.';

export function joinWaitlist(gas: Gas, p: Record<string, unknown>): { sent: true } {
  if (str(p[HONEYPOT]).trim()) return { sent: true };
  // The list is for when booking is closed (owner's decision 2026-10-20): while it is open, the
  // calendar is the way in.
  if (!isClosed(gas, p.lang === 'en' ? 'en' : 'tr')) throw new ApiError('bad_request', OPEN, { reason: 'open' });
  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) throw new ApiError('internal', 'Form henüz kurulmadı. Lütfen doğrudan e-posta gönderin.');
  const input: WaitlistInput = {
    name: str(p.name),
    email: str(p.email),
    phone: str(p.phone),
    kinds: strs(p.kinds),
    times: strs(p.times),
    reason: str(p.reason),
    consent: p.consent === true,
    healthConsent: p.healthConsent === true,
  };
  if (Object.keys(validateWaitlist(input)).length) throw badRequest(INVALID);
  const email = input.email.trim().toLowerCase();
  assertMailDomain(gas, email);
  const lang = p.lang === 'en' ? 'en' : 'tr';
  if (!allowSend(gas, email, 2)) throw badRequest(TOO_MANY);

  const entry: WaitlistEntry = {
    id: gas.uuid().slice(0, 12),
    createdAt: gas.now(),
    name: oneLine(input.name),
    email,
    phone: oneLine(input.phone),
    kinds: [...new Set(input.kinds)],
    times: [...new Set(input.times)],
    reason: input.reason.trim(),
    lang,
  };
  gas.withLock(() => writeItems(gas, FILE, [...live(gas), entry]));

  const tr = WAITLIST_LABELS.tr;
  const notice = mailTr('bildirim.bekleme', {
    ad: entry.name,
    e_posta: email,
    telefon: entry.phone,
    tur: entry.kinds.map((k) => tr[k as keyof typeof tr]).join(', '),
    uygun_zamanlar: entry.times.map((t) => tr[t as keyof typeof tr]).join(', ') || 'Belirtmedi',
    dil: lang === 'en' ? 'İngilizce' : 'Türkçe',
    basvuru_nedeni: oneLine(entry.reason),
    saklama_gun: String(WAITLIST_KEEP_DAYS),
    panel_baglantisi: `${PANEL_URL}#/randevular?liste`,
  });
  gas.mail.send({ to: notifyTo(gas, owner), replyTo: email, ...notice, name: 'klinikterapist.com randevu formu' });
  const link = verifyLink(gas, `w:${entry.id}`, entry.kinds.length === 1 && entry.kinds[0] === 'intro' ? 'preConsult' : 'appointment', lang);
  gas.mail.send({
    to: email,
    ...asSender(gas, 'booking', owner),
    subject: lang === 'en' ? 'You are on my waiting list – klinikterapist.com' : 'Bekleme listeme alındınız – klinikterapist.com',
    body: (lang === 'en'
      ? [
          'Hello,',
          '',
          'Thank you for your interest. All my session times are taken at the moment, so I have put you on my waiting list.',
          'When a time frees up, I will write to you at this address.',
          '',
          ...verifyLines(link, 'en'),
          '',
          `Your details are kept for at most ${WAITLIST_KEEP_DAYS} days. To be taken off the list, simply reply to this e-mail.`,
          'If you did not send this, you can ignore this e-mail.',
          '',
          'Kind regards,',
          'Osman Güneş Özkurt',
          'Clinical Psychologist',
          'klinikterapist.com',
        ]
      : mailTr('oto.bekleme-alindi', { dogrulama_baglantisi: link, saklama_gun: String(WAITLIST_KEEP_DAYS) }).body.split('\n')
    ).join('\n'),
    name: SENDER_NAME,
  });
  logEvent(gas, 'waitlist', `Bekleme listesine yeni kayıt: ${initials(input.name)}`, '#/randevular?liste');
  return { sent: true };
}

/** The owner writes to someone on the list (a free time, or taking them off it). */
export function mailWaitlist(gas: Gas, p: Record<string, unknown>): Record<string, never> {
  const subject = typeof p.subject === 'string' && p.subject.trim() && p.subject.length <= 200 ? p.subject : null;
  const body = typeof p.body === 'string' && p.body.trim() && p.body.length <= 5000 ? p.body : null;
  if (!subject || !body) throw badRequest('E-postanın konusu ve metni boş olamaz.');
  return gas.withLock(() => {
    const all = live(gas);
    const e = all.find((x) => x.id === p.id);
    if (!e) throw new ApiError('not_found', NOT_FOUND);
    gas.mail.send({ to: e.email, ...asSender(gas, 'booking', gas.props.get('OWNER_EMAIL')?.trim() ?? ''), subject: subject.replace(/[\r\n]+/g, ' '), body, name: SENDER_NAME });
    writeItems(gas, FILE, p.remove === true ? all.filter((x) => x.id !== e.id) : all.map((x) => (x.id === e.id ? { ...x, offeredAt: gas.now() } : x)));
    return {};
  });
}

export function removeWaitlist(gas: Gas, p: Record<string, unknown>): Record<string, never> {
  gas.withLock(() => writeItems(gas, FILE, live(gas).filter((x) => x.id !== p.id)));
  return {};
}
