// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mountBookingForm } from '../../src/components/appointment/booking-submit';

const config = readFileSync('src/data/booking.json', 'utf8');
// Tuesday 20 October 2026, 10:00 Istanbul (07:00 UTC). The calendar reads local days; jsdom runs in UTC here.
const NOW = Date.parse('2026-10-20T10:00:00+03:00');
const messages = { sending: 'Gönderiliyor…', invalid: 'Eksik', taken: 'Dolu', failed: 'Gönderilemedi', mismatch: 'Aynı değil' };

function markup(endpoint: string | null) {
  document.body.innerHTML = `
  <div data-booking data-lang="tr" data-kind="session" ${endpoint ? `data-endpoint="${endpoint}"` : ''}>
    <ol class="stepper" data-hide-on-done><li data-step-dot="1"><button></button></li></ol>
    <section data-step="1"><h2>Tür</h2><input type="radio" name="type" value="individual" checked /></section>
    <section data-step="2" data-need="slot" hidden><h2>Gün</h2>
      <button data-cal-prev></button><span data-cal-title></span><button data-cal-next></button>
      <div data-cal-days></div><ul data-cal-note hidden></ul><p data-slots-title></p><div data-slots></div>
      <p data-step-error hidden></p></section>
    <section data-step="3" hidden><h2>Bilgiler</h2>
      <input name="name" required /><input name="email" type="email" required data-email /><small data-email-hint hidden></small>
      <input name="email2" type="email" required data-email-again /><small data-email-mismatch hidden></small><input name="phone" required />
      <textarea name="note"></textarea><input name="hp_field" /><input type="checkbox" name="consent" value="1" required />
      <p data-step-error hidden></p></section>
    <section data-step="4" data-hide-on-done hidden><h2>Özet</h2>
      <button class="submit" disabled data-submit>Gönder</button>
      <p data-submit-error tabindex="-1" hidden></p><p data-soon>E-posta ile yazın</p></section>
    <section data-done tabindex="-1" hidden><h2>Alındı</h2></section>
    <div data-nav><button data-back hidden></button><button data-next><span data-next-label></span></button></div>
    <section data-closed hidden>
      <div data-wl-form>
        <input type="checkbox" name="wl-kinds" value="individual" checked />
        <input name="wl-name" /><input name="wl-email" data-email /><small data-email-hint hidden></small><input name="wl-email2" data-email-again />
        <input name="wl-phone" /><textarea name="wl-reason"></textarea><input type="checkbox" name="wl-consent" value="1" /><input type="checkbox" name="wl-health" value="1" />
        <button data-wl-submit disabled>Haber et</button><p data-wl-error tabindex="-1" hidden></p><p data-wl-soon></p>
      </div>
      <section data-wl-done tabindex="-1" hidden></section>
    </section>
  </div>`;
  const root = document.querySelector<HTMLElement>('[data-booking]')!;
  // Set as properties: the holiday names hold apostrophes (Astro escapes them in the real markup).
  root.dataset.config = config;
  root.dataset.messages = JSON.stringify(messages);
  return root;
}

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s)!;

/** Walks the steps: Thursday 22 October 2026 at 15:00, then the details. */
function fill() {
  $('[data-next]').click();
  const day = [...document.querySelectorAll<HTMLButtonElement>('.day')].find((b) => b.textContent === '22')!;
  day.click();
  [...document.querySelectorAll<HTMLButtonElement>('.slot')].find((b) => b.textContent === '15:00')!.click();
  $('[data-next]').click();
  $<HTMLInputElement>('[name=name]').value = 'Ayşe Yılmaz';
  $<HTMLInputElement>('[name=email]').value = 'ayse@example.com';
  $<HTMLInputElement>('[name=email2]').value = 'ayse@example.com';
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
    // October 2026 from the 21st: weekdays only (24, 25 and 31 are a weekend), not 29 (Cumhuriyet
    // Bayramı); the 28th is the eve: open in the morning.
    expect(free).toEqual(['21', '22', '23', '26', '27', '28', '30']);
    expect(document.querySelector('.day.is-holiday')?.getAttribute('aria-label')).toContain('Resmi tatil: Cumhuriyet Bayramı');
    // The month's holidays in small type under the calendar.
    expect([...document.querySelectorAll('[data-cal-note] li')].map((li) => li.textContent)).toEqual([
      '28 Ekim: Cumhuriyet Bayramı arifesi (13.00’ten sonra kapalı)',
      '29 Ekim: Cumhuriyet Bayramı (kapalı)',
    ]);
  });

  it('marks the times a booking holds as "Dolu", read from booking.busy', async () => {
    // A couple session at 15:00 holds 15:00–16:30 (60 minutes + 30 rest).
    const start = Date.parse('2026-10-22T15:00:00+03:00');
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { busy: [{ start, end: start + 90 * 60e3 }] } })));
    mountBookingForm(markup('https://api.example/exec'), { fetch, now: () => NOW });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('https://api.example/exec?action=booking.busy&lang=tr', { credentials: 'omit' }));
    $('[data-next]').click();
    [...document.querySelectorAll<HTMLButtonElement>('.day')].find((b) => b.textContent === '22')!.click();
    await vi.waitFor(() => expect(document.querySelectorAll('.slot.is-taken').length).toBeGreaterThan(0));
    const taken = [...document.querySelectorAll<HTMLButtonElement>('.slot.is-taken')];
    expect(taken.map((b) => b.querySelector('.slot-time')?.textContent)).toEqual(['15:00']);
    expect(taken[0].disabled).toBe(true);
    expect(taken[0].textContent).toContain('Dolu');
  });

  it('sends one booking.request with the chosen slot and shows the thank-you card', async () => {
    const fetch = vi.fn(async (url: RequestInfo | URL) =>
      new Response(JSON.stringify(String(url).includes('booking.busy') ? { ok: true, data: { busy: [] } } : { ok: true, data: { sent: true } }), { status: 200 }));
    mountBookingForm(markup('https://api.example/exec'), { fetch, now: () => NOW });
    expect($('[data-soon]').hidden).toBe(true);
    fill();
    $('[data-submit]').click();
    await vi.waitFor(() => expect($('[data-done]').hidden).toBe(false));
    const posts = fetch.mock.calls.filter((c) => !String(c[0]).includes('booking.busy'));
    expect(posts).toHaveLength(1);
    const [url, init] = posts[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example/exec');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(String(init.body))).toEqual({
      action: 'booking.request', kind: 'session', type: 'individual', day: '2026-10-22', time: '15:00',
      name: 'Ayşe Yılmaz', email: 'ayse@example.com', phone: '0532 123 45 67', note: '', consent: true, healthConsent: false, hp_field: '', lang: 'tr',
    });
    expect($('[data-step="4"]').hidden).toBe(true);
    expect($('.stepper').hidden).toBe(true);
  });

  it('a taken time and a failure show their message and keep the form', async () => {
    let posts = 0;
    const fetch = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('booking.busy')) return new Response(JSON.stringify({ ok: true, data: { busy: [] } }));
      if (++posts === 1) return new Response(JSON.stringify({ ok: false, error: { code: 'bad_request', message: 'Bu saat alındı.' }, data: { reason: 'taken' } }));
      throw new Error('offline');
    });
    mountBookingForm(markup('https://api.example/exec'), { fetch, now: () => NOW });
    fill();
    $('[data-submit]').click();
    await vi.waitFor(() => expect($('[data-submit-error]').textContent).toBe('Dolu'));
    $('[data-submit]').click();
    await vi.waitFor(() => expect($('[data-submit-error]').textContent).toBe('Gönderilemedi'));
    expect($('[data-done]').hidden).toBe(true);
    expect($<HTMLButtonElement>('[data-submit]').disabled).toBe(false);
  });

  it('booking closed while the page was open: the form gives way to "Haber et"', async () => {
    const fetch = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('booking.busy')) return new Response(JSON.stringify({ ok: true, data: { busy: [] } }));
      return new Response(JSON.stringify({ ok: false, error: { code: 'bad_request', message: 'Şu an tüm seanslar dolu.' }, data: { reason: 'closed' } }));
    });
    const root = markup('https://api.example/exec');
    mountBookingForm(root, { fetch, now: () => NOW });
    fill();
    $('[data-submit]').click();
    await vi.waitFor(() => expect(root.classList.contains('is-closed')).toBe(true));
    expect($('[data-closed]').hidden).toBe(false);
    expect($('[data-done]').hidden).toBe(true);
  });
});

describe('closed in the language of the page (booking.json intake)', () => {
  it('the English page opens on "Haber et" while English booking is closed; the Turkish one does not', () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { busy: [] } })));
    const en = markup('https://api.example/exec');
    en.dataset.lang = 'en';
    en.dataset.config = JSON.stringify({ ...JSON.parse(en.dataset.config!), intake: { tr: true, en: false } });
    mountBookingForm(en, { fetch, now: () => NOW });
    expect(en.classList.contains('is-closed')).toBe(true);
    expect($('[data-closed]').hidden).toBe(false);
    const tr = markup('https://api.example/exec');
    tr.dataset.config = JSON.stringify({ ...JSON.parse(tr.dataset.config!), intake: { tr: true, en: false } });
    mountBookingForm(tr, { fetch, now: () => NOW });
    expect(tr.classList.contains('is-closed')).toBe(false);
  });
});

describe('e-mail check and closed booking on the site', () => {
  it('two different addresses stop the request; a near-miss domain gets a one-tap fix', async () => {
    const fetch = vi.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify(String(url).includes('booking.busy') ? { ok: true, data: { busy: [] } } : { ok: true, data: { sent: true } })));
    mountBookingForm(markup('https://api.example/exec'), { fetch, now: () => NOW });
    const email = $<HTMLInputElement>('[name=email]');
    email.value = 'ayse@gmial.com';
    email.dispatchEvent(new Event('blur'));
    expect($('[data-email-hint]').hidden).toBe(false);
    expect($('[data-email-hint]').textContent).toContain('ayse@gmail.com');
    $<HTMLButtonElement>('.email-fix').click();
    expect(email.value).toBe('ayse@gmail.com');
    fill();
    $<HTMLInputElement>('[name=email2]').value = 'ayse@gmail.co';
    $('[data-submit]').click();
    await vi.waitFor(() => expect($('[data-submit-error]').textContent).toBe('Aynı değil'));
    expect(fetch.mock.calls.filter(([u]) => !String(u).includes('booking.busy'))).toHaveLength(0);
  });

  it('closed in the panel: only "Haber et" shows, and it sends booking.waitlist', async () => {
    const posts: Record<string, unknown>[] = [];
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes('booking.busy')) return new Response(JSON.stringify({ ok: true, data: { busy: [], closed: true } }));
      posts.push(JSON.parse(String(init!.body)));
      return new Response(JSON.stringify({ ok: true, data: { sent: true } }));
    });
    const root = markup('https://api.example/exec');
    mountBookingForm(root, { fetch, now: () => NOW });
    await vi.waitFor(() => expect(root.classList.contains('is-closed')).toBe(true));
    expect($('[data-closed]').hidden).toBe(false);
    $<HTMLInputElement>('[name=wl-name]').value = 'Elif Bekler';
    $<HTMLInputElement>('[name=wl-email]').value = 'elif@example.com';
    $<HTMLInputElement>('[name=wl-email2]').value = 'elif@example.com';
    $<HTMLInputElement>('[name=wl-phone]').value = '0534 000 00 00';
    $<HTMLButtonElement>('[data-wl-submit]').click();
    await vi.waitFor(() => expect($('[data-wl-error]').textContent).toBe('Eksik'));
    $<HTMLInputElement>('[name=wl-consent]').checked = true;
    $<HTMLButtonElement>('[data-wl-submit]').click();
    await vi.waitFor(() => expect($('[data-wl-done]').hidden).toBe(false));
    expect(posts).toEqual([expect.objectContaining({ action: 'booking.waitlist', name: 'Elif Bekler', kinds: ['individual'], consent: true, lang: 'tr' })]);
  });

});

describe('the session note consent (owner’s note 2026-10-22)', () => {
  it('shows and requires the consent once a note is written, and clears it when the note is emptied', async () => {
    const { mountNoteConsent } = await import('../../src/components/appointment/booking-submit');
    document.body.innerHTML = `<div id="r"><textarea name="note"></textarea><label data-note-consent hidden><input type="checkbox" name="healthConsent" /></label></div>`;
    mountNoteConsent(document.querySelector<HTMLElement>('#r')!);
    const box = $('[data-note-consent]');
    const input = $<HTMLInputElement>('[name=healthConsent]');
    const note = $<HTMLTextAreaElement>('[name=note]');
    expect(box.hidden).toBe(true);
    expect(input.required).toBe(false);
    note.value = 'Uyku sorunu';
    note.dispatchEvent(new Event('input'));
    expect(box.hidden).toBe(false);
    expect(input.required).toBe(true);
    input.checked = true;
    note.value = '';
    note.dispatchEvent(new Event('input'));
    expect(box.hidden).toBe(true);
    expect(input.checked).toBe(false);
  });
});
