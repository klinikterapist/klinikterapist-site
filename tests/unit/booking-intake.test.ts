import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { intakeOpen } from '../../src/lib/booking-form';

describe('Randevu alımı per language (booking.json intake)', () => {
  it('without the field Turkish is open and English closed; the field decides when present', () => {
    expect(intakeOpen({}, 'tr')).toBe(true);
    expect(intakeOpen({}, 'en')).toBe(false);
    expect(intakeOpen({ intake: { tr: false, en: true } }, 'tr')).toBe(false);
    expect(intakeOpen({ intake: { tr: false, en: true } }, 'en')).toBe(true);
  });

  it('booking-entry.ts reads no data file, so the booking pages’ client scripts can import it', () => {
    // A value import of settings.ts pulls node:fs into the browser and stops the booking form.
    expect(readFileSync('src/lib/booking-entry.ts', 'utf8')).not.toMatch(/^import \{[^}]*\} from '\.\/settings'/m);
  });
});
