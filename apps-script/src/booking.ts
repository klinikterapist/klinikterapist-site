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
import { read } from './github';
import { HONEYPOT, allowSend } from './contact';
import { addHold } from './calendar';
import { allBusy, saveRequest } from './requests';
import { parseBooking } from '../../src/lib/schemas';
import {
  AGE_RANGES, INTRO_FOR, INTRO_TOPICS, SESSION_TYPES, formatDay, validateBooking, type BookingConfig, type BookingInput, type BookingLang,
} from '../../src/lib/booking-form';

const INVALID = 'Formdaki bilgiler eksik ya da hatalı. Lütfen kontrol edip tekrar deneyin.';
const TAKEN = 'Seçtiğiniz saat artık uygun değil. Lütfen başka bir saat seçin.';
const TOO_MANY = 'Şu anda çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin ya da doğrudan e-posta gönderin.';
const NOT_READY = 'Randevu formu henüz kurulmadı. Lütfen doğrudan e-posta gönderin.';

const CONFIG_CACHE = 'booking.config';
const CONFIG_TTL = 10 * 60;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

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
        }
      : {}),
  };
}

const PANEL_URL = 'https://klinikterapist.com/admin/';

function ownerMail(i: BookingInput, lang: BookingLang, now: number): { subject: string; body: string } {
  const name = oneLine(i.name);
  const when = `${formatDay(i.day, 'tr')}, ${i.time} (Türkiye saati)`;
  const lines =
    i.kind === 'session'
      ? [`Görüşme türü: ${SESSION_TYPES.find((t) => t.id === i.type)!.tr}`]
      : [
          'Ücretsiz ön görüşme talebi',
          `Kimin için: ${INTRO_FOR.find((f) => f.id === i.forWhom)!.tr}`,
          `Konular: ${(i.topics ?? []).map((t) => INTRO_TOPICS.tr[t]).join(', ')}`,
          `Daha önce destek aldı mı: ${i.before === 'yes' ? 'Evet' : i.before === 'no' ? 'Hayır' : 'Belirtmedi'}`,
          `Yaş aralığı: ${AGE_RANGES.tr[i.age!]}`,
          'Konu seçimleri için açık rıza: verildi',
        ];
  const body = [
    ...lines,
    `İstenen gün ve saat: ${when}`,
    `Ad Soyad: ${name}`,
    `E-posta: ${i.email.trim().toLowerCase()}`,
    `Telefon: ${oneLine(i.phone)}`,
    `Sayfa dili: ${lang === 'en' ? 'İngilizce' : 'Türkçe'}`,
    `Gönderim: ${new Date(now).toISOString()}`,
    '',
    ...(i.note.trim() ? ['Not:', i.note.trim(), ''] : []),
    'Bu saat 24 saat boyunca sitede "Dolu" görünüyor. Panelde Talepler ekranından onaylayın ya da yanıtlayın; karar vermezseniz saat 24 saat sonra kendiliğinden açılır:',
    `Talepler: ${PANEL_URL}#/randevular`,
    '',
    '—',
    'Yanıtla dediğinizde e-posta danışana gider; onayı ya da başka bir saat önerisini oradan yazabilirsiniz.',
    'Site bu bilgileri saklamaz; yalnızca bu e-postada bulunur.',
  ].join('\n');
  const label = i.kind === 'session' ? 'Randevu talebi' : 'Ön görüşme talebi';
  return { subject: `[klinikterapist] ${label} — ${name} — ${formatDay(i.day, 'tr')} ${i.time}`, body };
}

/** Fixed text: nothing the visitor typed goes into it. */
function visitorMail(i: BookingInput, lang: BookingLang): { subject: string; body: string } {
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
        'If you did not send this request, you can ignore this e-mail.',
        '',
        'Osman Güneş Özkurt',
        'klinikterapist.com',
      ].join('\n'),
    };
  }
  const what = i.kind === 'session' ? SESSION_TYPES.find((t) => t.id === i.type)!.tr : 'Ücretsiz ön görüşme';
  return {
    subject: 'Talebiniz alındı – klinikterapist.com',
    body: [
      'Merhaba,',
      '',
      `Talebiniz alındı: ${what}, ${when} (Türkiye saati).`,
      'Henüz kesinleşmedi. Saati onaylamak ya da başka bir saat önermek için size e-postayla yazacağım.',
      '',
      'Bu talebi siz göndermediyseniz bu e-postayı dikkate almayın.',
      '',
      'Osman Güneş Özkurt',
      'klinikterapist.com',
    ].join('\n'),
  };
}

const BUSY_CACHE = 'booking.busy';

/**
 * `booking.busy` (public GET): the taken stretches from now on, rest included, as epoch ms — no
 * kinds, no names. The site's calendar marks the times that would overlap them "Dolu".
 */
export function bookingBusy(gas: Gas): { busy: { start: number; end: number }[] } {
  const cached = gas.cache.get(BUSY_CACHE);
  if (cached) {
    try {
      return JSON.parse(cached) as { busy: { start: number; end: number }[] };
    } catch {
      /* compute again */
    }
  }
  const out = { busy: allBusy(gas, config(gas), gas.now()) };
  gas.cache.put(BUSY_CACHE, JSON.stringify(out), 60);
  return out;
}

export function sendBooking(gas: Gas, p: Record<string, unknown>): { sent: true } {
  if (str(p[HONEYPOT]).trim()) return { sent: true };

  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) throw new ApiError('internal', NOT_READY);

  const input = inputOf(p);
  const now = gas.now();
  const cfg = config(gas);
  const plain = validateBooking(input, cfg, now);
  if (Object.keys(plain).length > (plain.slot ? 1 : 0)) throw badRequest(INVALID);
  if (plain.slot) throw badRequest(TAKEN);

  const email = input.email.trim().toLowerCase();
  const lang: BookingLang = p.lang === 'en' ? 'en' : 'tr';
  // Two e-mails per request: count both against the shared limits.
  if (!allowSend(gas, email, 2)) throw badRequest(TOO_MANY);
  // Checked again under the lock, so two visitors cannot take the same time at once.
  gas.withLock(() => {
    if (validateBooking(input, cfg, now, allBusy(gas, cfg, now)).slot) throw badRequest(TAKEN);
    const hold = addHold(gas, now, input.day, input.time, input.kind, input.kind === 'session' ? input.type : undefined);
    saveRequest(gas, input, lang, hold.id);
  });
  gas.cache.put(BUSY_CACHE, '', 1);

  const o = ownerMail(input, lang, now);
  gas.mail.send({ to: owner, replyTo: email, subject: o.subject, body: o.body, name: 'klinikterapist.com randevu formu' });
  const v = visitorMail(input, lang);
  gas.mail.send({ to: email, replyTo: owner, subject: v.subject, body: v.body, name: 'Osman Güneş Özkurt' });
  return { sent: true };
}
