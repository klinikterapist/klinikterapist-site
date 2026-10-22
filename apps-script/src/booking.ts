/**
 * `booking.request`: a booking or intro-call request from the site's step-by-step forms (no
 * session). Like the contact form: the fields are checked again, a filled honeypot is dropped
 * silently, the contact form's limits apply (shared quota), and nothing is stored. The owner gets
 * one e-mail with everything (Reply-To: the visitor); the visitor gets a fixed acknowledgement with
 * only the chosen kind, day and time, so the form cannot be used to send someone else free text.
 *
 * The free times come from `src/data/booking.json` in the repository (cached for 10 minutes), the
 * same file the site builds its calendar from; taken times from the booking calendar (calendar.ts).
 * A request holds its time for 24 hours; the owner's e-mail has a link that opens the panel to put
 * it in the calendar for good.
 */
import type { Gas } from './gas';
import { ApiError, badRequest } from './respond';
import { commit, read } from './github';
import { HONEYPOT, allowSend } from './contact';
import { addHold } from './calendar';
import { allBusy, markVerified, saveRequest } from './requests';
import { markWaitlistVerified } from './waitlist';
import { refOf, verifyLines, verifyLink } from './verify';
import { initials, logEvent, shortWhen } from './events';
import { assertMailDomain } from './mx';
import { parseBooking } from '../../src/lib/schemas';
import {
  AGE_RANGES, SESSION_TYPES, formatDay, intakeOpen, validateBooking, type BookingConfig, type BookingInput, type BookingLang,
} from '../../src/lib/booking-form';
import { PANEL_URL, SENDER_NAME, oneLine, str } from './text';
import { mailTr } from '../../src/lib/mail-texts';
import { forWhom, stamp, topicList, typeVars, upFirst, whenVars } from '../../src/lib/mail-vars';
import { countryName } from '../../src/lib/phone';
import { asSender, notifyTo, noticeFrom } from './mailboxes';

const INVALID = 'Formdaki bilgiler eksik ya da hatalı. Lütfen kontrol edip tekrar deneyin.';
const TAKEN = 'Seçtiğiniz saat artık uygun değil. Lütfen başka bir saat seçin.';
/** `reason: 'taken'` lets the page show the calendar again without reading the message. */
const taken = () => new ApiError('bad_request', TAKEN, { reason: 'taken' });
const TOO_MANY = 'Şu anda çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin ya da doğrudan e-posta gönderin.';
const NOT_READY = 'Randevu formu henüz kurulmadı. Lütfen doğrudan e-posta gönderin.';
const CLOSED = 'Randevu alımı şu an kapalı. Sayfayı yenileyip "Haber et" formunu kullanabilirsiniz.';

const CONFIG_CACHE = 'booking.config';
const CONFIG_TTL = 10 * 60;

export function config(gas: Gas): BookingConfig {
  const cached = gas.cache.get(CONFIG_CACHE);
  if (cached) {
    try {
      return parseBooking(JSON.parse(cached));
    } catch {
      /* read it again */
    }
  }
  const [file] = read(gas, { paths: ['src/data/booking.json'] }).files;
  const cfg = parseBooking(JSON.parse(file.content));
  gas.cache.put(CONFIG_CACHE, JSON.stringify(cfg), CONFIG_TTL);
  return cfg;
}

const BOOKING_FILE = 'src/data/booking.json';
const LANG_NAME: Record<BookingLang, string> = { tr: 'Türkçe', en: 'İngilizce' };

/** Closed in this language (booking.json `intake`): the forms refuse requests and offer "Haber et". */
export const isClosed = (gas: Gas, lang: BookingLang): boolean => !intakeOpen(config(gas), lang);

/**
 * `booking.setOpen` (Ayarlar › Önemli ayarlar): opens or closes booking in one language by writing
 * `intake` in booking.json, the file the site's buttons are built from. The forms follow at once
 * (the cached config is replaced); the buttons after the site is published again.
 */
export function setOpen(gas: Gas, p: Record<string, unknown>): Record<string, never> {
  const lang = p.lang ?? 'tr';
  if (typeof p.open !== 'boolean' || (lang !== 'tr' && lang !== 'en')) throw badRequest();
  const open = p.open;
  const [file] = read(gas, { paths: [BOOKING_FILE] }).files;
  const raw = JSON.parse(file.content) as Record<string, unknown>;
  const now = parseBooking(raw);
  if (intakeOpen(now, lang) === open) return {};
  const intake = { tr: intakeOpen(now, 'tr'), en: intakeOpen(now, 'en'), [lang]: open };
  const next = { ...raw, intake };
  commit(gas, {
    message: `${LANG_NAME[lang]} randevu alımı ${open ? 'açıldı' : 'kapatıldı'}`,
    writes: [{ path: BOOKING_FILE, content: `${JSON.stringify(next, null, 2)}
`, encoding: 'utf8', expectSha: file.sha }],
    deletes: [],
  });
  gas.cache.put(CONFIG_CACHE, JSON.stringify(parseBooking(next)), CONFIG_TTL);
  gas.cache.put(BUSY_CACHE, '', 1);
  return {};
}

/** The request as the shared rules see it: only known fields, of the right types. */
function inputOf(p: Record<string, unknown>): BookingInput {
  const kind = p.kind === 'intro' ? 'intro' : 'session';
  const ints = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);
  return {
    kind,
    type: str(p.type),
    day: str(p.day),
    time: str(p.time),
    name: str(p.name),
    email: str(p.email),
    phone: str(p.phone),
    note: str(p.note),
    consent: p.consent === true,
    ...(kind === 'intro'
      ? {
          forWhom: str(p.forWhom),
          topics: ints(p.topics),
          before: p.before === 'yes' || p.before === 'no' ? p.before : '',
          age: typeof p.age === 'number' ? p.age : -1,
          healthConsent: p.healthConsent === true,
          ...(str(p.country) ? { country: str(p.country) } : {}),
        }
      : 'healthConsent' in p
        ? { healthConsent: p.healthConsent === true }
        : {}),
  };
}

function ownerMail(i: BookingInput, lang: BookingLang, now: number): { subject: string; body: string } {
  const note = i.note.trim();
  return mailTr(i.kind === 'session' ? 'bildirim.seans-talebi' : 'bildirim.ongorusme-talebi', {
    ad: oneLine(i.name),
    ...whenVars(i.day, i.time),
    ...typeVars(i.type, i.kind === 'intro'),
    gonderim: stamp(now),
    e_posta: i.email.trim().toLowerCase(),
    telefon: oneLine(i.phone),
    dil: lang === 'en' ? 'İngilizce' : 'Türkçe',
    not: note,
    '#not': note ? '1' : '',
    kimin_icin: forWhom(i.forWhom, 'them'),
    konular: topicList(i.topics) || '– Seçilmedi',
    daha_once_destek: i.before === 'yes' ? 'Evet' : i.before === 'no' ? 'Hayır' : 'Belirtmedi',
    yas: i.age !== undefined ? (AGE_RANGES.tr[i.age] ?? '') : '',
    ulke: countryName(i.country, 'tr') || 'Belirtmedi',
    // Session notes: asked since 2026-10-22; a form from before says nothing about it.
    not_rizasi: i.healthConsent ? 'Verildi' : 'Sorulmadı (eski form)',
    panel_baglantisi: `${PANEL_URL}#/randevular`,
  });
}

/** Fixed text: nothing the visitor typed goes into it (the link is made here). */
function visitorMail(i: BookingInput, lang: BookingLang, link: string): { subject: string; body: string } {
  const when = `${formatDay(i.day, lang)}, ${i.time}`;
  if (lang === 'en') {
    const what = i.kind === 'session' ? SESSION_TYPES.find((t) => t.id === i.type)!.en : 'Free intro call';
    return {
      subject: 'Your request has been received – klinikterapist.com',
      body: [
        'Hello,',
        '',
        `Your request has been received: ${what}, ${when} (Turkey time, GMT+3).`,
        'It is not confirmed yet. I will reply by e-mail to confirm the time or suggest another one.',
        '',
        ...verifyLines(link, 'en'),
        '',
        'If you did not send this request, you can ignore this e-mail.',
        '',
        'Kind regards,',
        'Osman Güneş Özkurt',
        'Clinical Psychologist',
        'klinikterapist.com',
      ].join('\n'),
    };
  }
  return mailTr(i.kind === 'session' ? 'oto.talep-alindi.seans' : 'oto.talep-alindi.ongorusme', {
    ...whenVars(i.day, i.time),
    ...typeVars(i.type, i.kind === 'intro'),
    kimin_icin: upFirst(forWhom(i.forWhom, 'you')),
    dogrulama_baglantisi: link,
  });
}

const BUSY_CACHE = 'booking.busy';

/**
 * `booking.busy` (public GET): the taken stretches from now on, rest included, as epoch ms — no
 * kinds, no names. The site's calendar marks the times that would overlap them "Dolu".
 */
export function bookingBusy(gas: Gas, lang: BookingLang = 'tr'): { busy: { start: number; end: number }[]; closed: boolean } {
  const closed = isClosed(gas, lang);
  const cached = gas.cache.get(BUSY_CACHE);
  if (cached) {
    try {
      return { busy: (JSON.parse(cached) as { busy: { start: number; end: number }[] }).busy, closed };
    } catch {
      /* compute again */
    }
  }
  const busy = allBusy(gas, config(gas), gas.now());
  gas.cache.put(BUSY_CACHE, JSON.stringify({ busy }), 60);
  return { busy, closed };
}

export function sendBooking(gas: Gas, p: Record<string, unknown>): { sent: true } {
  if (str(p[HONEYPOT]).trim()) return { sent: true };

  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) throw new ApiError('internal', NOT_READY);
  const lang: BookingLang = p.lang === 'en' ? 'en' : 'tr';
  // `reason: 'closed'`: the page open since before booking closed shows "Haber et" instead.
  if (isClosed(gas, lang)) throw new ApiError('bad_request', CLOSED, { reason: 'closed' });

  const input = inputOf(p);
  const now = gas.now();
  const cfg = config(gas);
  const plain = validateBooking(input, cfg, now);
  if (Object.keys(plain).length > (plain.slot ? 1 : 0)) throw badRequest(INVALID);
  if (plain.slot) throw taken();

  const email = input.email.trim().toLowerCase();
  assertMailDomain(gas, email);
  // Two e-mails per request: count both against the shared limits.
  if (!allowSend(gas, email, 2)) throw badRequest(TOO_MANY);
  // Checked again under the lock, so two visitors cannot take the same time at once.
  const saved = gas.withLock(() => {
    if (validateBooking(input, cfg, now, allBusy(gas, cfg, now)).slot) throw taken();
    const hold = addHold(gas, now, input.day, input.time, input.kind, input.kind === 'session' ? input.type : undefined);
    return saveRequest(gas, input, lang, hold.id);
  });
  gas.cache.put(BUSY_CACHE, '', 1);

  const o = ownerMail(input, lang, now);
  gas.mail.send({ ...noticeFrom(gas), to: notifyTo(gas, owner), replyTo: email, subject: o.subject, body: o.body, name: 'Randevu Formu' });
  const v = visitorMail(input, lang, verifyLink(gas, `r:${saved.id}`, input.kind === 'intro' ? 'preConsult' : 'appointment', lang));
  gas.mail.send({ to: email, ...asSender(gas, 'booking', owner), subject: v.subject, body: v.body, name: SENDER_NAME });
  logEvent(gas, 'request', `Yeni ${input.kind === 'intro' ? 'ön görüşme' : 'seans'} talebi: ${initials(input.name)} · ${shortWhen(input)}`, '#/randevular');
  return { sent: true };
}

/** `booking.verify` (public): the link in an acknowledgement e-mail was opened. */
export function verifyEmail(gas: Gas, p: Record<string, unknown>): { verified: true } {
  const ref = refOf(gas, p.code);
  if (!ref) throw badRequest('Bu doğrulama bağlantısı geçersiz. E-postadaki bağlantıyı yeniden açmayı deneyin.');
  const id = ref.slice(2);
  if (ref.startsWith('w:')) markWaitlistVerified(gas, id);
  else markVerified(gas, id);
  return { verified: true };
}
