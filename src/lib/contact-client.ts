/**
 * Browser side of the contact form (ContactForm.astro): inline errors from the shared rules, a
 * disabled-while-sending button, then one text/plain JSON POST (`contact.send`) to the panel's Apps
 * Script URL. No cookies (`credentials: 'omit'`), no third party. Any failure shows the message with
 * the mailto fallback that is already in the markup.
 */
import { validateContact, type ContactErrorKind, type ContactField, type ContactInput } from './contact-form';

/** Texts the markup hands over in `data-messages` (the page's language). */
export type ContactMessages = {
  required: string;
  nameTooLong: string;
  emailInvalid: string;
  topicRequired: string;
  messageTooShort: string;
  messageTooLong: string;
  consentRequired: string;
  sending: string;
};

type Deps = { fetch: typeof fetch; timeoutMs?: number };

const FIELDS: ContactField[] = ['name', 'email', 'topic', 'message', 'consent'];

export function errorText(field: ContactField, kind: ContactErrorKind, m: ContactMessages): string {
  if (field === 'consent') return m.consentRequired;
  if (field === 'topic') return m.topicRequired;
  if (kind === 'required') return m.required;
  if (field === 'name') return m.nameTooLong;
  if (field === 'email') return m.emailInvalid;
  return kind === 'tooShort' ? m.messageTooShort : m.messageTooLong;
}

export function initContactForm(form: HTMLFormElement, deps: Deps = { fetch: window.fetch.bind(window) }): void {
  const messages = JSON.parse(form.dataset.messages ?? '{}') as ContactMessages;
  const endpoint = form.dataset.endpoint ?? '';
  const lang = form.dataset.lang === 'en' ? 'en' : 'tr';
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const label = button.querySelector<HTMLElement>('.label') ?? button;
  const idle = label.textContent ?? '';
  const success = form.querySelector<HTMLElement>('[data-success]')!;
  const failure = form.querySelector<HTMLElement>('[data-failure]')!;
  const control = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;

  // The script does the checking (with texts in the page's language) from here on, and only now
  // can the form be sent: the button is disabled in the markup.
  form.noValidate = true;
  button.disabled = false;

  const setError = (field: ContactField, text: string) => {
    const el = control(field);
    const out = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
    if (!el || !out) return;
    out.textContent = text;
    out.hidden = !text;
    if (text) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  };

  const read = (): ContactInput & { hp_field: string } => ({
    name: control('name')?.value ?? '',
    email: control('email')?.value ?? '',
    topic: control('topic')?.value ?? '',
    message: control('message')?.value ?? '',
    consent: (control('consent') as HTMLInputElement | null)?.checked ?? false,
    hp_field: control('hp_field')?.value ?? '',
  });

  for (const field of FIELDS) {
    control(field)?.addEventListener(field === 'consent' || field === 'topic' ? 'change' : 'input', () => setError(field, ''));
  }

  const busy = (on: boolean) => {
    button.disabled = on;
    form.setAttribute('aria-busy', String(on));
    label.textContent = on ? messages.sending : idle;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (button.disabled) return;
    success.hidden = true;
    failure.hidden = true;
    const values = read();
    const errors = validateContact(values);
    for (const field of FIELDS) setError(field, errors[field] ? errorText(field, errors[field]!, messages) : '');
    const first = FIELDS.find((f) => errors[f]);
    if (first) {
      control(first)?.focus();
      return;
    }

    busy(true);
    let sent = false;
    try {
      if (!endpoint) throw new Error('no endpoint');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 20000);
      try {
        const res = await deps.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'contact.send', ...values, lang }),
          credentials: 'omit',
          signal: ctrl.signal,
        });
        const out = (await res.json()) as { ok?: boolean };
        sent = res.ok && out?.ok === true;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      sent = false;
    }
    busy(false);
    const shown = sent ? success : failure;
    if (sent) form.reset();
    shown.hidden = false;
    // Focus reads the message out once (it is not a live region as well).
    shown.focus();
  });
}
