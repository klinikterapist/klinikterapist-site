/**
 * The phone field's country code and the intro call's "Nerede yaşıyorsunuz?" (owner's note
 * 2026-10-22): people abroad have other codes, so the code is a field of its own. Not every country:
 * Türkiye first, then the countries where many Turks live, then "Diğer" (the owner asks in the call).
 * Shared by the forms and the backend.
 */

export type Country = { id: string; tr: string; en: string; dial: string };

/** `other`: any other country; its phone number is typed with its own code. */
export const COUNTRIES: readonly Country[] = [
  { id: 'TR', tr: 'Türkiye', en: 'Türkiye', dial: '+90' },
  { id: 'DE', tr: 'Almanya', en: 'Germany', dial: '+49' },
  { id: 'NL', tr: 'Hollanda', en: 'Netherlands', dial: '+31' },
  { id: 'FR', tr: 'Fransa', en: 'France', dial: '+33' },
  { id: 'AT', tr: 'Avusturya', en: 'Austria', dial: '+43' },
  { id: 'BE', tr: 'Belçika', en: 'Belgium', dial: '+32' },
  { id: 'CH', tr: 'İsviçre', en: 'Switzerland', dial: '+41' },
  { id: 'GB', tr: 'Birleşik Krallık', en: 'United Kingdom', dial: '+44' },
  { id: 'US', tr: 'ABD', en: 'United States', dial: '+1' },
  { id: 'CY', tr: 'KKTC', en: 'Northern Cyprus', dial: '+90' },
  { id: 'AZ', tr: 'Azerbaycan', en: 'Azerbaijan', dial: '+994' },
  { id: 'other', tr: 'Diğer', en: 'Other', dial: '' },
];

export const countryName = (id: string | undefined, lang: 'tr' | 'en'): string => COUNTRIES.find((c) => c.id === id)?.[lang] ?? '';

export const isCountry = (id: unknown): id is string => typeof id === 'string' && COUNTRIES.some((c) => c.id === id);

/**
 * The number as it is sent: the code and the digits ("+49 15112345678"). A Turkish "0532…" loses its
 * leading 0 after the code. With no code ("Diğer") or a number typed with its own "+", the number
 * stays as typed.
 */
export function joinPhone(dial: string, number: string): string {
  const n = number.trim();
  if (!n || !dial || n.startsWith('+')) return n;
  const digits = n.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `${dial} ${digits}` : n;
}
