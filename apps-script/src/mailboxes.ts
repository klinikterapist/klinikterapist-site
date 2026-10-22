/**
 * The system's e-mail addresses (owner's decision 2026-10-20, Faz 4). Three aliases of the owner's
 * Google Workspace account, each kept as a script property and set in the panel (Terapist profili):
 *
 * - `NOTIFY_EMAIL` (bildirim@): where the system's notices to the owner go (new requests, a client's
 *   cancellation, unpaid sessions, holds running out). The contact form keeps going to the owner's
 *   own address (OWNER_EMAIL), so the system's mail and people's messages stay apart.
 * - `BOOKING_FROM` (randevu@): the sender of every e-mail to a person about an appointment.
 * - `INFO_FROM` (bilgi@): the sender of the "Süreç bilgisi" answers.
 * - `CONTACT_TO` (iletisim@) and `CONTACT_EN_TO` (hello@): where the Turkish and the English contact
 *   form arrive (owner's decision 2026-10-22). The English one falls back to the Turkish one.
 *
 * A sender address works only after it is added in Gmail as "Send mail as" (docs/kurulum/
 * eposta-takma-adlari.md); the panel accepts only such addresses. Unset, everything goes from and to
 * the owner's address as before.
 */
import type { Gas, MailMessage } from './gas';
import { ApiError, badRequest } from './respond';
import { EMAIL_RE } from '../../src/lib/field-rules';
import { SENDER_NAME } from './text';

export const MAILBOX_PROPS = { notify: 'NOTIFY_EMAIL', booking: 'BOOKING_FROM', info: 'INFO_FROM', contact: 'CONTACT_TO', contactEn: 'CONTACT_EN_TO' } as const;
export type Mailbox = keyof typeof MAILBOX_PROPS;
export type Mailboxes = Record<Mailbox, string>;

const SENDERS: Mailbox[] = ['booking', 'info'];

export const mailboxOf = (gas: Gas, box: Mailbox): string => gas.props.get(MAILBOX_PROPS[box])?.trim().toLowerCase() ?? '';

/** Where the system's notices to the owner go: bildirim@ when set, else the owner's address. */
export const notifyTo = (gas: Gas, owner: string): string => mailboxOf(gas, 'notify') || owner;

/**
 * Sender of a notice to the owner. Gmail shows "ben" for mail from the owner's own address and hides
 * the name we give, so a notice goes from bildirim@ (the contact form from iletisim@ / hello@) when
 * that address is a Gmail sender; then the name ("Randevu Formu", "İletişim Formu"…) shows
 * (owner's request 2026-10-22). Otherwise it goes from the owner's address as before.
 */
export function noticeFrom(gas: Gas, address = mailboxOf(gas, 'notify')): Pick<MailMessage, 'from'> {
  return address && aliasesOf(gas).includes(address) ? { from: address } : {};
}

/** Where a contact form message arrives: iletisim@ (hello@ for the English form) when set, else the owner's address. */
export const contactTo = (gas: Gas, lang: 'tr' | 'en', owner: string): string =>
  (lang === 'en' && mailboxOf(gas, 'contactEn')) || mailboxOf(gas, 'contact') || owner;

/** Sender and Reply-To of an e-mail to a person: randevu@ / bilgi@ when set, else the owner's address. */
export function asSender(gas: Gas, box: 'booking' | 'info', owner: string): Pick<MailMessage, 'from' | 'replyTo'> {
  const from = mailboxOf(gas, box);
  return from ? { from, replyTo: from } : { replyTo: owner };
}

/** `mail.settings` (panel): the three addresses, the owner's own, Gmail's sender addresses and today's quota left. */
export function readMailboxes(gas: Gas): { mailboxes: Mailboxes; owner: string; aliases: string[]; quota: number | null } {
  const mailboxes = Object.fromEntries((Object.keys(MAILBOX_PROPS) as Mailbox[]).map((b) => [b, mailboxOf(gas, b)])) as Mailboxes;
  return { mailboxes, owner: gas.props.get('OWNER_EMAIL')?.trim().toLowerCase() ?? '', aliases: aliasesOf(gas), quota: quotaOf(gas) };
}

function aliasesOf(gas: Gas): string[] {
  try {
    return gas.mail.aliases().map((a) => a.trim().toLowerCase());
  } catch (e) {
    // No Gmail permission yet (the owner has not authorised the new scope): no sender addresses.
    gas.log(`mail.aliases: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

function quotaOf(gas: Gas): number | null {
  try {
    return gas.mail.quota();
  } catch {
    return null;
  }
}

/** `mail.settings.set` (panel): an empty field goes back to the owner's address. */
export function saveMailboxes(gas: Gas, p: Record<string, unknown>): ReturnType<typeof readMailboxes> {
  const input = (p.mailboxes ?? {}) as Record<string, unknown>;
  const next = {} as Mailboxes;
  for (const box of Object.keys(MAILBOX_PROPS) as Mailbox[]) {
    const v = typeof input[box] === 'string' ? (input[box] as string).trim().toLowerCase() : '';
    if (v && (v.length > 254 || !EMAIL_RE.test(v))) throw new ApiError('bad_request', `Bu adres geçerli görünmüyor: ${v}`, { reason: 'invalid', box });
    next[box] = v;
  }
  const aliases = aliasesOf(gas);
  for (const box of SENDERS) {
    if (next[box] && !aliases.includes(next[box])) {
      throw new ApiError('bad_request', `${next[box]} Gmail'de "Farklı adresten gönder" olarak eklenmemiş. Önce rehberdeki adımları yapın, sonra tekrar kaydedin.`, { reason: 'alias', box });
    }
  }
  for (const box of Object.keys(MAILBOX_PROPS) as Mailbox[]) {
    if (next[box]) gas.props.set(MAILBOX_PROPS[box], next[box]);
    else gas.props.del(MAILBOX_PROPS[box]);
  }
  return readMailboxes(gas);
}

/** `mail.test` (panel): one short e-mail to each address in use, so the owner sees where each lands. */
export function testMailboxes(gas: Gas): { sent: number } {
  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) throw badRequest('OWNER_EMAIL eksik.');
  const lines = (what: string) => [`Bu bir deneme e-postasıdır (${what}).`, '', 'Panelde Terapist profili → E-posta adresleri bölümünden gönderildi. Bir şey yapmanıza gerek yok.'].join('\n');
  gas.mail.send({ ...noticeFrom(gas), to: notifyTo(gas, owner), replyTo: owner, subject: '[klinikterapist] Deneme: bildirim adresi', body: lines('sistem bildirimleri buraya gelir'), name: 'Randevu Sistemi' });
  let sent = 1;
  for (const box of SENDERS) {
    const from = mailboxOf(gas, box);
    if (!from) continue;
    gas.mail.send({ to: owner, from, replyTo: from, subject: `[klinikterapist] Deneme: ${from} adresinden`, body: lines(box === 'booking' ? 'danışanlara randevu e-postaları bu adresten gider' : 'bilgi formu cevapları bu adresten gider'), name: SENDER_NAME });
    sent++;
  }
  for (const [box, what] of [['contact', 'Türkçe iletişim formu'], ['contactEn', 'İngilizce iletişim formu']] as const) {
    const to = mailboxOf(gas, box);
    if (!to) continue;
    gas.mail.send({ ...noticeFrom(gas, to), to, replyTo: owner, subject: `[klinikterapist] Deneme: ${to}`, body: lines(`${what} mesajları bu adrese gelir`), name: 'İletişim Formu' });
    sent++;
  }
  return { sent };
}
