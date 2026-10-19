/**
 * Sends a booking or intro-call request from the step-by-step form (wizard.ts): the calendar shows
 * the times of `booking.json` (`data-config`; holidays closed) with the taken ones marked "Dolu"
 * (`booking.busy`, read once from the panel's Apps Script URL), and the last step's button posts one
 * text/plain JSON request (`booking.request`). No cookies, no third party. Without an endpoint the
 * button stays disabled and the e-mail link in the markup is the way.
 *
 * Markup contract, besides wizard.ts's:
 *   data-kind="session|intro" data-config='{…}' data-endpoint="…" data-messages='{…}' on the root
 *   named inputs: type (session), forWhom, topics, before, age, note, name, email, phone, consent,
 *   healthConsent (intro), hp_field (honeypot)
 *   [data-submit] the send button, [data-soon] the e-mail fallback line, [data-submit-error] the
 *   message under the button, [data-done] the thank-you panel (hidden), [data-hide-on-done] parts
 *   to hide after sending
 */
import { closedOn, minutesOf, slotsFor, validateBooking, type BookingConfig, type BookingInput, type BookingKind, type BusyInterval } from '../../lib/booking-form';
import { mountWizard } from './wizard';

export type BookingMessages = { sending: string; invalid: string; taken: string; failed: string };

type Deps = { fetch: typeof fetch; now: () => number; timeoutMs?: number };

export function mountBookingForm(root: HTMLElement, deps: Deps = { fetch: window.fetch.bind(window), now: () => Date.now() }) {
  const kind: BookingKind = root.dataset.kind === 'intro' ? 'intro' : 'session';
  const cfg = JSON.parse(root.dataset.config ?? '{}') as BookingConfig;
  const endpoint = root.dataset.endpoint ?? '';
  const lang = root.dataset.lang === 'en' ? 'en' : 'tr';
  const messages = JSON.parse(root.dataset.messages ?? '{}') as BookingMessages;
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let busy: BusyInterval[] = [];
  const typeNow = () => root.querySelector<HTMLInputElement>('input[name="type"]:checked')?.value;
  const wizard = mountWizard(root, {
    slotsFor: (d) => slotsFor(cfg, kind, ymd(d), deps.now(), busy, minutesOf(kind, typeNow())),
    holidayOf: (d) => closedOn(cfg, ymd(d))?.name ?? null,
    holidaysIn: (m) => {
      const prefix = ymd(m).slice(0, 7);
      return cfg.closed
        .filter((c) => c.date.startsWith(prefix))
        .map((c) => {
          const day = new Date(`${c.date}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
          const when = c.from ? (lang === 'en' ? `closed from ${c.from.replace(':', '.')}` : `${c.from.replace(':', '.')}’ten sonra kapalı`) : lang === 'en' ? 'closed' : 'kapalı';
          return `${day}: ${c.name} (${when})`;
        });
    },
  });
  // A couple session is longer: the taken times depend on the chosen type.
  root.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', () => wizard.refresh()));

  /** Reads the taken times; a failure leaves the calendar as booking.json alone (the backend checks again). */
  const loadBusy = async () => {
    if (!endpoint) return;
    try {
      const res = await deps.fetch(`${endpoint}?action=booking.busy`, { credentials: 'omit' });
      const out = (await res.json()) as { ok?: boolean; data?: { busy?: BusyInterval[] } };
      if (out?.ok && Array.isArray(out.data?.busy)) {
        busy = out.data.busy.filter((b) => typeof b?.start === 'number' && typeof b?.end === 'number');
        wizard.refresh();
      }
    } catch {
      /* keep the template */
    }
  };
  void loadBusy();

  const button = root.querySelector<HTMLButtonElement>('[data-submit]');
  const error = root.querySelector<HTMLElement>('[data-submit-error]');
  if (!button || !endpoint) return wizard;
  root.querySelector<HTMLElement>('[data-soon]')?.setAttribute('hidden', '');
  button.disabled = false;
  const idle = button.innerHTML;

  const value = (name: string) => (root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${name}"]`)?.value ?? '').trim();
  const checked = (name: string) => [...root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map((i) => i.value);

  const read = (): BookingInput & { hp_field: string } => {
    const { day, time } = wizard.selection();
    const base = {
      kind,
      day: day ?? '',
      time: time ?? '',
      name: value('name'),
      email: value('email'),
      phone: value('phone'),
      note: value('note'),
      consent: checked('consent').length > 0,
      hp_field: value('hp_field'),
    };
    if (kind === 'session') return { ...base, type: checked('type')[0] ?? '' };
    const age = value('age');
    return {
      ...base,
      forWhom: checked('forWhom')[0] ?? '',
      topics: checked('topics').map(Number),
      before: (checked('before')[0] ?? '') as BookingInput['before'],
      age: age === '' ? -1 : Number(age),
      healthConsent: checked('healthConsent').length > 0,
    };
  };

  const say = (text: string) => {
    if (!error) return;
    error.textContent = text;
    error.hidden = !text;
    if (text) error.focus();
  };

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    say('');
    const input = read();
    const errors = validateBooking(input, cfg, deps.now(), busy);
    if (errors.slot) {
      say(messages.taken);
      return;
    }
    if (Object.keys(errors).length) {
      say(messages.invalid);
      return;
    }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = messages.sending;
    let result: 'sent' | 'taken' | 'failed' = 'failed';
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 20000);
      try {
        const res = await deps.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'booking.request', ...input, lang }),
          credentials: 'omit',
          signal: ctrl.signal,
        });
        const out = (await res.json()) as { ok?: boolean; error?: { message?: string } };
        if (res.ok && out?.ok === true) result = 'sent';
        else if (out?.error?.message?.includes('artık uygun değil')) result = 'taken';
      } finally {
        clearTimeout(timer);
      }
    } catch {
      result = 'failed';
    }
    button.removeAttribute('aria-busy');
    button.innerHTML = idle;
    button.disabled = false;
    if (result === 'sent') {
      root.querySelectorAll<HTMLElement>('[data-hide-on-done]').forEach((el) => (el.hidden = true));
      const done = root.querySelector<HTMLElement>('[data-done]');
      if (done) {
        done.hidden = false;
        done.focus();
      }
    } else if (result === 'taken') {
      // Someone was quicker: show the calendar again with the fresh taken times.
      await loadBusy();
      say(messages.taken);
    } else {
      say(messages.failed);
    }
  });
  return wizard;
}
