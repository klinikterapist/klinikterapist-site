/**
 * Booking and intro-call requests: the fixed choices, the field rules and the free times, shared by
 * the site (the step-by-step forms) and the Apps Script backend (`booking.request`, which checks
 * everything again). No imports: Apps Script bundles this file too.
 *
 * Times are Istanbul wall times (Turkey has kept +03:00 all year since 2016).
 */
export type BookingLang = 'tr' | 'en';
export type BookingKind = 'session' | 'intro';

/** One kind's weekly template: weekday (0 = Sunday … 6 = Saturday) → `HH:MM` start times. */
export type Availability = { weekdays: Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', string[]>>; minNoticeHours: number; weeksAhead: number };
export type BookingConfig = Record<BookingKind, Availability>;

export const SESSION_TYPES = [
  { id: 'individual', tr: 'Bireysel terapi', en: 'Individual therapy' },
  { id: 'couple', tr: 'Çift terapisi', en: 'Couples therapy' },
  { id: 'accessible', tr: 'Erişilebilir seans', en: 'Accessible session' },
] as const;

export const INTRO_FOR = [
  { id: 'me', tr: 'Kendim için', en: 'For myself' },
  { id: 'couple', tr: 'Partnerimle birlikte', en: 'With my partner' },
] as const;

export const INTRO_TOPICS = {
  tr: [
    'Kaygı ve stres',
    'Mutsuzluk, isteksizlik',
    'İlişki sorunları',
    'Aile ilişkileri',
    'Özgüven',
    'Yas ve kayıp',
    'Zorlayıcı bir yaşam olayı',
    'İş ya da okul',
    'Uyku',
    'Kendimi daha iyi tanımak',
    'Başka bir konu',
    'Görüşmede konuşmayı tercih ederim',
  ],
  en: [
    'Anxiety and stress',
    'Low mood, lack of motivation',
    'Relationship problems',
    'Family relationships',
    'Self-esteem',
    'Grief and loss',
    'A difficult life event',
    'Work or school',
    'Sleep',
    'Getting to know myself better',
    'Something else',
    'I would rather talk about it in the call',
  ],
} as const;

export const AGE_RANGES = {
  tr: ['18 yaşından küçük (veli ya da vasi onayıyla)', '18–24', '25–34', '35–44', '45–54', '55 ve üzeri'],
  en: ['Under 18 (with a parent’s or guardian’s consent)', '18–24', '25–34', '35–44', '45–54', '55 and over'],
} as const;

export const BOOKING_LIMITS = { nameMax: 100, emailMax: 254, phoneMin: 10, phoneMax: 20, noteMax: 500 } as const;

/** What the form sends. Session requests leave the intro fields out and the other way round. */
export type BookingInput = {
  kind: BookingKind;
  /** Session: one of SESSION_TYPES. */
  type?: string;
  /** `YYYY-MM-DD` and `HH:MM`, Istanbul. */
  day: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  /** Has read the privacy notice. */
  consent: boolean;
  /** Intro: one of INTRO_FOR. */
  forWhom?: string;
  /** Intro: indexes into INTRO_TOPICS. */
  topics?: number[];
  /** Intro: had psychological support before. */
  before?: 'yes' | 'no' | '';
  /** Intro: index into AGE_RANGES. */
  age?: number;
  /** Intro: explicit consent for the health-related topic choices (required when a topic is picked). */
  healthConsent?: boolean;
};

export type BookingField = 'type' | 'slot' | 'name' | 'email' | 'phone' | 'note' | 'consent' | 'forWhom' | 'topics' | 'age' | 'healthConsent';
export type BookingErrors = Partial<Record<BookingField, 'required' | 'invalid' | 'tooLong'>>;

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const HOUR = 3600 * 1000;

/** The instant of an Istanbul wall time. */
export const slotInstant = (day: string, time: string) => Date.parse(`${day}T${time}:00+03:00`);

/** Free start times of `day` (`YYYY-MM-DD`) for a kind, at `now` (epoch ms): the template minus too-soon and too-far ones. */
export function timesFor(av: Availability, day: string, now: number): string[] {
  if (!DAY_RE.test(day)) return [];
  const weekday = String(new Date(`${day}T12:00:00Z`).getUTCDay()) as keyof Availability['weekdays'];
  const earliest = now + av.minNoticeHours * HOUR;
  const latest = now + av.weeksAhead * 7 * 24 * HOUR;
  return (av.weekdays[weekday] ?? []).filter((t) => {
    if (!TIME_RE.test(t)) return false;
    const at = slotInstant(day, t);
    return at >= earliest && at <= latest;
  });
}

/** Phone numbers: digits with spaces, dashes, dots, brackets and a leading +. */
const phoneDigits = (s: string) => (/^\+?[\d\s().-]+$/.test(s) ? s.replace(/\D/g, '').length : -1);

/** Every rule; the form shows them inline and the backend runs the same check. */
export function validateBooking(input: BookingInput, cfg: BookingConfig, now: number): BookingErrors {
  const errors: BookingErrors = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  if (input.kind === 'session' && !SESSION_TYPES.some((t) => t.id === input.type)) errors.type = 'required';
  if (!timesFor(cfg[input.kind], input.day, now).includes(input.time)) errors.slot = 'invalid';
  if (!name) errors.name = 'required';
  else if (name.length > BOOKING_LIMITS.nameMax) errors.name = 'tooLong';
  if (!email) errors.email = 'required';
  else if (email.length > BOOKING_LIMITS.emailMax || !EMAIL_RE.test(email)) errors.email = 'invalid';
  const digits = phoneDigits(phone);
  if (!phone) errors.phone = 'required';
  else if (digits < BOOKING_LIMITS.phoneMin || digits > BOOKING_LIMITS.phoneMax) errors.phone = 'invalid';
  if (input.note.trim().length > BOOKING_LIMITS.noteMax) errors.note = 'tooLong';
  if (!input.consent) errors.consent = 'required';
  if (input.kind === 'intro') {
    if (!INTRO_FOR.some((f) => f.id === input.forWhom)) errors.forWhom = 'required';
    const topics = input.topics ?? [];
    if (!topics.length) errors.topics = 'required';
    else if (topics.some((i) => !Number.isInteger(i) || i < 0 || i >= INTRO_TOPICS.tr.length) || new Set(topics).size !== topics.length) errors.topics = 'invalid';
    if (!Number.isInteger(input.age) || input.age! < 0 || input.age! >= AGE_RANGES.tr.length) errors.age = 'required';
    if (topics.length && !input.healthConsent) errors.healthConsent = 'required';
  }
  return errors;
}

/** `'2026-10-24'` → `'24 Ekim 2026, Cumartesi'` / `'Saturday 24 October 2026'` (for e-mails; no Intl needed). */
export function formatDay(day: string, lang: BookingLang): string {
  const d = new Date(`${day}T12:00:00Z`);
  const tr = { m: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'], w: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'] };
  const en = { m: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], w: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
  const n = lang === 'en' ? en : tr;
  const dd = d.getUTCDate();
  const mm = n.m[d.getUTCMonth()];
  const yy = d.getUTCFullYear();
  const wd = n.w[d.getUTCDay()];
  return lang === 'en' ? `${wd} ${dd} ${mm} ${yy}` : `${dd} ${mm} ${yy}, ${wd}`;
}
