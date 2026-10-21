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
import { mailTexts, withTexts } from './mail-texts';

export type PaymentSettings = {
  /** The year the fees are for. */
  year: number;
  /** Fee per session type (`individual`, `couple`, `accessible`), Turkish lira; 0 = not set. */
  fees: Record<string, number>;
  /** Bank details as the owner writes them (account holder, bank, IBAN). */
  bank: string;
  /** An optional payment page link. */
  link: string;
  /** Payment due this many hours before the session. */
  dueHours: 24 | 48;
};

export const EMPTY_PAYMENT: PaymentSettings = { year: 0, fees: {}, bank: '', link: '', dueHours: 24 };

const LINK_RE = /^https:\/\/[^\s<>"]{4,300}$/;

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
    link: typeof o.link === 'string' && LINK_RE.test(o.link.trim()) ? o.link.trim() : '',
    dueHours: o.dueHours === 48 ? 48 : 24,
  };
}

/** The Istanbul year of `now`. */
export const istanbulYear = (now: number) => new Date(now + 3 * 3600e3).getUTCFullYear();

/** Fees for an earlier year (or none at all): the panel asks the owner to update them. */
export const feesOutdated = (p: PaymentSettings, now: number) => p.year < istanbulYear(now) || SESSION_TYPES.every((t) => !p.fees[t.id]);

export const formatFee = (n: number, lang: 'tr' | 'en') => (lang === 'en' ? `TRY ${n.toLocaleString('en-US')}` : `${n.toLocaleString('tr-TR')} TL`);

/** The lines that say how to pay: fee, when, where. Empty settings say the details follow. */
export function paymentLines(p: PaymentSettings, type: string, lang: 'tr' | 'en'): string[] {
  const fee = p.fees[type] ?? 0;
  const where = [p.bank, p.link].filter(Boolean);
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

const SIGN = { tr: ['Saygılarımla,', 'Osman Güneş Özkurt', 'Klinik Psikolog', 'klinikterapist.com'], en: ['Kind regards,', 'Osman Güneş Özkurt', 'Clinical Psychologist', 'klinikterapist.com'] };
const at = (s: Session, lang: 'tr' | 'en') => `${formatDay(s.day, lang)}, ${lang === 'en' ? 'at ' : 'saat '}${s.time.replace(':', '.')}`;
const typeName = (type: string, lang: 'tr' | 'en') => {
  const t = SESSION_TYPES.find((x) => x.id === type) ?? SESSION_TYPES[0];
  return lang === 'en' ? t.en.toLowerCase() : t.tr.toLocaleLowerCase('tr-TR');
};

/** After the owner marks a session paid: thanks, and one sentence for the work ahead. */
function builtThanksMail(c: Person, s: Session): Mail {
  const lang = c.lang;
  const line = motivationFor(`${s.day}T${s.time}`, lang);
  if (lang === 'en') {
    return {
      subject: 'Your payment has been received – klinikterapist.com',
      body: [`Dear ${c.name.trim()},`, '', `The payment for your session on ${at(s, 'en')} (Turkey time) has been received. Thank you.`, '', line, '', 'See you in our session.', '', ...SIGN.en].join('\n'),
    };
  }
  return {
    subject: 'Ödemeniz alındı – klinikterapist.com',
    body: [`Sayın ${c.name.trim()},`, '', `${at(s, 'tr')} seansınızın ödemesi alındı. Teşekkür ederim.`, '', line, '', 'Seansımızda görüşmek üzere.', '', ...SIGN.tr].join('\n'),
  };
}

/** A payment reminder: the 48-hour one (automatic) and the owner's own from the client's page. */
function builtPaymentReminderMail(c: Person, s: Session, type: string, p: PaymentSettings): Mail {
  const lang = c.lang;
  if (lang === 'en') {
    return {
      subject: 'Payment reminder for your session – klinikterapist.com',
      body: [`Dear ${c.name.trim()},`, '', `The payment for your session on ${at(s, 'en')} (Turkey time) has not reached me yet.`, ...paymentLines(p, type, 'en'), '', 'If you have already paid, please disregard this e-mail.', ruleLine('en'), '', ...SIGN.en].join('\n'),
    };
  }
  return {
    subject: 'Seans ödemesi hatırlatması – klinikterapist.com',
    body: [`Sayın ${c.name.trim()},`, '', `${at(s, 'tr')} seansınızın ödemesi henüz bana ulaşmadı.`, ...paymentLines(p, type, 'tr'), '', 'Ödemeyi yaptıysanız bu e-postayı dikkate almayın.', ruleLine('tr'), '', ...SIGN.tr].join('\n'),
  };
}

/**
 * Three days before: the session, the payment when it is a paid session not yet paid, the rule,
 * and the client's page (when there is one) to cancel or move it.
 */
export function sessionReminderMail(c: Person, s: Session, what: { type: string; free: boolean; paid: boolean }, p: PaymentSettings, page?: string): Mail {
  const lang = c.lang;
  const pay =
    !what.free && !what.paid
      ? ['', ...paymentLines(p, what.type, lang), lang === 'en' ? 'If you have already paid, please disregard this part.' : 'Ödemeyi yaptıysanız bu kısmı dikkate almayın.']
      : [];
  if (lang === 'en') {
    const kind = what.free ? 'free session' : `${typeName(what.type, 'en').replace(/ session$/, '')} session`;
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
        ...SIGN.en,
      ].join('\n'),
    };
  }
  const kind = what.free ? 'ücretsiz görüşmenizi' : `${typeName(what.type, 'tr').replace(/ seans$/, '')} seansınızı`;
  return {
    subject: `Seans hatırlatması: ${formatDay(s.day, 'tr')} – klinikterapist.com`,
    body: [
      `Sayın ${c.name.trim()},`,
      '',
      `${at(s, 'tr')} ${kind} hatırlatmak isterim.`,
      ...pay,
      '',
      ruleLine('tr'),
      ...(page ? [`Seansı iptal etmek ya da ertelemek için randevu sayfanızı kullanabilirsiniz: ${page}`] : ['Seansı iptal etmek ya da ertelemek için bu e-postayı yanıtlayabilirsiniz.']),
      '',
      ...SIGN.tr,
    ].join('\n'),
  };
}

/** After the owner marks a session paid; the owner's template ("odeme.tesekkur") when there is one. */
export function thanksMail(c: Person, s: Session): Mail {
  return withTexts('odeme.tesekkur', c.lang, { ad: c.name.trim(), zaman: at(s, c.lang), motivasyon: motivationFor(`${s.day}T${s.time}`, c.lang) }, builtThanksMail(c, s));
}

/** The payment reminder; the owner's template ("odeme.hatirlatma") when there is one. */
export function paymentReminderMail(c: Person, s: Session, type: string, p: PaymentSettings): Mail {
  return withTexts('odeme.hatirlatma', c.lang, { ad: c.name.trim(), zaman: at(s, c.lang), odeme: paymentLines(p, type, c.lang).join('\n'), kural: ruleLine(c.lang) }, builtPaymentReminderMail(c, s, type, p));
}
