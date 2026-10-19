// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mountBookingForm } from '../../src/components/appointment/booking-submit';

const config = readFileSync('src/data/booking.json', 'utf8');
// Tuesday 20 October 2026, 10:00 Istanbul (07:00 UTC). The calendar reads local days; jsdom runs in UTC here.
const NOW = Date.parse('2026-10-20T10:00:00+03:00');
const messages = { sending: 'Gönderiliyor…', invalid: 'Eksik', taken: 'Dolu', failed: 'Gönderilemedi' };

function markup(endpoint: string | null) {
  document.body.innerHTML = `
  <div data-booking data-lang="tr" data-kind="session" data-config='${config}' ${endpoint ? `data-endpoint="${endpoint}"` : ''} data-messages='${JSON.stringify(messages)}'>
    <ol class="stepper" data-hide-on-done><li data-step-dot="1"><button></button></li></ol>
    <section data-step="1"><h2>Tür</h2><input type="radio" name="type" value="individual" checked /></section>
    <section data-step="2" data-need="slot" hidden><h2>Gün</h2>
      <button data-cal-prev></button><span data-cal-title></span><button data-cal-next></button>
      <div data-cal-days></div><p data-slots-title></p><div data-slots></div>
      <p data-step-error hidden></p></section>
    <section data-step="3" hidden><h2>Bilgiler</h2>
      <input name="name" required /><input name="email" type="email" required /><input name="phone" required />
      <textarea name="note"></textarea><input name="hp_field" /><input type="checkbox" name="consent" value="1" required />
      <p data-step-error hidden></p></section>
    <section data-step="4" data-hide-on-done hidden><h2>Özet</h2>
      <button class="submit" disabled data-submit>Gönder</button>
      <p data-submit-error tabindex="-1" hidden></p><p data-soon>E-posta ile yazın</p></section>
    <section data-done tabindex="-1" hidden><h2>Alındı</h2></section>
    <div data-nav><button data-back hidden></button><button data-next><span data-next-label></span></button></div>
  </div>`;
  return document.querySelector<HTMLElement>('[data-booking]')!;
}

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;

/** Walks the steps: Thursday 22 October 2026 at 14:30, then the details. */
function fill() {
  $('[data-next]').click();
  const day = [...document.querySelectorAll<HTMLButtonElement>('.day')].find((b) => b.textContent === '22')!;
  day.click();
  [...document.querySelectorAll<HTMLButtonElement>('.slot')].find((b) => b.textContent === '14:30')!.click();
  $('[data-next]').click();
  $<HTMLInputElement>('[name=name]').value = 'Ayşe Yılmaz';
  $<HTMLInputElement>('[name=email]').value = 'ayse@example.com';
  $<HTMLInputElement>('[name=phone]').value = '0532 123 45 67';
  $<HTMLInputElement>('[name=consent]').checked = true;
  $('[data-next]').click();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  window.scrollTo = () => {};
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('mountBookingForm', () => {
  it('without an endpoint the button stays disabled and the e-mail line stays', () => {
    mountBookingForm(markup(null), { fetch: vi.fn(), now: () => NOW });
    expect($<HTMLButtonElement>('[data-submit]').disabled).toBe(true);
    expect($('[data-soon]').hidden).toBe(false);
  });

  it('the calendar offers only the free times of booking.json', () => {
    mountBookingForm(markup('https://api.example/exec'), { fetch: vi.fn(), now: () => NOW });
    $('[data-next]').click();
    const free = [...document.querySelectorAll<HTMLButtonElement>('.day:not([disabled])')].map((b) => b.textContent);
    // October 2026 from the 21st: weekdays only (24, 25 and 31 are a weekend).
    expect(free).toEqual(['21', '22', '23', '26', '27', '28', '29', '30']);
  });

  it('sends one booking.request with the chosen slot and shows the thank-you card', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { sent: true } }), { status: 200 }));
    mountBookingForm(markup('https://api.example/exec'), { fetch, now: () => NOW });
    expect($('[data-soon]').hidden).toBe(true);
    fill();
    $('[data-submit]').click();
    await vi.waitFor(() => expect($('[data-done]').hidden).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example/exec');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(String(init.body))).toEqual({
      action: 'booking.request', kind: 'session', type: 'individual', day: '2026-10-22', time: '14:30',
      name: 'Ayşe Yılmaz', email: 'ayse@example.com', phone: '0532 123 45 67', note: '', consent: true, hp_field: '', lang: 'tr',
    });
    expect($('[data-step="4"]').hidden).toBe(true);
    expect($('.stepper').hidden).toBe(true);
  });

  it('a taken time and a failure show their message and keep the form', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error: { code: 'bad_request', message: 'Seçtiğiniz saat artık uygun değil. Lütfen başka bir saat seçin.' } })))
      .mockRejectedValueOnce(new Error('offline'));
    mountBookingForm(markup('https://api.example/exec'), { fetch, now: () => NOW });
    fill();
    $('[data-submit]').click();
    await vi.waitFor(() => expect($('[data-submit-error]').textContent).toBe('Dolu'));
    $('[data-submit]').click();
    await vi.waitFor(() => expect($('[data-submit-error]').textContent).toBe('Gönderilemedi'));
    expect($('[data-done]').hidden).toBe(true);
    expect($<HTMLButtonElement>('[data-submit]').disabled).toBe(false);
  });
});
