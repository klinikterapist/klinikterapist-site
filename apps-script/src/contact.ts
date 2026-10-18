/**
 * `contact.send`: the site's contact form (no session). The fields are checked again here, a filled
 * honeypot is dropped silently, a cache-based limit stops floods, and one plain-text e-mail goes to the
 * owner (OWNER_EMAIL) with Reply-To set to the visitor. Nothing is stored.
 */
import type { Gas } from './gas';
import { ApiError, badRequest } from './respond';
import { isContactTopic, topicLabel, validateContact, type ContactInput } from '../../src/lib/contact-form';

/** Per visitor e-mail address and for the whole site, per hour. */
export const CONTACT_RATE = { perEmail: 5, global: 50, windowSec: 3600 } as const;

const INVALID = 'Formdaki bilgiler eksik ya da hatalı. Lütfen kontrol edip tekrar deneyin.';
const TOO_MANY = 'Şu anda çok fazla mesaj gönderildi. Lütfen daha sonra tekrar deneyin ya da doğrudan e-posta gönderin.';
const NOT_READY = 'İletişim formu henüz kurulmadı. Lütfen doğrudan e-posta gönderin.';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
/** One line for the subject and the header-like lines of the body. */
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** Counts one send in a fixed window; false once the limit is reached. */
function take(gas: Gas, key: string, limit: number): boolean {
  const n = Number(gas.cache.get(key) ?? '0');
  if (n >= limit) return false;
  gas.cache.put(key, String(n + 1), CONTACT_RATE.windowSec);
  return true;
}

export function sendContact(gas: Gas, p: Record<string, unknown>): { sent: true } {
  // Bots fill every field; people never see this one. Answer as if it worked, send nothing.
  if (str(p.website).trim()) return { sent: true };

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

  const name = oneLine(input.name);
  const email = input.email.trim().toLowerCase();
  const topic = topicLabel(input.topic, 'tr');
  const lang = p.lang === 'en' ? 'en' : 'tr';

  const allowed = gas.withLock(() => {
    // Global first: a flood from many addresses must not use up one visitor's allowance.
    if (!take(gas, 'contact:all', CONTACT_RATE.global)) return false;
    return take(gas, `contact:e:${email}`, CONTACT_RATE.perEmail);
  });
  if (!allowed) throw badRequest(TOO_MANY);

  const body = [
    `Ad Soyad: ${name}`,
    `E-posta: ${email}`,
    `Konu: ${topic}`,
    `Sayfa dili: ${lang === 'en' ? 'İngilizce' : 'Türkçe'}`,
    `Gönderim: ${new Date(gas.now()).toISOString()}`,
    '',
    'Mesaj:',
    input.message.trim(),
    '',
    '—',
    'Bu ileti klinikterapist.com iletişim formundan gönderildi. Yanıtla dediğinizde ziyaretçinin adresine gider.',
  ].join('\n');

  gas.mail.send({ to: owner, replyTo: email, subject: `[klinikterapist] ${topic} — ${name}`, body, name: 'klinikterapist.com iletişim formu' });
  return { sent: true };
}
