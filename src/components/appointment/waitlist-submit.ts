/**
 * The "Haber et" form (WaitlistForm.astro): checks the fields with the shared rules, posts one
 * text/plain JSON request (`booking.waitlist`) and shows the thank-you card. Without an endpoint the
 * button stays disabled and the e-mail line is the way.
 */
import { sameEmail } from '../../lib/email-check';
import { validateWaitlist, type WaitlistInput } from '../../lib/waitlist-form';
import { mountEmailGuard } from './email-guard';

export type WaitlistMessages = { sending: string; invalid: string; mismatch: string; failed: string; emailDomain?: string };

type Deps = { fetch: typeof fetch; timeoutMs?: number };

export function mountWaitlist(section: HTMLElement, endpoint: string, lang: 'tr' | 'en', messages: WaitlistMessages, deps: Deps = { fetch: window.fetch.bind(window) }) {
  mountEmailGuard(section, lang);
  const button = section.querySelector<HTMLButtonElement>('[data-wl-submit]');
  const error = section.querySelector<HTMLElement>('[data-wl-error]');
  if (!button || !endpoint) return;
  section.querySelector<HTMLElement>('[data-wl-soon]')?.setAttribute('hidden', '');
  button.disabled = false;
  const idle = button.innerHTML;

  const value = (name: string) => (section.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value ?? '').trim();
  const checked = (name: string) => [...section.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map((i) => i.value);
  const say = (text: string) => {
    if (!error) return;
    error.textContent = text;
    error.hidden = !text;
    if (text) error.focus();
  };
  section.addEventListener('input', () => say(''));

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    const input: WaitlistInput = {
      name: value('wl-name'),
      email: value('wl-email'),
      phone: value('wl-phone'),
      kinds: checked('wl-kinds'),
      times: checked('wl-times'),
      reason: value('wl-reason'),
      consent: checked('wl-consent').length > 0,
      healthConsent: checked('wl-health').length > 0,
    };
    const errors = validateWaitlist(input);
    const fields: Record<string, string> = { name: 'wl-name', email: 'wl-email', phone: 'wl-phone', consent: 'wl-consent', healthConsent: 'wl-health' };
    section.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    for (const k of Object.keys(errors)) section.querySelector(`[name="${fields[k] ?? ''}"]`)?.setAttribute('aria-invalid', 'true');
    if (Object.keys(errors).length) return say(messages.invalid);
    if (!sameEmail(input.email, value('wl-email2'))) {
      section.querySelector('[name="wl-email2"]')?.setAttribute('aria-invalid', 'true');
      return say(messages.mismatch);
    }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = messages.sending;
    let sent = false;
    let badDomain = false;
    try {
      const ctrl = new AbortController();
      // Same as the booking form: the backend saves and sends two e-mails, and may start cold.
      const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 45000);
      try {
        const res = await deps.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'booking.waitlist', ...input, hp_field: value('hp_field'), lang }),
          credentials: 'omit',
          signal: ctrl.signal,
        });
        const out = (await res.json()) as { ok?: boolean; data?: { reason?: string } };
        sent = res.ok && out?.ok === true;
        badDomain = out?.data?.reason === 'email';
      } finally {
        clearTimeout(timer);
      }
    } catch {
      sent = false;
    }
    button.removeAttribute('aria-busy');
    button.innerHTML = idle;
    button.disabled = false;
    if (!sent) return say(badDomain ? (messages.emailDomain ?? messages.invalid) : messages.failed);
    section.querySelector<HTMLElement>('[data-wl-form]')?.setAttribute('hidden', '');
    const done = section.querySelector<HTMLElement>('[data-wl-done]');
    if (done) {
      done.hidden = false;
      done.focus();
    }
  });
}
