/**
 * `contact.send`: the site's contact form (no session). The fields are checked again here, a filled
 * honeypot is dropped silently, fixed-window limits stop floods, and one plain-text e-mail goes to the
 * owner (OWNER_EMAIL) with Reply-To set to the visitor. The message itself is not stored; the limits
 * keep only a keyed hash of the address (cache, at most two hours) and counters.
 */
import { contactTo, noticeFrom } from './mailboxes';
import type { Gas } from './gas';
import { ApiError, badRequest } from './respond';
import { isContactTopic, topicLabel, validateContact, type ContactInput } from '../../src/lib/contact-form';
import { oneLine, str } from './text';
import { mailTr } from '../../src/lib/mail-texts';
import { stamp } from '../../src/lib/mail-vars';
import { personName } from '../../src/lib/person-name';

/**
 * Fixed windows: per visitor address and for the whole site per clock hour, and for the whole site per
 * UTC day (MailApp's consumer quota is about 100 e-mails a day; the rest stays for the owner).
 */
export const CONTACT_RATE = { perEmail: 5, globalHour: 50, globalDay: 80 } as const;

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** The day counter lives in script properties: CacheService keeps entries for at most 6 hours. */
const DAY_PROP = 'CONTACT_DAY_COUNT';

const INVALID = 'Formdaki bilgiler eksik ya da hatalı. Lütfen kontrol edip tekrar deneyin.';
const TOO_MANY = 'Şu anda çok fazla mesaj gönderildi. Lütfen daha sonra tekrar deneyin ya da doğrudan e-posta gönderin.';
const NOT_READY = 'İletişim formu henüz kurulmadı. Lütfen doğrudan e-posta gönderin.';

/** Honeypot field name: non-semantic, so browsers do not autofill it. */
export const HONEYPOT = 'hp_field';

/**
 * One mailbox, however it is written: lowercase, without a "+tag", and for Gmail without dots
 * (googlemail.com is gmail.com). Used only for the per-address limit.
 */
export function normaliseEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 0) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  local = local.split('+')[0];
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

type Counter = { read(): number; write(n: number): void };

function cacheCounter(gas: Gas, key: string, ttlSec: number): Counter {
  return { read: () => Number(gas.cache.get(key) ?? '0') || 0, write: (n) => gas.cache.put(key, String(n), ttlSec) };
}

function dayCounter(gas: Gas, day: number): Counter {
  const stored = () => {
    try {
      const v = JSON.parse(gas.props.get(DAY_PROP) ?? 'null') as { day?: number; n?: number } | null;
      return v && v.day === day && typeof v.n === 'number' ? v.n : 0;
    } catch {
      return 0;
    }
  };
  return { read: stored, write: (n) => gas.props.set(DAY_PROP, JSON.stringify({ day, n })) };
}

/**
 * Checks every limit first and counts the send (`cost` e-mails) in all of them only when none would
 * be passed, so a refused address never uses up the site-wide allowance. Shared by the contact form
 * and the booking forms.
 */
export function allowSend(gas: Gas, email: string, cost = 1): boolean {
  const now = gas.now();
  const hour = Math.floor(now / HOUR_MS);
  // A keyed hash keeps the cache key short (CacheService keys are at most 250 characters) and keeps
  // the address itself out of the cache.
  const who = gas.hmac('contact-rate', normaliseEmail(email));
  const limits: [Counter, number][] = [
    [cacheCounter(gas, `contact:e:${who}:${hour}`, 2 * 3600), CONTACT_RATE.perEmail],
    [cacheCounter(gas, `contact:all:${hour}`, 2 * 3600), CONTACT_RATE.globalHour],
    [dayCounter(gas, Math.floor(now / DAY_MS)), CONTACT_RATE.globalDay],
  ];
  return gas.withLock(() => {
    const counts = limits.map(([c]) => c.read());
    if (limits.some(([, max], i) => counts[i] + cost > max)) return false;
    limits.forEach(([c], i) => c.write(counts[i] + cost));
    return true;
  });
}

export function sendContact(gas: Gas, p: Record<string, unknown>): { sent: true } {
  // Bots fill every field; people never see this one. Answer as if it worked, send nothing.
  if (str(p[HONEYPOT]).trim()) return { sent: true };

  const input: ContactInput = {
    name: str(p.name),
    email: str(p.email),
    topic: str(p.topic),
    message: str(p.message),
    consent: p.consent === true,
  };
  if (Object.keys(validateContact(input)).length > 0 || !isContactTopic(input.topic)) throw badRequest(INVALID);

  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) throw new ApiError('internal', NOT_READY);

  const lang = p.lang === 'en' ? 'en' : 'tr';
  const name = personName(oneLine(input.name), lang);
  const email = input.email.trim().toLowerCase();
  const topic = topicLabel(input.topic, 'tr');

  if (!allowSend(gas, email)) throw badRequest(TOO_MANY);

  const m = mailTr('bildirim.iletisim', { ad: name, e_posta: email, konu: topic, dil: lang === 'en' ? 'İngilizce' : 'Türkçe', gonderim: stamp(gas.now()), mesaj: input.message.trim() });
  const to = contactTo(gas, lang, owner);
  gas.mail.send({ ...noticeFrom(gas, to), to, replyTo: email, ...m, name: lang === 'en' ? 'İletişim Formu (EN)' : 'İletişim Formu' });
  return { sent: true };
}
