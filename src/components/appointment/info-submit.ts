/**
 * Browser side of "Süreç bilgisi" on the start page (BookStartView.astro): the address typed twice
 * (with the near-miss fix), the topics, the consent; one text/plain JSON POST (`info.request`), no
 * cookies. A domain that takes no e-mail gets its own message; on success the form gives way to a
 * short note.
 *
 * Markup: [data-info] form with data-endpoint, data-lang, data-messages; [data-info-error],
 * [data-info-done].
 */
import { sameEmail } from '../../lib/email-check';
import { validateInfo } from '../../lib/info-answers';
import { mountEmailGuard } from './email-guard';

export type InfoMessages = { sending: string; invalid: string; topics: string; mismatch: string; emailDomain: string; failed: string };
type Deps = { fetch: typeof fetch; timeoutMs?: number };

export function mountInfoForm(form: HTMLFormElement, deps: Deps = { fetch: window.fetch.bind(window) }) {
  const m = JSON.parse(form.dataset.messages ?? '{}') as InfoMessages;
  const endpoint = form.dataset.endpoint ?? '';
  const lang = form.dataset.lang === 'en' ? 'en' : 'tr';
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const error = form.querySelector<HTMLElement>('[data-info-error]')!;
  const done = form.parentElement?.querySelector<HTMLElement>('[data-info-done]');
  mountEmailGuard(form, lang);
  form.noValidate = true;
  if (endpoint) button.disabled = false;

  const say = (text: string) => {
    error.textContent = text;
    error.hidden = !text;
    if (text) error.focus();
  };
  const value = (name: string) => (form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? '').trim();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const input = {
      email: value('info-email'),
      topics: [...form.querySelectorAll<HTMLInputElement>('input[name="info-topic"]:checked')].map((i) => i.value),
      consent: !!form.querySelector<HTMLInputElement>('input[name="info-consent"]')?.checked,
    };
    const errors = validateInfo(input);
    if (errors.topics) return say(m.topics);
    if (Object.keys(errors).length) return say(m.invalid);
    if (!sameEmail(input.email, value('info-email2'))) return say(m.mismatch);
    say('');
    button.disabled = true;
    const idle = button.textContent;
    button.textContent = m.sending;
    let result: 'sent' | 'email' | 'failed' = 'failed';
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 20000);
      try {
        const res = await deps.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'info.request', ...input, hp_field: value('hp_field'), lang }),
          credentials: 'omit',
          signal: ctrl.signal,
        });
        const out = (await res.json()) as { ok?: boolean; data?: { reason?: string } };
        result = res.ok && out?.ok === true ? 'sent' : out?.data?.reason === 'email' ? 'email' : 'failed';
      } finally {
        clearTimeout(timer);
      }
    } catch {
      result = 'failed';
    }
    button.disabled = false;
    button.textContent = idle;
    if (result === 'sent') {
      form.hidden = true;
      if (done) {
        done.hidden = false;
        done.focus();
      }
    } else say(result === 'email' ? m.emailDomain : m.failed);
  });
}
