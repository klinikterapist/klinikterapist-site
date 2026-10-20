// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { askReschedule, applyChange } from '../../src/lib/sessions';
import { codeFromHash, trackView, type TrackView } from '../../src/lib/tracking';
import { mountTrackingPage, type TrackMessages } from '../../src/components/tracking/track-page';

// Tuesday 20 October 2026, 10:00 Istanbul.
const NOW = Date.parse('2026-10-20T10:00:00+03:00');
const CODE = `abc123def456.${'x'.repeat(32)}`;
const client = {
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

  it('shows the next four sessions without notes; one within 24 hours is late', () => {
    const v = trackView(client, NOW);
    expect(v.next.map((s) => [s.day, s.status, s.late])).toEqual([
      ['2026-10-21', 'planned', true],
      ['2026-10-28', 'cancelled', false],
      ['2026-11-04', 'planned', false],
      ['2026-11-11', 'planned', false],
    ]);
    expect(JSON.stringify(v)).not.toContain('Özel not');
  });

  it('a request for another time marks the session; the owner marking it takes the mark off', () => {
    const sessions = askReschedule(client, '2026-11-04', '09:00', 'Perşembe olur');
    expect(sessions).toContainEqual(expect.objectContaining({ day: '2026-11-04', status: 'planned', asked: 'reschedule', note: 'Perşembe olur' }));
    expect(() => askReschedule(client, '2026-10-28', '09:00', '')).toThrow();
    expect(() => askReschedule(client, '2026-11-05', '09:00', '')).toThrow();
    const after = applyChange({ ...client, sessions }, { op: 'mark', day: '2026-11-04', time: '09:00', status: 'cancelled', by: 'client' }, 30).sessions;
    expect(after.find((s) => s.day === '2026-11-04')).not.toHaveProperty('asked');
  });
});

const failures = { link: 'Geçersiz', late: 'Geç', gone: 'Yok', busy: 'Meşgul', invalid: 'Anlaşılmadı', network: 'Ağ' };
const m: TrackMessages = {
  loading: 'Yükleniyor', noLink: 'Bağlantı yok', failures, weekly: 'Her {day} {time} · {type}', types: { individual: 'Bireysel terapi' },
  kinds: { weekly: 'Seans', intro: 'Ön görüşme', closing: 'Sonlandırma', extra: 'Ek seans' }, status: { cancelled: 'İptal edildi', postponed: 'Ertelendi' },
  byClient: 'sizin isteğinizle', asked: 'İsteğiniz iletildi', late: '24 saatten az', none: 'Seans yok', cancel: 'İptal et', reschedule: 'Başka saat iste',
  cancelNote: 'Not', rescheduleNote: 'Uygun saatler', confirmCancel: 'Seansı iptal et', sendReschedule: 'Gönder', back: 'Vazgeç', sending: 'Gönderiliyor',
  cancelled: 'iptal edildi', rescheduled: 'iletildi', endTitle: 'Sonlandırmak', endText: 'Metin', endButton: 'Sonlandırmak istiyorum', endNote: 'Not',
  endSend: 'Gönder', endDone: 'İsteğiniz ulaştı', closing: 'Sonlandırma planlanıyor', weekdays: ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'],
};

function mount(answers: unknown[], hash = `#k=${CODE}`) {
  history.replaceState(null, '', `/randevum/${hash}`);
  document.body.innerHTML = `<a class="lang-switch" href="/en/my-appointment/">EN</a><div data-tracking data-lang="tr" data-endpoint="https://api.test/exec" data-messages='${JSON.stringify(m)}'>
    <p data-status></p><div data-body hidden></div><p data-live></p></div>`;
  const sent: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body));
    return { json: async () => answers.shift() } as Response;
  });
  mountTrackingPage(document.querySelector('[data-tracking]')!, { fetch: fetch as unknown as typeof window.fetch, now: () => NOW });
  return { sent, root: document.querySelector<HTMLElement>('[data-tracking]')! };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const button = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === text)!;

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

  it('draws the sessions; a late one has no buttons; cancelling sends the code, the session and the note', async () => {
    const view = trackView(client, NOW);
    const after: TrackView = { ...view, next: view.next.map((s) => (s.day === '2026-11-04' ? { ...s, status: 'cancelled', by: 'client' } : s)) };
    const { sent, root } = mount([{ ok: true, data: view }, { ok: true, data: { view: after } }]);
    await flush();
    expect(sent[0]).toEqual({ action: 'track.view', code: CODE });
    expect(document.querySelector('a.lang-switch')!.getAttribute('href')).toBe(`/en/my-appointment/#k=${CODE}`);
    const rows = root.querySelectorAll('.tp-session');
    expect(rows).toHaveLength(4);
    expect(rows[0].querySelectorAll('button')).toHaveLength(0);
    expect(rows[0].textContent).toContain('24 saatten az');
    expect(rows[1].textContent).toContain('İptal edildi');
    expect(rows[1].textContent).not.toContain('sizin isteğinizle');
    rows[2].querySelector('button')!.click();
    root.querySelector('textarea')!.value = 'Hastayım';
    button('Seansı iptal et').click();
    await flush();
    await flush();
    expect(sent[1]).toEqual({ action: 'track.ask', code: CODE, ask: 'cancel', note: 'Hastayım', day: '2026-11-04', time: '09:00' });
    expect(root.querySelectorAll('.tp-session')[2].textContent).toContain('İptal edildi · sizin isteğinizle');
    expect(root.querySelector('[data-live]')!.textContent).toContain('iptal edildi');
  });

  it('a refusal shows its own text and keeps the form; the end request shows that it arrived', async () => {
    const view = trackView(client, NOW);
    const { sent, root } = mount([{ ok: true, data: view }, { ok: false, data: { reason: 'late' } }, { ok: true, data: { view: { ...view, endAsked: true } } }]);
    await flush();
    root.querySelectorAll('.tp-session')[2].querySelectorAll('button')[1].click();
    button('Gönder').click();
    await flush();
    await flush();
    expect(root.querySelector('[data-status]')!.textContent).toBe('Geç');
    expect(root.querySelector('.tp-session textarea')).not.toBeNull();
    button('Sonlandırmak istiyorum').click();
    [...root.querySelectorAll<HTMLButtonElement>('.tp-end button')].find((b) => b.textContent === 'Gönder')!.click();
    await flush();
    await flush();
    expect(sent.at(-1)).toMatchObject({ action: 'track.ask', ask: 'end' });
    expect(root.querySelector('.tp-end')!.textContent).toContain('İsteğiniz ulaştı');
  });
});
