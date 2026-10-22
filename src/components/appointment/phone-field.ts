/**
 * PhoneField.astro in the browser: the number as it is sent (code + digits, lib/phone.ts), and the
 * intro call's country question choosing the matching code until the visitor picks one themself.
 */
import { joinPhone } from '../../lib/phone';

/** The joined phone number of the field named `name` (its code select is `<name>Code`). */
export function readPhone(root: ParentNode, name: string): string {
  const number = root.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.value ?? '';
  const code = root.querySelector<HTMLSelectElement>(`select[name="${name}Code"]`);
  return joinPhone(code?.selectedOptions[0]?.dataset.dial ?? '', number);
}

/** `[data-country]` sets the phone code to the same country, unless the code was changed by hand. */
export function mountCountry(root: ParentNode): void {
  const country = root.querySelector<HTMLSelectElement>('select[data-country]');
  const code = root.querySelector<HTMLSelectElement>('select[data-phone-code]');
  if (!country || !code) return;
  let touched = false;
  code.addEventListener('change', () => (touched = true));
  country.addEventListener('change', () => {
    if (touched || !country.value) return;
    if ([...code.options].some((o) => o.value === country.value)) code.value = country.value;
  });
}
