/**
 * One way in (owner's decision 2026-10-20, Faz 3): every "Randevu Al" leads to the start page
 * (`/randevu-al/`), which offers the free intro call first, booking a session, or the process
 * information. While the booking forms are not live yet (they show on the dev server, or in a build
 * with `BOOKING_DESIGN=1`), the buttons keep going to the booking page as before; when the forms go
 * live, the start page goes live with them.
 */
import type { Lang } from './settings';
import { pathFor } from '../i18n/routes';

export const ENTRY_PATH = { tr: '/randevu-al/', en: '/en/book/' } as const;

/** Whether the booking forms (and so the start page) are in use in this build. */
export const bookingLive = (): boolean => import.meta.env.DEV || process.env.BOOKING_DESIGN === '1';

/**
 * Booking that is not offered yet in a language (owner's decision 2026-10-21: no sessions in
 * English for now). The English home shows "Book a Session" as a muted, unlinked button with a
 * "Coming soon" badge, and no bottom booking bar.
 */
export const bookingSoon = (lang: Lang): boolean => lang === 'en';

/** Where "Randevu Al" goes. */
export const bookPath = (lang: Lang): string => (bookingLive() ? ENTRY_PATH[lang] : pathFor('appointment', lang));
