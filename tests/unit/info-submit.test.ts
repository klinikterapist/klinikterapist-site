// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mountInfoForm } from '../../src/components/appointment/info-submit';

const messages = { sending: 'Gönderiliyor…', invalid: 'Eksik', topics: 'Konu seçin', mismatch: 'Aynı değil', emailDomain: 'Alan adı yok', failed: 'Gönderilemedi' };

function markup(endpoint: string | null) {
  document.body.innerHTML = `
  <details open>
    <form data-info data-lang="tr" ${endpoint ? `data-endpoint="${endpoint}"` : ''}>
      <input type="checkbox" name="info-topic" value="surec" /><input type="checkbox" name="info-topic" value="online" />
      <input type="email" name="info-email" data-email /><small data-email-hint hidden></small>
      <input type="email" name="info-email2" data-email-again /><small data-email-mismatch hidden></small>
      <input type="checkbox" name="info-consent" value="1" />
      <input name="hp_field" />
      <p data-info-error tabindex="-1" hidden></p>
      <button type="submit" disabled>Gönder</button>
    </form>
    <p data-info-done tabindex="-1" hidden>Gönderildi</p>
  </details>`;
  const form = document.querySelector<HTMLFormElement>('[data-info]')!;
  form.dataset.messages = JSON.stringify(messages);
  return form;
}

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response);
const settle = () => new Promise((r) => setTimeout(r, 0));

function fill(email2 = 'ayse@example.com') {
  $<HTMLInputElement>('input[value="surec"]').checked = true;
  $<HTMLInputElement>('[name="info-email"]').value = 'ayse@example.com';
  $<HTMLInputElement>('[name="info-email2"]').value = email2;
  $<HTMLInputElement>('[name="info-consent"]').checked = true;
}

describe('info form (booking start page)', () => {
  it('without an endpoint the button stays disabled', () => {
    mountInfoForm(markup(null), { fetch: reply({ ok: true }) });
    expect($<HTMLButtonElement>('button').disabled).toBe(true);
  });

  it('asks for a topic first, then checks that the two addresses match, sending nothing', async () => {
    const fetch = reply({ ok: true });
    const form = markup('https://api.test');
    mountInfoForm(form, { fetch });
    $<HTMLInputElement>('[name="info-email"]').value = 'ayse@example.com';
    $<HTMLInputElement>('[name="info-consent"]').checked = true;
    form.requestSubmit();
    expect($('[data-info-error]').textContent).toBe('Konu seçin');
    fill('ayse@exampel.com');
    form.requestSubmit();
    expect($('[data-info-error]').textContent).toBe('Aynı değil');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends one info.request with the chosen topics and gives way to the note', async () => {
    const fetch = reply({ ok: true, data: { sent: true } });
    const form = markup('https://api.test');
    mountInfoForm(form, { fetch });
    fill();
    form.requestSubmit();
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body as string)).toMatchObject({ action: 'info.request', email: 'ayse@example.com', topics: ['surec'], consent: true, lang: 'tr' });
    expect(form.hidden).toBe(true);
    expect($('[data-info-done]').hidden).toBe(false);
  });

  it('a domain that takes no e-mail and a failure show their own message and keep the form', async () => {
    const form = markup('https://api.test');
    mountInfoForm(form, { fetch: reply({ ok: false, data: { reason: 'email' } }, false) });
    fill();
    form.requestSubmit();
    await settle();
    expect($('[data-info-error]').textContent).toBe('Alan adı yok');
    expect(form.hidden).toBe(false);

    const form2 = markup('https://api.test');
    mountInfoForm(form2, { fetch: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fill();
    form2.requestSubmit();
    await settle();
    expect($('[data-info-error]').textContent).toBe('Gönderilemedi');
    expect($<HTMLButtonElement>('button').disabled).toBe(false);
  });
});
