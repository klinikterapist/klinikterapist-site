/**
 * "Haber et" (owner's request 2026-10-20): when the owner closes booking, the booking and intro-call
 * pages say every session is taken and offer this short form instead. The person leaves their
 * details and what they are looking for; when a time frees up the owner writes to them. Shared by
 * the site form and the backend, which checks it again.
 */

export const WAITLIST_KINDS = ['individual', 'couple', 'accessible', 'intro'] as const;
export const WAITLIST_TIMES = ['weekday-day', 'weekday-evening', 'weekend'] as const;
export type WaitlistKind = (typeof WAITLIST_KINDS)[number];
export type WaitlistTime = (typeof WAITLIST_TIMES)[number];

export const WAITLIST_LABELS = {
  tr: {
    individual: 'Bireysel terapi',
    couple: 'Çift terapisi',
    accessible: 'Erişilebilir terapi',
    intro: 'Ücretsiz ön görüşme',
    'weekday-day': 'Hafta içi gündüz',
    'weekday-evening': 'Hafta içi akşam',
    weekend: 'Hafta sonu',
  },
  en: {
    individual: 'Individual therapy',
    couple: 'Couple therapy',
    accessible: 'Accessible therapy',
    intro: 'Free intro call',
    'weekday-day': 'Weekday daytime',
    'weekday-evening': 'Weekday evening',
    weekend: 'Weekend',
  },
} as const;

/** Kept at most this long, then deleted (owner's panel shows the days left). */
export const WAITLIST_KEEP_DAYS = 90;
export const WAITLIST_LIMITS = { nameMax: 100, emailMax: 254, phoneMin: 10, phoneMax: 20, reasonMax: 1000 } as const;

export type WaitlistInput = {
  name: string;
  email: string;
  phone: string;
  kinds: string[];
  times: string[];
  reason: string;
  consent: boolean;
  /** Explicit consent, needed only when a reason is written (it may be about health). */
  healthConsent: boolean;
};

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

export function validateWaitlist(i: WaitlistInput): Partial<Record<keyof WaitlistInput, 'required' | 'invalid'>> {
  const e: Partial<Record<keyof WaitlistInput, 'required' | 'invalid'>> = {};
  const name = i.name.trim();
  if (!name) e.name = 'required';
  else if (name.length < 2 || name.length > WAITLIST_LIMITS.nameMax) e.name = 'invalid';
  const email = i.email.trim();
  if (!email) e.email = 'required';
  else if (email.length > WAITLIST_LIMITS.emailMax || !EMAIL_RE.test(email)) e.email = 'invalid';
  const digits = i.phone.replace(/\D/g, '');
  if (!i.phone.trim()) e.phone = 'required';
  else if (digits.length < WAITLIST_LIMITS.phoneMin || i.phone.length > WAITLIST_LIMITS.phoneMax) e.phone = 'invalid';
  if (!i.kinds.length) e.kinds = 'required';
  else if (i.kinds.some((k) => !(WAITLIST_KINDS as readonly string[]).includes(k))) e.kinds = 'invalid';
  if (i.times.some((t) => !(WAITLIST_TIMES as readonly string[]).includes(t))) e.times = 'invalid';
  if (i.reason.length > WAITLIST_LIMITS.reasonMax) e.reason = 'invalid';
  if (!i.consent) e.consent = 'required';
  if (i.reason.trim() && !i.healthConsent) e.healthConsent = 'required';
  return e;
}
