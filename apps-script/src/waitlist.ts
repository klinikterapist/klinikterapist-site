/**
 * "Randevu alımını kapat" and "Haber et" (owner's request 2026-10-20).
 *
 * Closed (`booking.closed` in the script's properties): the site's booking and intro-call pages say
 * every session is taken and show the "Haber et" form instead; `booking.request` is refused. The
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
import { PANEL_URL, oneLine, str } from './text';

const FILE = 'bekleme.json';
const CLOSED = 'booking.closed';
const KEEP_MS = WAITLIST_KEEP_DAYS * 24 * 3600 * 1000;
const NOT_FOUND = 'Bu kişi listede bulunamadı. Başka bir yerde listeden çıkarılmış olabilir.';
const INVALID = 'Formdaki bilgiler eksik ya da hatalı. Lütfen kontrol edip tekrar deneyin.';
const TOO_MANY = 'Şu anda çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin ya da doğrudan e-posta gönderin.';

export const isClosed = (gas: Gas) => gas.props.get(CLOSED) === '1';

export function setOpen(gas: Gas, p: Record<string, unknown>): Record<string, never> {
  if (typeof p.open !== 'boolean') throw badRequest();
  if (p.open) gas.props.del(CLOSED);
  else gas.props.set(CLOSED, '1');
  gas.cache.put('booking.busy', '', 1);
  return {};
}

function live(gas: Gas): WaitlistEntry[] {
  const now = gas.now();
  const all = readItems<WaitlistEntry>(gas, FILE);
  const kept = all.filter((e) => now - e.createdAt < KEEP_MS);
  if (kept.length !== all.length) writeItems(gas, FILE, kept);
  return kept;
}

// Under the lock: dropping the old entries writes the file, and someone may be joining the list.
export const bookingState = (gas: Gas) => gas.withLock(() => ({ open: !isClosed(gas), waiting: live(gas).length }));

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
  if (!isClosed(gas)) throw new ApiError('bad_request', OPEN, { reason: 'open' });
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
  gas.mail.send({
    to: owner,
    replyTo: email,
    subject: `[klinikterapist] Haber et — ${entry.name}`,
    body: [
      'Randevu alımı kapalıyken biri "Haber et" formunu doldurdu: boşalan bir saat olursa haber bekliyor.',
      '',
      `Ad Soyad: ${entry.name}`,
      `E-posta: ${email}`,
      `Telefon: ${entry.phone}`,
      `Aradığı görüşme: ${entry.kinds.map((k) => tr[k as keyof typeof tr]).join(', ')}`,
      `Uygun zamanlar: ${entry.times.map((t) => tr[t as keyof typeof tr]).join(', ') || 'Belirtmedi'}`,
      `Konuşma dili: ${lang === 'en' ? 'İngilizce' : 'Türkçe'}`,
      ...(entry.reason ? ['', 'Başvuru sebebi:', entry.reason] : []),
      '',
      `Bekleme listesi: ${PANEL_URL}#/randevular?liste`,
      `Kayıt en fazla ${WAITLIST_KEEP_DAYS} gün tutulur.`,
    ].join('\n'),
    name: 'klinikterapist.com randevu formu',
  });
  const link = verifyLink(gas, `w:${entry.id}`, entry.kinds.length === 1 && entry.kinds[0] === 'intro' ? 'preConsult' : 'appointment', lang);
  gas.mail.send({
    to: email,
    replyTo: owner,
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
          'Osman Güneş Özkurt',
          'klinikterapist.com',
        ]
      : [
          'Merhaba,',
          '',
          'İlginiz için teşekkür ederim. Şu an tüm seans saatlerim dolu olduğu için sizi bekleme listeme aldım.',
          'Boşalan bir saat olduğunda size bu adresten yazacağım.',
          '',
          ...verifyLines(link, 'tr'),
          '',
          `Bilgileriniz en fazla ${WAITLIST_KEEP_DAYS} gün saklanır. Listeden çıkmak isterseniz bu e-postayı yanıtlamanız yeterli.`,
          'Bu formu siz doldurmadıysanız bu e-postayı dikkate almayın.',
          '',
          'Osman Güneş Özkurt',
          'klinikterapist.com',
        ]
    ).join('\n'),
    name: 'Osman Güneş Özkurt',
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
    gas.mail.send({ to: e.email, replyTo: gas.props.get('OWNER_EMAIL')?.trim() ?? '', subject: subject.replace(/[\r\n]+/g, ' '), body, name: 'Osman Güneş Özkurt' });
    writeItems(gas, FILE, p.remove === true ? all.filter((x) => x.id !== e.id) : all.map((x) => (x.id === e.id ? { ...x, offeredAt: gas.now() } : x)));
    return {};
  });
}

export function removeWaitlist(gas: Gas, p: Record<string, unknown>): Record<string, never> {
  gas.withLock(() => writeItems(gas, FILE, live(gas).filter((x) => x.id !== p.id)));
  return {};
}
