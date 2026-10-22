/**
 * Session fees and payment (owner's decisions 2026-10-20, roadmap Faz 1). The fees are not on the
 * site and never in the repository: the owner keeps them, the bank details and an optional payment
 * link in the backend's script properties (`payment.get` / `payment.set`). They go only to people
 * with an appointment: in the approval e-mail, the reminders and a payment reminder.
 * - Payment is due `dueHours` (24 or 48) before the session. Reminders: 72 hours before (the
 *   session, the payment when not yet paid, the rules), 48 hours before (the payment, still unpaid);
 *   at `dueHours` before, still unpaid, the owner is told. Nothing is moved by itself: the owner
 *   decides (Ertele on the client's page).
 * - The owner marks a session paid by hand; the client then gets a thank-you with a short sentence
 *   for the work ahead. The free sessions (intro call, closing session) have no fee.
 * - The fees change every new year: the panel reminds the owner when `year` is behind.
 * Shared by the panel and the backend; the texts are drafts for the owner to approve.
 */
import { SESSION_TYPES, formatDay } from './booking-form';
import { mailTexts, mailTr, withTexts } from './mail-texts';
import { RULE_TR, typeVars, whenVars } from './mail-vars';

const typeOf = (type?: string) => SESSION_TYPES.find((t) => t.id === type) ?? SESSION_TYPES[0];

export type PaymentSettings = {
  /** The year the fees are for. */
  year: number;
  /** Fee per session type (`individual`, `couple`, `accessible`), Turkish lira; 0 = not set. */
  fees: Record<string, number>;
  /** Bank details as the owner wrote them before the separate fields (kept when those are empty). */
  bank: string;
  /** Account holder, bank name and IBAN (owner's request 2026-10-22: one line each in the e-mails). */
  holder: string;
  bankName: string;
  iban: string;
  /** An optional payment page link. */
  link: string;
  /** Payment due this many hours before the session. */
  dueHours: 24 | 48;
  /** The payment QR code image (base64), kept in Drive, not with the rest; only in `payment.get` / `payment.set`. */
  qr?: string;
};

export const EMPTY_PAYMENT: PaymentSettings = { year: 0, fees: {}, bank: '', holder: '', bankName: '', iban: '', link: '', dueHours: 24 };

const LINK_RE = /^https:\/\/[^\s<>"]{4,300}$/;

const field = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** The settings as stored, or as sent by the panel: only known fields, of the right types. */
export function parsePayment(v: unknown): PaymentSettings {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const fees: Record<string, number> = {};
  const raw = o.fees && typeof o.fees === 'object' ? (o.fees as Record<string, unknown>) : {};
  for (const t of SESSION_TYPES) {
    const n = Number(raw[t.id]);
    fees[t.id] = Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n) : 0;
  }
  const year = Number(o.year);
  return {
    year: Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : 0,
    fees,
    bank: typeof o.bank === 'string' ? o.bank.trim().slice(0, 600) : '',
    holder: field(o.holder, 120),
    bankName: field(o.bankName, 120),
    iban: field(o.iban, 60).toUpperCase(),
    link: typeof o.link === 'string' && LINK_RE.test(o.link.trim()) ? o.link.trim() : '',
    dueHours: o.dueHours === 48 ? 48 : 24,
  };
}

/** A client's own fee (owner's note 2026-10-22), or none: the fee of their session type then applies. */
export const parseFee = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(/\D/g, '')) : Number(v);
  return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n) : undefined;
};

/** The settings with `fee` in place of the type's fee, so every e-mail to that client says their fee. */
export const withClientFee = (p: PaymentSettings, type: string | undefined, fee?: number): PaymentSettings =>
  fee ? { ...p, fees: { ...p.fees, [typeOf(type).id]: fee } } : p;

/** What one session of this client costs: their own fee, else their session type's (0: not set). */
export const feeOf = (p: PaymentSettings, type: string | undefined, fee?: number): number => fee ?? p.fees[typeOf(type).id] ?? 0;

/** The Istanbul year of `now`. */
export const istanbulYear = (now: number) => new Date(now + 3 * 3600e3).getUTCFullYear();

/** Fees for an earlier year (or none at all): the panel asks the owner to update them. */
export const feesOutdated = (p: PaymentSettings, now: number) => p.year < istanbulYear(now) || SESSION_TYPES.every((t) => !p.fees[t.id]);

export const formatFee = (n: number, lang: 'tr' | 'en') => (lang === 'en' ? `TRY ${n.toLocaleString('en-US')}` : `${n.toLocaleString('tr-TR')} TL`);

/** "[karekod]" on a line of its own: the payment QR code in the HTML part, left out of the plain text. */
export const QR_LINE = '[karekod]';

/**
 * Where to pay, as "– Label: value" lines (owner's request 2026-10-22), then the QR code line when
 * there is one. Settings from before the separate fields give their free text instead. Empty: [].
 */
export function paymentInfo(p: PaymentSettings, lang: 'tr' | 'en', hasQr = false): string[] {
  const L =
    lang === 'en'
      ? { cur: ['Currency', 'Turkish lira (TRY)'], bank: 'Bank', iban: 'IBAN', holder: 'Account holder', link: 'Payment link' }
      : { cur: ['Para birimi', 'Türk lirası (TL)'], bank: 'Banka', iban: 'IBAN', holder: 'Hesap sahibi', link: 'Ödeme bağlantısı' };
  const fields = p.iban || p.holder || p.bankName;
  const lines = fields
    ? [
        `– ${L.cur[0]}: ${L.cur[1]}`,
        ...(p.bankName ? [`– ${L.bank}: ${p.bankName}`] : []),
        ...(p.iban ? [`– ${L.iban}: ${p.iban}`] : []),
        ...(p.holder ? [`– ${L.holder}: ${p.holder}`] : []),
      ]
    : p.bank
      ? [p.bank]
      : [];
  if (p.link) lines.push(`– ${L.link}: ${p.link}`);
  if (lines.length && hasQr) lines.push(QR_LINE);
  return lines;
}

/**
 * {ucret}, {odeme_bilgileri}, {odeme_suresi}. `qr`: a QR code is set (its line becomes the image).
 * With no payment details yet, the e-mail says they follow.
 */
export function payVars(p: PaymentSettings, type: string | undefined, qr: boolean) {
  const fee = p.fees[typeOf(type).id] ?? 0;
  const info = paymentInfo(p, 'tr', qr);
  return {
    ucret: fee ? formatFee(fee, 'tr') : '',
    odeme_bilgileri: info.length ? info.join('\n') : 'Ödeme bilgilerini ayrıca ileteceğim.',
    odeme_suresi: String(p.dueHours),
    kural: RULE_TR,
  };
}

/** The lines that say how to pay: fee, when, where. Empty settings say the details follow. */
export function paymentLines(p: PaymentSettings, type: string, lang: 'tr' | 'en', hasQr = false): string[] {
  const fee = p.fees[type] ?? 0;
  const where = paymentInfo(p, lang, hasQr);
  if (lang === 'en') {
    return [
      ...(fee ? [`Session fee: ${formatFee(fee, 'en')}.`] : []),
      `Please make the payment at the latest ${p.dueHours} hours before the session${where.length ? ':' : '. I will send you the payment details separately.'}`,
      ...where,
    ];
  }
  return [
    ...(fee ? [`Seans ücreti: ${formatFee(fee, 'tr')}.`] : []),
    `Ödemeyi seanstan en geç ${p.dueHours} saat önce ${where.length ? 'aşağıdaki bilgilerle yapmanızı rica ederim:' : 'yapmanızı rica ederim. Ödeme bilgilerini ayrıca ileteceğim.'}`,
    ...where,
  ];
}

/** The cancellation rule, as the client's page and the booking page say it. */
export const ruleLine = (lang: 'tr' | 'en') =>
  lang === 'en'
    ? 'Important: for a session cancelled or moved less than 24 hours before it starts, the full session fee is due.'
    : 'Önemli: Seansa 24 saatten az kala yapılan iptal ve ertelemelerde seans ücretinin tamamı ödenir.';

/** Short sentences for the thank-you after a payment (drafts; the owner approves them). */
export const MOTIVATION = {
  tr: [
    'Kendinize bu zamanı ayırmanız, attığınız en değerli adımlardan biri.',
    'Her seans, kendinizi biraz daha iyi tanımak için yeni bir fırsat.',
    'Bu süreçte gösterdiğiniz emeğe ve kararlılığa saygı duyuyorum.',
    'Değişim çoğu zaman küçük adımlarla gelir; seanslara düzenli gelmeniz de bu adımlardan biri.',
    'Kendinize iyi bakmaya zaman ayırdığınız için teşekkür ederim.',
    'Birlikte çalıştığımız her hafta, bir öncekinin üzerine bir şey ekliyor.',
  ],
  en: [
    'The time you set aside for yourself is one of the most valuable steps you take.',
    'Every session is a new chance to understand yourself a little better.',
    'I respect the effort and commitment you bring to this work.',
    'Change often comes in small steps; coming regularly is one of them.',
    'Thank you for making time to look after yourself.',
    'Each week we work together builds on the one before.',
  ],
};

/** One sentence, the same for the same session (no repeats when the e-mail is shown twice). */
export function motivationFor(seed: string, lang: 'tr' | 'en'): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const own = mailTexts().motivation?.[lang]?.filter((x) => x.trim());
  const list = own?.length ? own : MOTIVATION[lang];
  return list[h % list.length];
}

export type Mail = { subject: string; body: string };
type Person = { name: string; lang: 'tr' | 'en' };
type Session = { day: string; time: string };

const SIGN_EN = ['Kind regards,', 'Osman Güneş Özkurt', 'Clinical Psychologist', 'klinikterapist.com'];
const at = (s: Session, lang: 'tr' | 'en') => `${formatDay(s.day, lang)}, ${lang === 'en' ? 'at ' : 'saat '}${s.time.replace(':', '.')}`;

/** After the owner marks a session paid: thanks, and one sentence for the work ahead (English; Turkish: mail-templates-tr.ts). */
function builtThanksMail(c: Person, s: Session): Mail {
  return {
    subject: 'Your payment has been received – klinikterapist.com',
    body: [`Dear ${c.name.trim()},`, '', `The payment for your session on ${at(s, 'en')} (Turkey time) has been received. Thank you.`, '', motivationFor(`${s.day}T${s.time}`, 'en'), '', 'See you in our session.', '', ...SIGN_EN].join('\n'),
  };
}

/** A payment reminder: the 48-hour one (automatic) and the owner's own from the client's page (English). */
function builtPaymentReminderMail(c: Person, s: Session, type: string, p: PaymentSettings): Mail {
  return {
    subject: 'Payment reminder for your session – klinikterapist.com',
    body: [`Dear ${c.name.trim()},`, '', `The payment for your session on ${at(s, 'en')} (Turkey time) has not reached me yet.`, ...paymentLines(p, type, 'en'), '', 'If you have already paid, please disregard this e-mail.', ruleLine('en'), '', ...SIGN_EN].join('\n'),
  };
}

/**
 * Three days before: the session, the payment when it is a paid session not yet paid, the rule,
 * and the client's page (when there is one) to cancel or move it.
 */
export function sessionReminderMail(c: Person, s: Session, what: { type: string; free: boolean; paid: boolean }, p: PaymentSettings, page?: string, qr = !!p.qr): Mail {
  const lang = c.lang;
  if (lang === 'en') {
    const pay = !what.free && !what.paid ? ['', ...paymentLines(p, what.type, 'en'), 'If you have already paid, please disregard this part.'] : [];
    const kind = what.free ? 'free session' : `${typeOf(what.type).en.toLowerCase().replace(/ session$/, '')} session`;
    return {
      subject: `Reminder: your session on ${formatDay(s.day, 'en')} – klinikterapist.com`,
      body: [
        `Dear ${c.name.trim()},`,
        '',
        `A reminder of your ${kind} on ${at(s, 'en')} (Turkey time).`,
        ...pay,
        '',
        ruleLine('en'),
        ...(page ? [`To cancel or move the session, use your appointment page: ${page}`] : ['To cancel or move the session, please reply to this e-mail.']),
        '',
        ...SIGN_EN,
      ].join('\n'),
    };
  }
  // A free session (intro call, closing session) has no fee; a paid one shows the payment part until it is paid.
  return mailTr('oto.seans-hatirlatma', {
    ad: c.name.trim(),
    ...whenVars(s.day, s.time),
    ...(what.free ? { tur: 'Ücretsiz görüşme', sure: '' } : typeVars(what.type)),
    ...payVars(p, what.type, qr),
    ...(what.free || what.paid ? { ucret: '' } : {}),
    sayfa_baglantisi: page ?? '',
    '#odeme': !what.free && !what.paid ? '1' : '',
    '#sayfa': page ? '1' : '',
  });
}

/** After the owner marks a session paid; the owner's template ("odeme.tesekkur") when there is one. */
export function thanksMail(c: Person, s: Session, type?: string): Mail {
  const motivasyon = motivationFor(`${s.day}T${s.time}`, c.lang);
  if (c.lang === 'tr') return mailTr('odeme.tesekkur', { ad: c.name.trim(), ...whenVars(s.day, s.time), ...(type ? { tur: typeVars(type).tur } : { tur: '' }), motivasyon });
  return withTexts('odeme.tesekkur', 'en', { ad: c.name.trim(), zaman: at(s, 'en'), motivasyon }, builtThanksMail(c, s));
}

/**
 * The payment reminder; the owner's template ("odeme.hatirlatma") when there is one. `page`: the
 * client's own page, when known (the backend's 48-hour reminder). `qr`: a QR code is set.
 */
export function paymentReminderMail(c: Person, s: Session, type: string, p: PaymentSettings, page = '', qr = !!p.qr): Mail {
  if (c.lang === 'tr') {
    return mailTr('odeme.hatirlatma', { ad: c.name.trim(), ...whenVars(s.day, s.time), ...typeVars(type), ...payVars(p, type, qr), sayfa_baglantisi: page, '#sayfa': page ? '1' : '' });
  }
  return withTexts('odeme.hatirlatma', 'en', { ad: c.name.trim(), zaman: at(s, 'en'), odeme: paymentLines(p, type, 'en').join('\n'), kural: ruleLine('en') }, builtPaymentReminderMail(c, s, type, p));
}
