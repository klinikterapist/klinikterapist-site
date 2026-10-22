/**
 * One way in (owner's decision 2026-10-20, Faz 3): every "Randevu Al" leads to the start page
 * (`/randevu-al/`), which offers the free intro call first, booking a session, or the process
 * information. The booking forms went live with it on 2026-10-21 (owner's decision: real people try
 * the whole system while the site is kept out of search results). Booking is closed per language in
 * Ayarlar › Önemli Ayarlar (booking-intake.ts).
 */
import type { Lang } from './settings';
import { pathFor } from '../i18n/routes';

export const ENTRY_PATH = { tr: '/randevu-al/', en: '/en/book/' } as const;

/** The start page's third way, "Önce bilgi almak istiyorum": the process information form on its own page. */
export const INFO_PATH = { tr: '/bilgi-al/', en: '/en/information/' } as const;

/** Whether the booking forms (and so the start page) are in use: live since 2026-10-21. */
export const bookingLive = (): boolean => true;

/** Where "Randevu Al" goes. */
export const bookPath = (lang: Lang): string => (bookingLive() ? ENTRY_PATH[lang] : pathFor('appointment', lang));
