// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initContactForm, type ContactMessages } from '../../src/lib/contact-client';

const messages: ContactMessages = {
  required: 'REQ',
  nameTooLong: 'NAME_LONG',
  emailInvalid: 'EMAIL',
  topicRequired: 'TOPIC',
  messageTooShort: 'MSG_SHORT',
  messageTooLong: 'MSG_LONG',
  consentRequired: 'CONSENT',
  sending: 'Gönderiliyor…',
};

function mount(endpoint: string | null = 'https://script.example/exec') {
  document.body.innerHTML = `
    <form data-contact-form ${endpoint ? `data-endpoint="${endpoint}"` : ''} data-lang="tr">
      <input name="name" /><p data-error-for="name" hidden></p>
      <input name="email" /><p data-error-for="email" hidden></p>
      <select name="topic"><option value="">Seç</option><option value="general">Genel</option></select><p data-error-for="topic" hidden></p>
      <textarea name="message"></textarea><p data-error-for="message" hidden></p>
      <input name="hp_field" />
      <input name="consent" type="checkbox" /><p data-error-for="consent" hidden></p>
      <button type="submit" disabled><span class="label">Gönder</span></button>
      <p data-success tabindex="-1" hidden>ok</p>
      <p data-failure tabindex="-1" hidden>fail <a href="mailto:x@example.com">x</a></p>
    </form>`;
  const form = document.querySelector('form')!;
  form.dataset.messages = JSON.stringify(messages);
  return form;
}

const field = (name: string) => document.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
const fill = () => {
  field('name').value = 'Ayşe';
  field('email').value = 'ayse@example.com';
  (document.querySelector('select') as HTMLSelectElement).value = 'general';
  (document.querySelector('textarea') as HTMLTextAreaElement).value = 'Merhaba, bir sorum var.';
  field('consent').checked = true;
};
const submit = (form: HTMLFormElement) => form.dispatchEvent(new Event('submit', { cancelable: true }));
const flush = () => new Promise((r) => setTimeout(r, 0));
const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);

describe('contact form script', () => {
  let form: HTMLFormElement;
  beforeEach(() => {
    form = mount();
  });

  it('shows inline errors, marks fields invalid and focuses the first one without sending', () => {
    const fetch = reply({ ok: true });
    // Disabled in the markup; the script enables it.
    expect(form.querySelector('button')!.disabled).toBe(true);
    initContactForm(form, { fetch });
    expect(form.querySelector('button')!.disabled).toBe(false);
    expect(form.noValidate).toBe(true);
    submit(form);
    expect(fetch).not.toHaveBeenCalled();
    const err = (n: string) => document.querySelector<HTMLElement>(`[data-error-for="${n}"]`)!;
    expect(err('name').textContent).toBe('REQ');
    expect(err('name').hidden).toBe(false);
    expect(err('topic').textContent).toBe('TOPIC');
    expect(err('consent').textContent).toBe('CONSENT');
    expect(field('name').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field('name'));
    // Typing clears that field's error.
    field('name').value = 'A';
    field('name').dispatchEvent(new Event('input'));
    expect(err('name').hidden).toBe(true);
    expect(field('name').hasAttribute('aria-invalid')).toBe(false);
  });

  it('posts text/plain JSON with contact.send, no cookies, disables the button meanwhile, then shows success', async () => {
    let resolve!: (r: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    initContactForm(form, { fetch });
    fill();
    submit(form);
    const button = form.querySelector('button')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Gönderiliyor…');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://script.example/exec');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/^text\/plain/);
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(String(init.body))).toEqual({
      action: 'contact.send',
      name: 'Ayşe',
      email: 'ayse@example.com',
      topic: 'general',
      message: 'Merhaba, bir sorum var.',
      consent: true,
      hp_field: '',
      lang: 'tr',
    });
    // A second submit while sending does nothing.
    submit(form);
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve({ ok: true, json: async () => ({ ok: true, data: { sent: true } }) } as Response);
    await flush();
    await flush();
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Gönder');
    expect(document.querySelector<HTMLElement>('[data-success]')!.hidden).toBe(false);
    expect(document.activeElement).toBe(document.querySelector('[data-success]'));
    expect(document.querySelector<HTMLElement>('[data-failure]')!.hidden).toBe(true);
    expect(field('name').value).toBe('');
  });

  it('a backend error shows the failure text with the mailto link and keeps what was typed', async () => {
    initContactForm(form, { fetch: reply({ ok: false, error: { code: 'bad_request', message: 'x' } }) });
    fill();
    submit(form);
    await flush();
    await flush();
    const fail = document.querySelector<HTMLElement>('[data-failure]')!;
    expect(fail.hidden).toBe(false);
    expect(fail.querySelector('a[href^="mailto:"]')).toBeTruthy();
    expect(field('name').value).toBe('Ayşe');
  });

  it('a network error or no endpoint also falls back to the failure text', async () => {
    initContactForm(form, { fetch: vi.fn(async () => { throw new TypeError('offline'); }) });
    fill();
    submit(form);
    await flush();
    await flush();
    expect(document.querySelector<HTMLElement>('[data-failure]')!.hidden).toBe(false);

    const noEndpoint = mount(null);
    const fetch = reply({ ok: true });
    initContactForm(noEndpoint, { fetch });
    fill();
    submit(noEndpoint);
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLElement>('[data-failure]')!.hidden).toBe(false);
  });
});
