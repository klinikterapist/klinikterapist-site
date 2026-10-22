// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseBooking } from '../../src/lib/schemas';
import { sessionStats, sessionsOf } from '../../src/lib/sessions';
import { closingDeadline, closingState, closingStep, closingTarget, convertToClosing, type ClosingClient } from '../../src/lib/closing';
import { closingTimes, trackView, type TrackView } from '../../src/lib/tracking';
import { endMail } from '../../src/admin/lib/booking-mail';
import { mountTrackingPage, type TrackMessages } from '../../src/components/tracking/track-page';

// Tuesday 20 October 2026, 10:00 Istanbul.
const NOW = Date.parse('2026-10-20T10:00:00+03:00');
const at = (s: string) => Date.parse(`${s}+03:00`);
const cfg = parseBooking(JSON.parse(readFileSync('src/data/booking.json', 'utf8')));
/** Weekly on Wednesdays 09:00, invited at NOW: until the end of Friday 23 October. */
const client: ClosingClient & { number: string; type: string; contact: { lang: 'tr' } } = {
  number: 'KT001AY',
  type: 'individual',
  weekday: 3,
  time: '09:00',
  minutes: 50,
  since: '2026-10-01',
  status: 'closing',
  contact: { lang: 'tr' },
  closingAsk: { at: NOW, until: closingDeadline(NOW).until },
};

describe('the closing session (closing.ts)', () => {
  it('the time to pick ends at midnight after the third day, Turkey time', () => {
    expect(closingDeadline(NOW)).toEqual({ day: '2026-10-23', until: at('2026-10-24T00:00:00') });
    expect(closingDeadline(at('2026-10-20T23:30:00')).day).toBe('2026-10-23');
    expect(closingDeadline(at('2026-10-21T00:30:00')).day).toBe('2026-10-24');
  });

  it('waits, reminds a day before the end, then converts; any closing session settles it', () => {
    expect(closingStep(client, NOW)).toBe('none');
    expect(closingStep(client, at('2026-10-23T00:00:00'))).toBe('remind');
    expect(closingStep({ ...client, closingAsk: { ...client.closingAsk!, reminded: true } }, at('2026-10-23T12:00:00'))).toBe('none');
    expect(closingStep(client, at('2026-10-24T00:00:00'))).toBe('convert');
    const picked = { ...client, sessions: [{ day: '2026-10-25', time: '11:00', kind: 'closing' as const, minutes: 30, status: 'planned' as const }] };
    expect(closingStep(picked, at('2026-10-24T00:00:00'))).toBe('settle');
    // A cancelled one does not count.
    expect(closingStep({ ...picked, sessions: [{ ...picked.sessions[0], status: 'cancelled' as const }] }, at('2026-10-24T00:00:00'))).toBe('convert');
    expect(closingStep({ ...client, closingAsk: { ...client.closingAsk!, done: NOW } }, at('2026-10-24T00:00:00'))).toBe('none');
    expect(closingStep({ ...client, status: 'active' }, at('2026-10-24T00:00:00'))).toBe('none');
  });

  it('the session that becomes it is the next planned paid one at least a day after the end', () => {
    // Wednesday 28 October 09:00 is more than a day after Saturday 00:00.
    expect(closingTarget(client, client.closingAsk!.until)).toMatchObject({ day: '2026-10-28', time: '09:00' });
    // Less than a day ahead is skipped, and so is a cancelled one.
    expect(closingTarget(client, at('2026-10-27T10:00:00'))).toMatchObject({ day: '2026-11-04' });
    const cancelled = { ...client, sessions: [{ day: '2026-10-28', time: '09:00', kind: 'weekly' as const, minutes: 50, status: 'cancelled' as const }] };
    expect(closingTarget(cancelled, client.closingAsk!.until)).toMatchObject({ day: '2026-11-04' });
  });

  it('a weekly session made the closing session takes that week’s place: free, 30 minutes, the other weeks as before', () => {
    const sessions = convertToClosing(client, { day: '2026-10-28', time: '09:00' });
    const c = { ...client, sessions };
    expect(sessionsOf(c, '2026-10-27', '2026-11-05').map((s) => [s.day, s.kind, s.minutes])).toEqual([
      ['2026-10-28', 'closing', 30],
      ['2026-11-04', 'weekly', 50],
    ]);
    // 7, 14 and 21 October are paid sessions; 28 October is the free one.
    expect(sessionStats(c, at('2026-10-28T12:00:00'))).toMatchObject({ free: 1, total: 3 });
    expect(() => convertToClosing(client, { day: '2026-10-29', time: '09:00' })).toThrow();
  });

  it('the panel sees the wait, a picked time, or the converted session', () => {
    expect(closingState(client, NOW)).toMatchObject({ step: 'wait', lastDay: '2026-10-23', target: { day: '2026-10-28' } });
    const sessions = convertToClosing(client, { day: '2026-10-28', time: '09:00' });
    expect(closingState({ ...client, sessions, closingAsk: { ...client.closingAsk!, done: 1, auto: { day: '2026-10-28', time: '09:00' } } }, NOW)).toMatchObject({ step: 'auto', session: { day: '2026-10-28' } });
    const picked = [{ day: '2026-10-25', time: '11:00', kind: 'closing' as const, minutes: 30, status: 'planned' as const }];
    expect(closingState({ ...client, sessions: picked }, NOW)).toMatchObject({ step: 'planned', session: { day: '2026-10-25' } });
    expect(closingState({ ...client, status: 'active', closingAsk: undefined }, NOW)).toEqual({ step: 'none' });
  });
});

describe('the closing session on the page (tracking.ts)', () => {
  it('the view offers the pick only while it is open', () => {
    expect(trackView(client, NOW).closingPick).toEqual({ lastDay: '2026-10-23', target: { day: '2026-10-28', time: '09:00' } });
    expect(trackView(client, at('2026-10-24T00:00:00')).closingPick).toBeUndefined();
    expect(trackView({ ...client, status: 'active' }, NOW).closingPick).toBeUndefined();
  });

  it('its times are the intro-call calendar’s, minus what others take', () => {
    const v = trackView(client, NOW);
    const times = closingTimes(cfg, v, '2026-10-24', NOW);
    expect(times).toEqual(cfg.intro.weekdays['6']);
    // A weekday has no intro-call times.
    expect(closingTimes(cfg, v, '2026-10-22', NOW)).toEqual([]);
    const start = at('2026-10-24T11:00:00');
    expect(closingTimes(cfg, { ...v, busy: [{ start, end: start + 60e3 }] }, '2026-10-24', NOW)).not.toContain('11:00');
  });
});

describe('the invitation e-mail (booking-mail.ts)', () => {
  it('has the button to the page and the last day instead of "reply to this e-mail"', () => {
    const tr = endMail({ name: 'Ayşe Örnek', lang: 'tr' }, 'closing', { link: 'https://klinikterapist.com/randevum/#k=x', lastDay: '2026-10-23' });
    expect(tr.body).toContain('→ Görüşme saatini seç: https://klinikterapist.com/randevum/#k=x');
    expect(tr.body).toContain('23 Ekim 2026, Cuma gününün sonuna kadar');
    expect(tr.body).not.toContain('yanıtlayarak');
    const en = endMail({ name: 'Anna Example', lang: 'en' }, 'closing', { link: 'https://klinikterapist.com/en/my-appointment/#k=x', lastDay: '2026-10-23' });
    expect(en.body).toContain('https://klinikterapist.com/en/my-appointment/#k=x');
    expect(en.body).not.toContain('reply to this e-mail');
  });
});

const failures = { link: 'Geçersiz', late: 'Geç', gone: 'Yok', taken: 'Dolu', busy: 'Meşgul', invalid: 'Anlaşılmadı', network: 'Ağ' };
const m = {
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
} satisfies TrackMessages;

describe('the closing card (track-page.ts)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows until when and what happens otherwise; a picked time is sent and the card goes', async () => {
    const CODE = `abc123def456.${'x'.repeat(32)}`;
    history.replaceState(null, '', `/randevum/#k=${CODE}`);
    const view = trackView(client, NOW);
    const after: TrackView = { ...view, closingPick: undefined, next: [{ day: '2026-10-24', time: '10:30', kind: 'closing' as const, minutes: 30, status: 'planned' as const, late: false }, ...view.next].slice(0, 4) };
    const answers: unknown[] = [{ ok: true, data: view }, { ok: true, data: { view: after } }];
    const root = document.createElement('div');
    Object.assign(root.dataset, { tracking: '', lang: 'tr', endpoint: 'https://api.test/exec', config: JSON.stringify(cfg), messages: JSON.stringify(m) });
    root.innerHTML = '<p data-status></p><div data-body hidden></div><p data-live></p>';
    document.body.append(root);
    const sent: Record<string, unknown>[] = [];
    const fetch = vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return { json: async () => answers.shift() } as Response;
    });
    mountTrackingPage(root, { fetch: fetch as unknown as typeof window.fetch, now: () => NOW });
    const flush = async () => {
      for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
    };
    await flush();
    const card = root.querySelector('.tp-closing')!;
    expect(card.textContent).toContain('23 Ekim 2026, Cuma sonuna kadar');
    expect(card.textContent).toContain('Seçmezseniz 28 Ekim 2026, Çarşamba · 09.00');
    // Days with intro-call times only: the first is Saturday 24 October.
    expect(card.querySelector('select')!.value).toBe('2026-10-24');
    const send = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Bu saati seç')!;
    send.click();
    expect(root.querySelector('[data-status]')!.textContent).toBe('Saat seçin');
    card.querySelector<HTMLInputElement>('input[value="10:30"]')!.click();
    send.click();
    await flush();
    expect(sent[1]).toEqual({ action: 'track.ask', code: CODE, ask: 'closing', note: '', day: '2026-10-24', time: '10:30' });
    expect(root.querySelector('.tp-closing')).toBeNull();
    expect(root.querySelector('[data-live]')!.textContent).toBe('Planlandı: 24 Ekim 2026, Cumartesi · 10.30');
  });
});
