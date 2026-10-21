/** Server only (reads booking.json); booking-entry.ts stays importable from the pages' client scripts. */
import type { Lang } from './settings';
import { getBooking } from './settings';
import { intakeOpen } from './booking-form';
import { bookPath } from './booking-entry';
import { pathFor } from '../i18n/routes';

/**
 * Booking closed in a language (booking.json `intake`, switched in the panel's Ayarlar › Önemli
 * ayarlar; owner's decision 2026-10-21, English closed for now). The home's "Randevu Al" stays a
 * link to the booking page, which says booking is closed and offers "Haber et", but looks muted with
 * a "Randevu alımına kapalı" badge, and there is no bottom booking bar.
 */
export const bookingClosed = (lang: Lang): boolean => !intakeOpen(getBooking(), lang);

/**
 * Where the site's "Randevu Al" links go: the start page (booking-entry `bookPath`), or, while
 * booking is closed in that language, straight to the booking page that says so and offers "Haber et".
 */
export const bookHref = (lang: Lang): string => (bookingClosed(lang) ? pathFor('appointment', lang) : bookPath(lang));
