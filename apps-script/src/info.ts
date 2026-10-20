/**
 * `info.request` (public, Faz 3): "Süreç bilgisi" on the booking start page. The answers to the
 * chosen topics go to the address (src/lib/info-answers.ts); the address is not kept anywhere, and
 * Bildirimler gets the topics only. Like the other forms: the honeypot, the domain check, the
 * shared sending limits.
 */
import type { Gas } from './gas';
import { ApiError, badRequest } from './respond';
import { HONEYPOT, allowSend } from './contact';
import { assertMailDomain } from './mx';
import { logEvent } from './events';
import { SITE, str } from './text';
import { pathFor } from '../../src/i18n/routes';
import { INFO_TOPICS, infoMail, validateInfo } from '../../src/lib/info-answers';
import { asSender } from './mailboxes';

const INVALID = 'Formdaki bilgiler eksik ya da hatalı. Lütfen kontrol edip tekrar deneyin.';
const TOO_MANY = 'Şu anda çok fazla istek var. Lütfen biraz sonra tekrar deneyin ya da doğrudan e-posta gönderin.';

export function sendInfo(gas: Gas, p: Record<string, unknown>): { sent: true } {
  if (str(p[HONEYPOT]).trim()) return { sent: true };
  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) throw new ApiError('internal', 'Form henüz kurulmadı. Lütfen doğrudan e-posta gönderin.');
  const topics = Array.isArray(p.topics) ? p.topics.filter((t): t is string => typeof t === 'string').slice(0, INFO_TOPICS.length) : [];
  const input = { email: str(p.email), topics, consent: p.consent === true };
  if (Object.keys(validateInfo(input)).length) throw badRequest(INVALID);
  const email = input.email.trim().toLowerCase();
  const lang = p.lang === 'en' ? 'en' : 'tr';
  assertMailDomain(gas, email);
  if (!allowSend(gas, email)) throw badRequest(TOO_MANY);
  const m = infoMail(topics, lang, { intro: `${SITE}${pathFor('preConsult', lang)}`, book: `${SITE}${pathFor('appointment', lang)}` });
  gas.mail.send({ to: email, ...asSender(gas, 'info', owner), subject: m.subject, body: m.body, name: 'Osman Güneş Özkurt' });
  const names = INFO_TOPICS.filter((t) => topics.includes(t.id)).map((t) => t.q.tr.replace(/\?$/, ''));
  logEvent(gas, 'info', `Bilgi talebi${lang === 'en' ? ' (İngilizce)' : ''}: ${names.join('; ')}`);
  return { sent: true };
}
