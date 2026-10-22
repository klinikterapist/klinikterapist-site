/**
 * The values that fill the Turkish e-mail texts (mail-templates-tr.ts), made the same way by the
 * panel and the backend.
 */
import { INTRO_FOR, INTRO_TOPICS, SESSION_TYPES, formatDay } from './booking-form';
import { pathFor } from '../i18n/routes';

export const SITE = 'https://klinikterapist.com';

/** The 24-hour rule, as the e-mails say it under "İptal ve erteleme kuralı". */
export const RULE_TR = 'Seansa 24 saatten az kala yapılan iptal ve ertelemelerde seans ücretinin tamamı ödenir.';

export const LINKS_TR = {
  randevu_baglantisi: `${SITE}${pathFor('appointment', 'tr')}`,
  on_gorusme_baglantisi: `${SITE}${pathFor('preConsult', 'tr')}`,
  aydinlatma_baglantisi: `${SITE}${pathFor('privacyNotice', 'tr')}`,
};

/** {tarih} "12 Kasım 2026, Perşembe" and {saat} "18.00". */
export const whenVars = (day: string, time: string) => ({ tarih: formatDay(day, 'tr'), saat: time.replace(':', '.') });

/** {gonderim}: an instant in Turkey time, "20 Ekim 2026, Salı, 10.00". */
export function stamp(ms: number): string {
  const iso = new Date(ms + 3 * 3600e3).toISOString();
  return `${formatDay(iso.slice(0, 10), 'tr')}, ${iso.slice(11, 16).replace(':', '.')}`;
}

/** The first letter in upper case, for a value at the start of a list item. */
export const upFirst = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1) : s);

const sessionType = (type?: string) => SESSION_TYPES.find((t) => t.id === type) ?? SESSION_TYPES[0];

/** {tur} and {sure} of a session; the intro call when `intro`. */
export const typeVars = (type: string | undefined, intro = false) =>
  intro ? { tur: 'Ücretsiz ön görüşme', sure: '25–30 dakika' } : { tur: sessionType(type).tr, sure: `${sessionType(type).minutes} dakika` };

/** Who the intro call is for, said to the person ("kendiniz için") or about them ("Kendisi için"). */
const FOR_WHOM: Record<(typeof INTRO_FOR)[number]['id'], { you: string; them: string }> = {
  individual: { you: 'kendiniz için', them: 'Kendisi için' },
  couple: { you: 'partnerinizle birlikte', them: 'Partneriyle birlikte' },
  accessible: { you: 'kendiniz için, uygun ücretle', them: 'Kendisi için, uygun ücretle' },
};

export function forWhom(id: string | undefined, to: 'you' | 'them'): string {
  const f = INTRO_FOR.find((x) => x.id === id);
  return f ? FOR_WHOM[f.id][to] : '';
}

/** {konular}: the chosen topics as a list. */
export const topicList = (topics: number[] | undefined) =>
  (topics ?? [])
    .map((i) => INTRO_TOPICS.tr[i])
    .filter(Boolean)
    .map((t) => `– ${t}`)
    .join('\n');
