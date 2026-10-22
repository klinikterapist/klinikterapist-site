// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyChange } from '../../src/lib/sessions';
import { parseBooking } from '../../src/lib/schemas';
import { codeFromHash, freeTimes, payOf, trackView, type TrackView } from '../../src/lib/tracking';
import { mountTrackingPage, type TrackMessages } from '../../src/components/tracking/track-page';

// Tuesday 20 October 2026, 10:00 Istanbul.
const NOW = Date.parse('2026-10-20T10:00:00+03:00');
const CODE = `abc123def456.${'x'.repeat(32)}`;
const cfg = parseBooking(JSON.parse(readFileSync('src/data/booking.json', 'utf8')));
const client = {
  number: 'KT001AY',
  type: 'individual',
  weekday: 3,
  time: '09:00',
  minutes: 50,
  since: '2026-10-01',
  contact: { lang: 'tr' as const },
  sessions: [{ day: '2026-10-28', time: '09:00', kind: 'weekly' as const, minutes: 50, status: 'cancelled' as const, by: 'owner' as const, note: 'Özel not' }],
};

describe('tracking (shared)', () => {
  it('reads the code after #k= and nothing else', () => {
    expect(codeFromHash(`#k=${CODE}`)).toBe(CODE);
    expect(codeFromHash('#k=short')).toBeNull();
    expect(codeFromHash('')).toBeNull();
  });

  it('shows the next four sessions without notes, the session details and the chart; one within 24 hours is late', () => {
    const v = trackView(client, NOW);
    expect(v.next.map((s) => [s.day, s.status, s.late])).toEqual([
      ['2026-10-21', 'planned', true],
      ['2026-10-28', 'cancelled', false],
      ['2026-11-04', 'planned', false],
      ['2026-11-11', 'planned', false],
    ]);
    expect(v).toMatchObject({ since: '2026-10-01', minutes: 50, stats: expect.objectContaining({ total: 2, unmarked: 2 }) });
    expect(JSON.stringify(v)).not.toContain('Özel not');
  });

  it('free times follow the booking calendar and leave out the times others and the client take', () => {
    const v = trackView(client, NOW);
    const all = freeTimes(cfg, { ...v, busy: [] }, { day: '2026-11-04', time: '09:00' }, '2026-11-05', NOW);
    expect(all.length).toBeGreaterThan(1);
    const start = Date.parse(`2026-11-05T${all[0]}:00+03:00`);
    expect(freeTimes(cfg, { ...v, busy: [{ start, end: start + 60e3 }] }, { day: '2026-11-04', time: '09:00' }, '2026-11-05', NOW)).not.toContain(all[0]);
    // A holiday has none (29 October).
    expect(freeTimes(cfg, v, { day: '2026-11-04', time: '09:00' }, '2026-10-29', NOW)).toEqual([]);
  });

  it('the owner marking a session again takes the late mark off', () => {
    const sessions = [{ day: '2026-11-04', time: '09:00', kind: 'weekly' as const, minutes: 50, status: 'cancelled' as const, by: 'client' as const, late: true as const }];
    const after = applyChange({ ...client, sessions }, { op: 'mark', day: '2026-11-04', time: '09:00', status: 'noshow' }, 30).sessions;
    expect(after.find((s) => s.day === '2026-11-04')).not.toHaveProperty('late');
  });
});

const failures = { link: 'Geçersiz', late: 'Geç', gone: 'Yok', taken: 'Dolu', busy: 'Meşgul', invalid: 'Anlaşılmadı', network: 'Ağ' };
const m: TrackMessages = {
  loading: 'Yükleniyor', noLink: 'Bağlantı yok', failures, nextTitle: 'Sıradaki', infoTitle: 'Seans bilgisi', chartTitle: 'Seans grafiği',
  info: { weekly: 'Haftalık seans', type: 'Tür', since: 'Başlangıç', every: 'Her {day} {time}' }, types: { individual: 'Bireysel terapi' },
  kinds: { weekly: 'Seans', intro: 'Ön görüşme', closing: 'Sonlandırma', extra: 'Ek seans' }, status: { cancelled: 'İptal edildi', postponed: 'Ertelendi' },
  byClient: 'sizin isteğinizle', late: '24 saatten az', none: 'Seans yok', cancel: 'İptal et', postpone: 'Ertele', lateTitle: 'Uyarı', lateText: 'Tam ücret',
  lateOk: 'Anladım', cancelNote: 'Not', confirmCancel: 'Seansı iptal et', pickDay: 'Gün', pickTime: 'Saat seçin', noDays: 'Boş yok', postponeNote: 'Not',
  confirmPostpone: 'Seansı ertele', back: 'Vazgeç', sending: 'Gönderiliyor', cancelled: 'iptal edildi', postponed: 'ertelendi:',
  chart: { count: 'seans', since: 'Başlangıçtan beri', free: '{n} ücretsiz', empty: 'Boş', note: '{n} seans', parts: { attended: 'Katıldı', noshow: 'Gelmedi', cancelled: 'İptal', postponed: 'Ertelendi', unmarked: 'İşaretlenmedi' } },
  endTitle: 'Sonlandırmak', endText: 'Metin', endButton: 'Sonlandırmak istiyorum', endNote: 'Not', endSend: 'Gönder', endDone: 'İsteğiniz ulaştı',
  closing: 'Sonlandırma planlanıyor',
  closingPick: { title: 'Saat seçin', text: '{date} sonuna kadar', target: 'Seçmezseniz {when}', day: 'Gün', send: 'Bu saati seç', done: 'Planlandı: {when}' },
  code: 'Danışan kodu', codeNote: 'Kodu belirtin', firstTitle: 'Sıradaki seansınız', pastTitle: 'Geçmiş seanslar', pastNone: 'Geçmiş yok',
  past: { attended: 'Katıldınız', noshow: 'Katılmadınız', unmarked: 'İşaretlenmedi' }, pay: { paid: 'Ödendi', due: 'Ödeme bekleniyor', free: 'Ücretsiz' }, minutes: 'dk',
  weekdays: ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'],
};

function mount(answers: unknown[], hash = `#k=${CODE}`) {
  history.replaceState(null, '', `/randevum/${hash}`);
  const root = document.createElement('div');
  root.dataset.tracking = '';
  root.dataset.lang = 'tr';
  root.dataset.endpoint = 'https://api.test/exec';
  root.dataset.config = JSON.stringify(cfg);
  root.dataset.messages = JSON.stringify(m);
  root.innerHTML = '<p data-status></p><div data-body hidden></div><p data-live></p>';
  document.body.innerHTML = '<a class="lang-switch" href="/en/my-appointment/">EN</a>';
  document.body.append(root);
  const sent: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    return { json: async () => answers.shift() } as Response;
  });
  mountTrackingPage(root, { fetch: fetch as unknown as typeof window.fetch, now: () => NOW });
  return { sent, root };
}

const flush = async () => {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
};
const buttonIn = (el: Element, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === text)!;

describe('the page (track-page.ts)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('without a code it asks for the link and calls nothing', async () => {
    const { sent, root } = mount([], '');
    await flush();
    expect(sent).toEqual([]);
    expect(root.querySelector('[data-status]')!.textContent).toBe('Bağlantı yok');
  });

  it('draws the sessions, the session details and the chart; cancelling sends the code, the session and the note', async () => {
    const view = trackView(client, NOW);
    const after: TrackView = { ...view, next: view.next.map((s) => (s.day === '2026-11-04' ? { ...s, status: 'cancelled', by: 'client' } : s)) };
    const { sent, root } = mount([{ ok: true, data: view }, { ok: true, data: { view: after } }]);
    await flush();
    expect(sent[0]).toEqual({ action: 'track.view', code: CODE });
    expect(document.querySelector('a.lang-switch')!.getAttribute('href')).toBe(`/en/my-appointment/#k=${CODE}`);
    const rows = root.querySelectorAll('.tp-next .tp-session');
    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain('24 saatten az');
    expect(rows[1].textContent).toContain('İptal edildi');
    expect(rows[1].querySelectorAll('button')).toHaveLength(0);
    expect(root.textContent).toContain('Her çarşamba 09.00');
    expect(root.querySelector('.tp-bar')!.getAttribute('aria-label')).toBe('İşaretlenmedi %100');
    buttonIn(rows[2], 'İptal et').click();
    rows[2].querySelector('textarea')!.value = 'Hastayım';
    buttonIn(rows[2], 'Seansı iptal et').click();
    await flush();
    expect(sent[1]).toEqual({ action: 'track.ask', code: CODE, ask: 'cancel', note: 'Hastayım', day: '2026-11-04', time: '09:00' });
    expect(root.querySelectorAll('.tp-next .tp-session')[2].textContent).toContain('İptal edildi · sizin isteğinizle');
    expect(root.querySelector('[data-live]')!.textContent).toContain('iptal edildi');
  });

  it('less than 24 hours before, the full-fee warning comes first and the change goes with the client’s yes', async () => {
    const view = trackView(client, NOW);
    const { sent, root } = mount([{ ok: true, data: view }, { ok: true, data: { view } }]);
    await flush();
    const late = root.querySelectorAll('.tp-next .tp-session')[0];
    buttonIn(late, 'İptal et').click();
    expect(late.querySelector('.tp-warn')!.textContent).toContain('Tam ücret');
    expect(late.querySelector('textarea')).toBeNull();
    buttonIn(late, 'Anladım').click();
    buttonIn(late, 'Seansı iptal et').click();
    await flush();
    expect(sent[1]).toMatchObject({ ask: 'cancel', day: '2026-10-21', lateOk: true });
  });

  it('postponing offers only free days and times; a time must be chosen; a refusal shows its own text', async () => {
    const view = trackView(client, NOW);
    const { sent, root } = mount([{ ok: true, data: view }, { ok: false, data: { reason: 'taken' } }]);
    await flush();
    const row = root.querySelectorAll('.tp-next .tp-session')[2];
    buttonIn(row, 'Ertele').click();
    const select = row.querySelector('select')!;
    expect(select.options.length).toBeGreaterThan(5);
    expect([...select.options].map((o) => o.value)).not.toContain('2026-10-29');
    buttonIn(row, 'Seansı ertele').click();
    expect(sent).toHaveLength(1);
    expect(root.querySelector('[data-status]')!.textContent).toBe('Saat seçin');
    const radio = row.querySelector<HTMLInputElement>('.tp-time input')!;
    radio.click();
    buttonIn(row, 'Seansı ertele').click();
    await flush();
    expect(sent[1]).toMatchObject({ ask: 'postpone', day: '2026-11-04', time: '09:00', newDay: select.value, newTime: radio.value });
    expect(sent[1]).not.toHaveProperty('lateOk');
    expect(root.querySelector('[data-status]')!.textContent).toBe('Dolu');
  });

  it('the end request shows that it arrived', async () => {
    const view = trackView(client, NOW);
    const { sent, root } = mount([{ ok: true, data: view }, { ok: true, data: { view: { ...view, endAsked: true } } }]);
    await flush();
    const end = root.querySelector('.tp-end')!;
    buttonIn(end, 'Sonlandırmak istiyorum').click();
    buttonIn(end, 'Gönder').click();
    await flush();
    expect(sent.at(-1)).toMatchObject({ action: 'track.ask', ask: 'end' });
    expect(root.querySelector('.tp-end')!.textContent).toContain('İsteğiniz ulaştı');
  });
});

describe("the page's blocks (owner's request 2026-10-22)", () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('the view carries the code, the last two sessions and each fee; a cancellation in time has no fee', () => {
    const paid = { ...client, sessions: [...client.sessions, { day: '2026-10-14', time: '09:00', kind: 'weekly' as const, minutes: 50, status: 'attended' as const, paid: 1 }] };
    const v = trackView(paid, NOW);
    expect(v.number).toBe('KT001AY');
    expect(v.past.map((s) => [s.day, s.status, s.pay])).toEqual([
      ['2026-10-07', 'planned', 'due'],
      ['2026-10-14', 'attended', 'paid'],
    ]);
    expect(v.next.map((s) => s.pay)).toEqual(['due', undefined, 'due', 'due']);
    expect(payOf({ kind: 'closing', status: 'planned' })).toBe('free');
    expect(payOf({ kind: 'weekly', status: 'cancelled', late: true })).toBe('due');
  });

  it('draws the code, the next session larger, the past two latest first, and the labels in words', async () => {
    const v = trackView({ ...client, sessions: [...client.sessions, { day: '2026-10-14', time: '09:00', kind: 'weekly' as const, minutes: 50, status: 'attended' as const, paid: 1 }] }, NOW);
    const { root } = mount([{ ok: true, data: v }]);
    await flush();
    expect(root.querySelector('.tp-code')!.textContent).toBe('Danışan koduKT001AY');
    const next = root.querySelectorAll('.tp-next .tp-session');
    expect(next[0].classList.contains('is-first')).toBe(true);
    expect(next[0].textContent).toContain('Sıradaki seansınız');
    expect(next[0].querySelector('.tp-tag')!.textContent).toBe('Ödeme bekleniyor');
    const past = [...root.querySelectorAll('.tp-past .tp-session')].map((li) => [...li.querySelectorAll('.tp-tag')].map((t) => t.textContent));
    expect(past).toEqual([
      ['Katıldınız', 'Ödendi'],
      ['İşaretlenmedi', 'Ödeme bekleniyor'],
    ]);
    // On a wide screen the code comes first in the page, then the sessions, the chart and ending therapy.
    expect([...root.querySelector('[data-body]')!.children].map((c) => c.className)).toEqual(['tp-card tp-id', 'tp-sessions', 'tp-card tp-chart', 'tp-card tp-end']);
  });
});
