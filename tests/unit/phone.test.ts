// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { COUNTRIES, countryName, isCountry, joinPhone } from '../../src/lib/phone';
import { mountCountry, readPhone } from '../../src/components/appointment/phone-field';

describe('phone code and country (owner’s note 2026-10-22)', () => {
  it('Türkiye comes first and "Diğer" last, with no code of its own', () => {
    expect(COUNTRIES[0]).toMatchObject({ id: 'TR', dial: '+90' });
    expect(COUNTRIES.at(-1)).toMatchObject({ id: 'other', dial: '' });
    expect(new Set(COUNTRIES.map((c) => c.id)).size).toBe(COUNTRIES.length);
  });

  it('joins the code and the digits, dropping a Turkish leading 0', () => {
    expect(joinPhone('+90', '0532 123 45 67')).toBe('+90 5321234567');
    expect(joinPhone('+49', '0151-1234 5678')).toBe('+49 15112345678');
    // "Diğer" or a number typed with its own code stays as typed.
    expect(joinPhone('', '+61 412 345 678')).toBe('+61 412 345 678');
    expect(joinPhone('+90', '+44 7911 123456')).toBe('+44 7911 123456');
    expect(joinPhone('+90', '  ')).toBe('');
  });

  it('names and checks countries', () => {
    expect(countryName('DE', 'tr')).toBe('Almanya');
    expect(countryName('DE', 'en')).toBe('Germany');
    expect(countryName('XX', 'tr')).toBe('');
    expect(isCountry('NL')).toBe(true);
    expect(isCountry('XX')).toBe(false);
  });

  it('reads the joined number from the form, and the country picks the code until the code is chosen by hand', () => {
    document.body.innerHTML = `
      <select name="country" data-country><option value=""></option><option value="DE">Almanya</option><option value="NL">Hollanda</option></select>
      <select name="phoneCode" data-phone-code><option value="TR" data-dial="+90" selected>TR</option><option value="DE" data-dial="+49">DE</option><option value="NL" data-dial="+31">NL</option></select>
      <input name="phone" value="0532 000 00 00">`;
    expect(readPhone(document, 'phone')).toBe('+90 5320000000');
    mountCountry(document);
    const country = document.querySelector<HTMLSelectElement>('[data-country]')!;
    const code = document.querySelector<HTMLSelectElement>('[data-phone-code]')!;
    country.value = 'DE';
    country.dispatchEvent(new Event('change'));
    expect(code.value).toBe('DE');
    expect(readPhone(document, 'phone')).toBe('+49 5320000000');
    code.value = 'TR';
    code.dispatchEvent(new Event('change'));
    country.value = 'NL';
    country.dispatchEvent(new Event('change'));
    expect(code.value).toBe('TR');
  });
});
