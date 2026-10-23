/**
 * Booking and intro-call requests: the fixed choices, the field rules and the free times, shared by
 * the site (the step-by-step forms) and the Apps Script backend (`booking.request`, which checks
 * everything again). Apps Script bundles this file too, so it imports only dependency-free files.
 *
 * Times are Istanbul wall times (Turkey has kept +03:00 all year since 2016).
 */
import { DAY_RE, EMAIL_RE, TIME_RE } from './field-rules';
import { isCountry } from './phone';

export type BookingLang = 'tr' | 'en';
export type BookingKind = 'session' | 'intro';

/** One kind's weekly template: weekday (0 = Sunday … 6 = Saturday) → `HH:MM` start times. */
export type Availability = { weekdays: Partial<Record<'0' | '1' | '2' | '3' | '4' | '5' | '6', string[]>>; minNoticeHours: number; weeksAhead: number };
/** A public holiday: closed all day, or from `from` on (a bayram eve closes at 13:00). */
export type ClosedDay = { date: string; name: string; from?: string };
export type BookingConfig = {
  session: Availability;
  intro: Availability;
  /** Rest after every appointment, in minutes: a booking holds its length plus this. */
  restMinutes: number;
  closed: ClosedDay[];
  /**
   * Randevu alımı per language (owner's decision 2026-10-21, Ayarlar › Önemli ayarlar): false closes
   * the booking and intro-call forms of that language and the site's buttons say so. Without the
   * field Turkish is open and English closed.
   */
  intake?: { tr: boolean; en: boolean };
};

/** Whether booking is open in this language (booking.json `intake`). */
export const intakeOpen = (cfg: Pick<BookingConfig, 'intake'>, lang: BookingLang): boolean => cfg.intake?.[lang] ?? lang === 'tr';

export const SESSION_TYPES = [
  { id: 'individual', tr: 'Bireysel terapi', en: 'Individual therapy', minutes: 50 },
  { id: 'couple', tr: 'Çift terapisi', en: 'Couples therapy', minutes: 60 },
  { id: 'accessible', tr: 'Erişilebilir seans', en: 'Accessible session', minutes: 50 },
] as const;

export const INTRO_MINUTES = 30;

/**
 * Preview only (owner's review a5): the panel's trial mode (`/admin/?mock`) keeps "Randevu alımı
 * kapalı" here, and the booking pages on the dev server read it, so closing can be tried before the
 * backend is live. The live site never reads it.
 */
export const PREVIEW_CLOSED_KEY = 'kt.preview.bookingClosed';

/** The trial mode's switch for one language: '1' closed, '0' open (English starts closed). */
export const previewClosedKey = (lang: BookingLang): string => (lang === 'tr' ? PREVIEW_CLOSED_KEY : `${PREVIEW_CLOSED_KEY}.${lang}`);

/** How long an appointment lasts (without the rest). */
export function minutesOf(kind: BookingKind, type?: string): number {
  if (kind === 'intro') return INTRO_MINUTES;
  return SESSION_TYPES.find((t) => t.id === type)?.minutes ?? SESSION_TYPES[0].minutes;
}

/** A taken stretch of time, epoch ms, the rest included: `[start, end)`. */
export type BusyInterval = { start: number; end: number };

/** Who the intro call is for (the owner's own wording); the owner's e-mail names the therapy it points to. */
export const INTRO_FOR = [
  { id: 'individual', tr: 'Kendim için (bireysel terapi)', en: 'For myself (individual therapy)' },
  { id: 'couple', tr: 'Partnerimle birlikte (çift terapisi)', en: 'With my partner (couple therapy)' },
  { id: 'accessible', tr: 'Kendim için, uygun ücretle (erişilebilir terapi)', en: 'For myself, at a reduced fee (accessible therapy)' },
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

/** Adolescents, adults and older adults (owner's answer 2026-10-20); under 12 is not offered. */
export const AGE_RANGES = {
  tr: ['12–17 (veli ya da vasi onayıyla)', '18–24', '25–34', '35–44', '45–54', '55–64', '65 ve üzeri'],
  en: ['12–17 (with a parent’s or guardian’s consent)', '18–24', '25–34', '35–44', '45–54', '55–64', '65 and over'],
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
  /**
   * Explicit consent for health-related data. Intro: the topic choices (required when a topic is
   * picked). Session: the note (owner's note 2026-10-22), required when a note is written; left out
   * by forms sent before it was asked.
   */
  healthConsent?: boolean;
  /**
   * Where the person lives, one of COUNTRIES (lib/phone.ts). Intro since 2026-10-22, session since
   * 2026-10-23; optional for forms sent before it was asked.
   */
  country?: string;
};

export type BookingField = 'type' | 'slot' | 'name' | 'email' | 'phone' | 'note' | 'consent' | 'forWhom' | 'topics' | 'age' | 'healthConsent' | 'country';
export type BookingErrors = Partial<Record<BookingField, 'required' | 'invalid' | 'tooLong' | 'taken'>>;

const HOUR = 3600 * 1000;

/** The instant of an Istanbul wall time. */
export const slotInstant = (day: string, time: string) => Date.parse(`${day}T${time}:00+03:00`);

/** Requests are kept at most this many days (an approved one at least until its appointment has passed). */
export const REQUEST_KEEP_DAYS = 30;

/**
 * When a request and its details are deleted (review E4): 30 days after it came. An approved one
 * waits at least until a day after its appointment, so an appointment booked further ahead keeps
 * its person; its calendar entry, by then in the past, goes with it.
 */
export function requestKeepUntil(r: { createdAt: number; status: string; day: string; time: string }): number {
  const base = r.createdAt + REQUEST_KEEP_DAYS * 24 * HOUR;
  return r.status === 'approved' ? Math.max(base, slotInstant(r.day, r.time) + 24 * HOUR) : base;
}

/** The holiday on `day`, if any. */
export const closedOn = (cfg: Pick<BookingConfig, 'closed'>, day: string): ClosedDay | null => cfg.closed.find((c) => c.date === day) ?? null;

/**
 * Bookable start times of `day` (`YYYY-MM-DD`) for a kind, at `now` (epoch ms): the weekly template
 * minus holidays, a bayram eve's afternoon, and too-soon and too-far times. Taken times stay in.
 */
export function timesFor(cfg: BookingConfig, kind: BookingKind, day: string, now: number): string[] {
  if (!DAY_RE.test(day)) return [];
  const av = cfg[kind];
  const holiday = closedOn(cfg, day);
  if (holiday && !holiday.from) return [];
  const weekday = String(new Date(`${day}T12:00:00Z`).getUTCDay()) as keyof Availability['weekdays'];
  const earliest = now + av.minNoticeHours * HOUR;
  const latest = now + av.weeksAhead * 7 * 24 * HOUR;
  return (av.weekdays[weekday] ?? []).filter((t) => {
    if (!TIME_RE.test(t)) return false;
    if (holiday?.from && t >= holiday.from) return false;
    const at = slotInstant(day, t);
    return at >= earliest && at <= latest;
  });
}

/** The stretch an appointment at `day time` holds: its length plus the rest. */
export function holdOf(day: string, time: string, minutes: number, restMinutes: number): BusyInterval {
  const start = slotInstant(day, time);
  return { start, end: start + (minutes + restMinutes) * 60 * 1000 };
}

export const overlaps = (a: BusyInterval, b: BusyInterval) => a.start < b.end && b.start < a.end;

/** A client's weekly session (Randevu takibi): same weekday and time every week from `since` on. */
export type WeeklySlot = { weekday: number; time: string; minutes: number; since: string };

/** The stretches the weekly sessions hold between `from` and `to` (epoch ms), rest included. */
export function weeklyBusy(slots: WeeklySlot[], restMinutes: number, from: number, to: number): BusyInterval[] {
  const out: BusyInterval[] = [];
  const DAY = 24 * HOUR;
  // Istanbul days: shift by +3 h so the UTC date is the Istanbul date.
  for (let t = from - DAY; t <= to + DAY; t += DAY) {
    const day = new Date(t + 3 * HOUR).toISOString().slice(0, 10);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    for (const s of slots) {
      if (s.weekday !== weekday || day < s.since) continue;
      const hold = holdOf(day, s.time, s.minutes, restMinutes);
      if (hold.end > from && hold.start < to) out.push(hold);
    }
  }
  return out;
}

/** The day's bookable times, each marked taken ("Dolu") when it would overlap a booking. */
export function slotsFor(cfg: BookingConfig, kind: BookingKind, day: string, now: number, busy: BusyInterval[], minutes = minutesOf(kind)): { time: string; taken: boolean }[] {
  return timesFor(cfg, kind, day, now).map((time) => {
    const mine = holdOf(day, time, minutes, cfg.restMinutes);
    return { time, taken: busy.some((b) => overlaps(mine, b)) };
  });
}

/** Phone numbers: digits with spaces, dashes, dots, brackets and a leading +. */
const phoneDigits = (s: string) => (/^\+?[\d\s().-]+$/.test(s) ? s.replace(/\D/g, '').length : -1);

/** Every rule; the form shows them inline and the backend runs the same check. */
export function validateBooking(input: BookingInput, cfg: BookingConfig, now: number, busy: BusyInterval[] = []): BookingErrors {
  const errors: BookingErrors = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  if (input.kind === 'session' && !SESSION_TYPES.some((t) => t.id === input.type)) errors.type = 'required';
  if (!timesFor(cfg, input.kind, input.day, now).includes(input.time)) errors.slot = 'invalid';
  else if (busy.some((b) => overlaps(holdOf(input.day, input.time, minutesOf(input.kind, input.type), cfg.restMinutes), b))) errors.slot = 'taken';
  if (!name) errors.name = 'required';
  else if (name.length > BOOKING_LIMITS.nameMax) errors.name = 'tooLong';
  if (!email) errors.email = 'required';
  else if (email.length > BOOKING_LIMITS.emailMax || !EMAIL_RE.test(email)) errors.email = 'invalid';
  const digits = phoneDigits(phone);
  if (!phone) errors.phone = 'required';
  // The form allows at most phoneMax characters, separators included; spaces cannot make it longer.
  else if (digits < BOOKING_LIMITS.phoneMin || phone.length > BOOKING_LIMITS.phoneMax) errors.phone = 'invalid';
  if (input.note.trim().length > BOOKING_LIMITS.noteMax) errors.note = 'tooLong';
  if (!input.consent) errors.consent = 'required';
  if (input.kind === 'session' && input.healthConsent === false && input.note.trim()) errors.healthConsent = 'required';
  if (input.kind === 'intro') {
    if (!INTRO_FOR.some((f) => f.id === input.forWhom)) errors.forWhom = 'required';
    const topics = input.topics ?? [];
    if (!topics.length) errors.topics = 'required';
    else if (topics.some((i) => !Number.isInteger(i) || i < 0 || i >= INTRO_TOPICS.tr.length) || new Set(topics).size !== topics.length) errors.topics = 'invalid';
    if (!Number.isInteger(input.age) || input.age! < 0 || input.age! >= AGE_RANGES.tr.length) errors.age = 'required';
    if (topics.length && !input.healthConsent) errors.healthConsent = 'required';
  }
  if (input.country && !isCountry(input.country)) errors.country = 'invalid';
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

const FOLD: Record<string, string> = { Ç: 'C', Ğ: 'G', İ: 'I', I: 'I', Ö: 'O', Ş: 'S', Ü: 'U', Â: 'A', Î: 'I', Û: 'U' };

/**
 * A Seans takip number (owner's format 2026-10-20): KT, the running number in three digits and the
 * initials of the name, Turkish letters folded — "Osman Güneş Özkurt", 1 → KT001OGO.
 */
export function clientNumber(seq: number, name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR'))
    .map((c) => FOLD[c] ?? c)
    .filter((c) => /[A-Z]/.test(c))
    .slice(0, 4)
    .join('');
  return `KT${String(seq).padStart(3, '0')}${initials}`;
}
