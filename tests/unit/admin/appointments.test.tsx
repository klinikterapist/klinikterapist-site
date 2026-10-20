// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RequestsPage } from '../../../src/admin/ui/appointments/RequestsPage';
import { TrackingPage } from '../../../src/admin/ui/appointments/TrackingPage';
import { ClientPage } from '../../../src/admin/ui/appointments/ClientPage';
import { templateTimes } from '../../../src/admin/ui/appointments/AppointmentCalendar';
import { Panel, parseRoute } from '../../../src/admin/ui/context';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';
import { decisionMail, endMail, revertMail } from '../../../src/admin/lib/booking-mail';
import { clientNumber } from '../../../src/lib/booking-form';
import type { BookingRequest, Client } from '../../../src/admin/api/types';

afterEach(() => {
  cleanup();
  location.hash = '';
});

const session: BookingRequest = {
  id: 'r1', createdAt: Date.now(), kind: 'session', type: 'couple', day: '2026-10-22', time: '19:20', name: 'Ayşe Yılmaz', email: 'ayse@example.com', phone: '0532 000 00 00',
  note: 'Akşam daha uygun.', lang: 'tr', status: 'pending', holdId: 'h1',
};
const intro: BookingRequest = {
  id: 'r2', createdAt: Date.now(), kind: 'intro', day: '2026-10-24', time: '11:00', name: 'Ali Kaya', email: 'ali@example.com', phone: '0533 000 00 00', note: '', lang: 'tr',
  forWhom: 'individual', topics: [0, 8], before: 'no', age: 2, status: 'pending', holdId: 'h2',
};
const client = (c: Partial<Client> = {}): Client => ({
  id: 'c1', number: 'KT007OGO', type: 'individual', weekday: 2, time: '10:00', minutes: 50, since: '2026-10-20', status: 'active',
  contact: { name: 'Osman Güneş Özkurt', email: 'osman@example.com', lang: 'tr' }, ...c,
});

function setup(page: 'requests' | 'tracking' | `client:${string}`, requests: BookingRequest[] = [session, intro], clients: (Client & { origin?: BookingRequest })[] = []) {
  const api = createMockApi({ seed: {} });
  api.state.requests.push(...requests.map((r) => ({ ...r })));
  api.state.calendar.push(
    ...requests.filter((r) => r.status === 'pending').map((r) => ({ id: r.holdId, start: Date.parse(`${r.day}T${r.time}:00+03:00`), minutes: 50, kind: r.kind, status: 'hold' as const, holdUntil: Date.now() + 864e5 })),
  );
  api.state.clients.push(...clients);
  render(
    <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' }, store: createSessionStore(localStorage) }}>
      {page === 'requests' ? <RequestsPage add={null} /> : page === 'tracking' ? <TrackingPage /> : <ClientPage id={page.slice(7)} />}
    </Panel.Provider>,
  );
  return { api };
}

const card = async (name: string) => (await screen.findByText(name, { selector: 'b' })).closest('li') as HTMLElement;
const row = async (number: string) => (await screen.findByText(number)).closest('li') as HTMLElement;

describe('Randevu talepleri and Seans takip are separate pages', () => {
  it('routes: /randevular and /seans-takip; the older links still land on the right page', () => {
    expect(parseRoute('#/randevular')).toEqual({ name: 'requests', add: null });
    expect(parseRoute('#/randevular/takvim')).toEqual({ name: 'requests', add: null });
    expect(parseRoute('#/seans-takip')).toEqual({ name: 'tracking' });
    expect(parseRoute('#/randevular/danisanlar')).toEqual({ name: 'tracking' });
    expect(parseRoute('#/randevular?ekle=2026-10-22T19:20&tur=couple')).toEqual({ name: 'requests', add: { day: '2026-10-22', time: '19:20', type: 'couple' } });
  });

  it('client numbers: KT, three digits and the initials, Turkish letters folded', () => {
    expect(clientNumber(1, 'Osman Güneş Özkurt')).toBe('KT001OGO');
    expect(clientNumber(12, '  güneş  özkurt ')).toBe('KT012GO');
    expect(clientNumber(3, 'İlknur Çağlar Şen Ünal Ek')).toBe('KT003ICSU');
  });
});

describe('ready e-mails', () => {
  it('decisions are personal: name, date, time and what was asked; intro approval names the topics', () => {
    const a = decisionMail(session, 'approve');
    expect(a.subject).toBe('Randevunuz onaylandı – klinikterapist.com');
    expect(a.body).toContain('Sayın Ayşe Yılmaz,');
    expect(a.body).toContain('22 Ekim 2026, Perşembe, saat 19.20 için çift terapisi randevu talebiniz onaylanmıştır.');
    expect(decisionMail(intro, 'approve').body).toContain('şu konuları konuşmak istediğinizi belirttiniz: Kaygı ve stres, Uyku');
    const u = decisionMail(session, 'unavailable');
    expect(u.body).toContain('Ne yazık ki bu saatte uygun değilim.');
    expect(u.body).toContain('https://klinikterapist.com/randevu/');
    expect(decisionMail({ ...intro, lang: 'en' }, 'cancel').body).toContain('https://klinikterapist.com/en/intro-call/');
  });

  it('ending therapy, the closing session and the apology', () => {
    const c = { name: 'Ayşe Yılmaz', lang: 'tr' as const };
    expect(endMail(c, 'complete').body).toContain('terapi sürecinin sona erdiğini');
    const closing = endMail(c, 'closing').body;
    expect(closing).toContain('ücretsiz, 25–30 dakikalık bir sonlandırma görüşmesi');
    expect(closing).toContain('Sonlandırma görüşmesi terapinin önemli bir parçasıdır.');
    const sorry = revertMail(c).body;
    expect(sorry).toContain('teknik bir sorun nedeniyle yanlışlıkla gönderilmiştir');
    expect(sorry).toContain('bir sonraki e-postamda');
    expect(endMail({ ...c, lang: 'en' }, 'closing').subject).toBe('A closing session for our therapy – klinikterapist.com');
  });
});

describe('Randevu talepleri', () => {
  it('shows each request with its details and the three buttons, beside the calendar', async () => {
    setup('requests');
    const c = await card('Ayşe Yılmaz');
    // The kind in its own box beside the date; the session type under the name, no e-mail there.
    expect(c.querySelector('.rq-kindbox')!.textContent).toBe('SeansRandevusu');
    expect(c.querySelector('.rq-who')!.textContent).toBe('Ayşe YılmazÇift terapisi · 60 dakika');
    expect(c.textContent).toContain('Konuşma dili');
    expect(c.textContent).toContain('E-posta henüz doğrulanmadı');
    expect((await card('Ali Kaya')).querySelector('.rq-kindbox')!.textContent).toBe('Ön görüşmeÜcretsiz');
    expect(c.textContent).toContain('22 Ekim 2026, Perşembe, 19.20');
    expect(c.textContent).toContain('Akşam daha uygun.');
    for (const name of ['Onayla', 'Uygun değilim', 'İptal et']) expect(within(c).getByRole('button', { name })).toBeTruthy();
    expect((await card('Ali Kaya')).textContent).toContain('Kaygı ve stres, Uyku');
    expect(await screen.findByRole('region', { name: 'Randevu takvimi' })).toBeTruthy();
  });

  it('Onayla sends the edited e-mail and confirms the time; the request moves to Onaylanan', async () => {
    const { api } = setup('requests');
    fireEvent.click(within(await card('Ayşe Yılmaz')).getByRole('button', { name: 'Onayla' }));
    const dialog = screen.getByRole('dialog', { name: 'Onay e-postası' });
    const body = within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: `${body.value}\n\nNot: İlk seanstan önce kısa bir form göndereceğim.` } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Onayla ve gönder' }));
    await waitFor(() => expect(api.state.sent).toHaveLength(1));
    expect(api.state.sent[0]).toMatchObject({ to: 'ayse@example.com', subject: 'Randevunuz onaylandı – klinikterapist.com' });
    expect(api.state.sent[0].body).toContain('kısa bir form');
    expect(api.state.calendar.find((e) => e.status === 'confirmed')).toMatchObject({ minutes: 60, type: 'couple' });
    expect(await screen.findByRole('button', { name: 'Onaylanan (1)' })).toBeTruthy();
  });

  it('Uygun değilim sends the e-mail, frees the time and deletes the request', async () => {
    const { api } = setup('requests');
    fireEvent.click(within(await card('Ayşe Yılmaz')).getByRole('button', { name: 'Uygun değilim' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Uygun değilim ve gönder' }));
    await waitFor(() => expect(api.state.requests.map((r) => r.id)).toEqual(['r2']));
    expect(api.state.calendar.some((e) => e.id === 'h1')).toBe(false);
  });

  it('Seans takibe geçir: a booking keeps its weekday and time and gets a KT number', async () => {
    const { api } = setup('requests', [{ ...session, status: 'approved', calendarId: 'c1' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Onaylanan (0)' }));
    fireEvent.click(within(await card('Ayşe Yılmaz')).getByRole('button', { name: 'Seans takibe geçir' }));
    const dialog = screen.getByRole('dialog', { name: 'Seans takibe geçir' });
    expect(dialog.textContent).toContain('her perşembe 19.20');
    expect(dialog.textContent).toContain('KT001AY gibi');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Takibe geçir' }));
    await waitFor(() => expect(api.state.clients).toHaveLength(1));
    expect(api.state.clients[0]).toMatchObject({ number: 'KT001AY', weekday: 4, time: '19:20', status: 'active', contact: { email: 'ayse@example.com' } });
    expect(api.state.requests).toHaveLength(0);
    expect(await screen.findByText(/KT001AY numarasıyla Seans takibe alındı/)).toBeTruthy();
  });

  it('an intro call asks for the weekly day and time before moving', async () => {
    const { api } = setup('requests', [{ ...intro, status: 'approved', calendarId: 'c2' }]);
    fireEvent.click(screen.getByRole('button', { name: /Onaylanan/ }));
    fireEvent.click(within(await card('Ali Kaya')).getByRole('button', { name: 'Seans takibe geçir' }));
    const dialog = screen.getByRole('dialog', { name: 'Seans takibe geçir' });
    const go = within(dialog).getByRole('button', { name: 'Takibe geçir' }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Gün'), { target: { value: '3' } });
    fireEvent.change(within(dialog).getByLabelText('Saat'), { target: { value: '19:50' } });
    fireEvent.click(go);
    await waitFor(() => expect(api.state.clients).toHaveLength(1));
    expect(api.state.clients[0]).toMatchObject({ number: 'KT001AK', weekday: 3, time: '19:50', type: 'individual' });
  });

  it('Geri al on an approved request sends the apology and makes it pending again', async () => {
    const { api } = setup('requests', [{ ...session, status: 'approved', calendarId: 'c1' }]);
    api.state.calendar.push({ id: 'c1', start: Date.parse('2026-10-22T19:20:00+03:00'), minutes: 60, kind: 'session', type: 'couple', status: 'confirmed' });
    fireEvent.click(screen.getByRole('button', { name: /Onaylanan/ }));
    fireEvent.click(within(await card('Ayşe Yılmaz')).getByRole('button', { name: 'Geri al' }));
    const dialog = screen.getByRole('dialog', { name: 'Geri al: özür e-postası' });
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('teknik bir sorun');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gönder ve geri al' }));
    await waitFor(() => expect(api.state.requests[0].status).toBe('pending'));
    expect(api.state.sent[0].to).toBe('ayse@example.com');
    expect(api.state.calendar.some((e) => e.id === 'c1')).toBe(false);
  });
});

describe('Seans takip', () => {
  const day = (n: number) => new Date(Date.now() + 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
  const weekdayIn = (n: number) => new Date(`${day(n)}T12:00:00Z`).getUTCDay();

  it('Aktif danışanlar: today first, then the coming sessions, nearest first; a row has the next session and the way to the page only', async () => {
    setup('tracking', [], [
      client({ id: 'c3', number: 'KT003CC', weekday: weekdayIn(5), time: '10:00', since: day(-30) }),
      client({ id: 'c2', number: 'KT002BB', weekday: weekdayIn(1), time: '10:00', since: day(-30) }),
      client({ id: 'c1', number: 'KT001AA', weekday: weekdayIn(0), time: '23:59', since: day(-30), sessions: [{ day: day(-6), time: '23:59', kind: 'weekly', minutes: 50, status: 'cancelled', by: 'client', late: true }] }),
    ]);
    const r1 = await row('KT001AA');
    expect(screen.getByText('Aktif danışanlar (3)')).toBeTruthy();
    expect(screen.getByText('Bugün (1)')).toBeTruthy();
    expect(screen.getByText('Yaklaşan seanslar (2)')).toBeTruthy();
    expect(r1.textContent).toContain('Bugün, 23.59');
    expect(r1.textContent).not.toMatch(/tam ücret|Osman/);
    expect(within(r1).queryByRole('button')).toBeNull();
    expect(within(r1).getByRole('link', { name: 'KT001AA: danışanın sayfasına git' }).getAttribute('href')).toBe('#/seans-takip/c1');
    const coming = [...document.querySelectorAll('.tk-number')].map((e) => e.textContent);
    expect(coming).toEqual(['KT001AA', 'KT002BB', 'KT003CC']);
    expect((await row('KT002BB')).textContent).toContain('Yarın, 10.00');
    // Randevu ekle is on Randevu talepleri only; here, the time now.
    expect(screen.queryByRole('button', { name: 'Randevu ekle' })).toBeNull();
    expect(screen.getByLabelText('Şu an')).toBeTruthy();
  });

  it("on the client's page, Terapi tamamlandı sends the e-mail and removes the client", async () => {
    const { api } = setup('client:c1', [], [client()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Terapiyi sonlandır' }));
    const dialog = screen.getByRole('dialog', { name: 'KT007OGO: terapiyi sonlandır' });
    expect(dialog.textContent).toContain('osman@example.com');
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('Sayın Osman Güneş Özkurt,');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gönder ve takipten çıkar' }));
    await waitFor(() => expect(api.state.clients).toHaveLength(0));
    expect(api.state.sent[0]).toMatchObject({ to: 'osman@example.com', subject: 'Terapi sürecimizin sonlanması – klinikterapist.com' });
    expect(await screen.findByText(/Seans takipten çıkarıldı/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Seans takibe dön' })).toBeTruthy();
  });

  it('Sonlandırma görüşmesi talep et sends the invitation and keeps the client, marked; the list shows them in the closing stage', async () => {
    const { api } = setup('client:c1', [], [client()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Terapiyi sonlandır' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sonlandırma görüşmesi talep et' }));
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('sonlandırma görüşmesi');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Daveti gönder' }));
    await waitFor(() => expect(api.state.clients[0].status).toBe('closing'));
    expect(await screen.findByText('Sonlandırma görüşmesi bekleniyor')).toBeTruthy();
    cleanup();
    setup('tracking', [], [{ ...client(), status: 'closing' }]);
    expect(await screen.findByText('Sonlandırma aşamasında (1)')).toBeTruthy();
  });

  it('Geri al sends the apology and the person is back in Randevu talepleri', async () => {
    const { api } = setup('client:c1', [], [{ ...client(), origin: { ...session, day: '2030-01-03' } }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Geri al' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Gönder ve geri al' }));
    await waitFor(() => expect(api.state.clients).toHaveLength(0));
    expect(api.state.requests).toEqual([expect.objectContaining({ status: 'pending', name: 'Ayşe Yılmaz' })]);
    expect(api.state.calendar.some((e) => e.status === 'hold')).toBe(true);
    expect(api.state.sent[0].body).toContain('teknik bir sorun');
    expect(await screen.findByRole('link', { name: 'Randevu taleplerine git →' })).toBeTruthy();
  });

  it('Sil removes the client with no e-mail', async () => {
    const { api } = setup('client:c1', [], [client()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Sil' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sil' }));
    await waitFor(() => expect(api.state.clients).toHaveLength(0));
    expect(api.state.sent).toEqual([]);
  });
});

describe('the calendar (same on both pages)', () => {
  it('marks confirmed appointments and waiting requests differently, explains the marks and shows the holidays', async () => {
    setup('tracking', [session], [client({ weekday: 4, time: '19:20', since: '2026-10-01' })]);
    // 22 October: the weekly session and the waiting request (19:20 both) → 1 confirmed, 1 waiting.
    const day = await screen.findByRole('button', { name: /22 Ekim 2026, Perşembe, %\d+ dolu, 1 onaylı, 1 bekleyen talep/ });
    expect(day.querySelector('.mk-ok')).toBeTruthy();
    expect(day.querySelector('.mk-wait')).toBeTruthy();
    const legend = screen.getByRole('list', { name: 'Takvim işaretleri' });
    expect(legend.textContent).toContain('Onaylı randevu ya da Seans takipteki danışan');
    expect(legend.textContent).toContain('Onay bekleyen talep');
    fireEvent.click(day);
    expect(screen.getByText('Seans takip · KT007OGO')).toBeTruthy();
    expect(screen.getByText('Onay bekleyen talep', { selector: 'small' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /29 Ekim 2026, Perşembe, Cumhuriyet Bayramı/ }).className).toContain('is-holiday');
    expect(screen.getByText('29 Ekim: Cumhuriyet Bayramı (kapalı)')).toBeTruthy();
  });
});

describe('Randevu ekle, randevu alımı, bekleme listesi (owner’s review 2026-10-20)', () => {
  it('Randevu ekle: name and e-mail typed by the owner (a near-miss domain gets a fix), the time confirmed, the e-mail sent', async () => {
    const { api } = setup('requests', []);
    fireEvent.click(await screen.findByRole('button', { name: 'Randevu ekle' }));
    const dialog = screen.getByRole('dialog', { name: 'Randevu ekle' });
    fireEvent.change(within(dialog).getByLabelText('Ad soyad'), { target: { value: 'Osman Güneş Özkurt' } });
    fireEvent.change(within(dialog).getByLabelText('E-posta'), { target: { value: 'osman@gmial.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Düzelt' }));
    expect((within(dialog).getByLabelText('E-posta') as HTMLInputElement).value).toBe('osman@gmail.com');
    fireEvent.change(within(dialog).getByLabelText('Konuşma dili'), { target: { value: 'en' } });
    fireEvent.change(within(dialog).getByLabelText('Tarih'), { target: { value: '2026-10-22' } });
    fireEvent.change(within(dialog).getByLabelText('Saat'), { target: { value: '19:20' } });
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('Dear Osman Güneş Özkurt,');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ekle ve e-postayı gönder' }));
    await waitFor(() => expect(api.state.requests).toHaveLength(1));
    expect(api.state.requests[0]).toMatchObject({ status: 'approved', source: 'manual', email: 'osman@gmail.com', lang: 'en' });
    expect(api.state.sent[0]).toMatchObject({ to: 'osman@gmail.com', subject: 'Your appointment is confirmed – klinikterapist.com' });
    expect(api.state.calendar.some((e) => e.status === 'confirmed')).toBe(true);
  });

  it('Randevu alımını kapat asks first, then the site shows "Haber et"; it opens again in one click', async () => {
    const { api } = setup('requests', []);
    fireEvent.click(await screen.findByRole('button', { name: 'Randevu alımını kapat' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Randevu alımı kapatılsın mı?' })).getByRole('button', { name: 'Randevu alımını kapat' }));
    await waitFor(() => expect(api.state.open).toBe(false));
    expect(await screen.findByText('Randevu alımı kapalı')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Randevu alımını aç' }));
    await waitFor(() => expect(api.state.open).toBe(true));
  });

  it('Bekleme listesi: offer a time with a ready e-mail, then take someone off the list', async () => {
    const api0 = setup('requests', []).api;
    api0.state.waitlist.push({ id: 'w1', createdAt: Date.now(), name: 'Elif Bekler', email: 'elif@example.com', phone: '0534', kinds: ['couple'], times: ['weekend'], reason: 'İletişim sorunları', lang: 'tr' });
    fireEvent.click(await screen.findByRole('button', { name: /Bekleme listesi/ }));
    const c = await card('Elif Bekler');
    expect(c.textContent).toContain('Çift terapisi');
    expect(c.textContent).toContain('İletişim sorunları');
    fireEvent.click(within(c).getByRole('button', { name: 'Saat öner' }));
    let dialog = screen.getByRole('dialog', { name: 'Saat öner' });
    fireEvent.change(within(dialog).getByLabelText('Tarih (isteğe bağlı)'), { target: { value: '2026-10-22' } });
    fireEvent.change(within(dialog).getByLabelText('Saat'), { target: { value: '19:20' } });
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('22 Ekim 2026, Perşembe, saat 19.20');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gönder' }));
    await waitFor(() => expect(api0.state.waitlist[0].offeredAt).toBeTruthy());
    fireEvent.click(within(await card('Elif Bekler')).getByRole('button', { name: 'Listeden çıkar' }));
    dialog = screen.getByRole('dialog', { name: 'Listeden çıkar' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gönder ve listeden çıkar' }));
    await waitFor(() => expect(api0.state.waitlist).toHaveLength(0));
    expect(api0.state.sent.map((m) => m.subject)).toEqual(['Bir saat boşaldı – klinikterapist.com', 'Bekleme listem hakkında – klinikterapist.com']);
  });

  it('a full day’s bar turns red', async () => {
    const { api } = setup('tracking', []);
    api.state.calendar.push(
      ...templateTimes('2026-11-05').map((t, i) => ({ id: `f${i}`, start: Date.parse(`2026-11-05T${t}:00+03:00`), minutes: 50, kind: 'session' as const, status: 'confirmed' as const })),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Sonraki ay' }));
    const day = await screen.findByRole('button', { name: /5 Kasım 2026, Perşembe, tamamen dolu/ });
    expect(day.className).toContain('is-full');
  });
});

describe('a client’s page in Seans takip', () => {
  it('the last and next sessions; mark attended; cancel as asked by the client; the free intro call shows as free', async () => {
    const day = (n: number) => new Date(Date.now() + 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
    // Weekly on tomorrow's weekday: two past sessions and the next tomorrow, whatever the hour the test runs.
    const weekday = new Date(`${day(1)}T12:00:00Z`).getUTCDay();
    const { api } = setup('client:c1', [], [client({ weekday, time: '10:00', since: day(-13), sessions: [{ day: day(-20), time: '11:00', kind: 'intro', minutes: 30, status: 'attended' }] })]);
    expect(await screen.findByText('KT007OGO')).toBeTruthy();
    expect(screen.getByText('Ücretsiz ön görüşme').className).toContain('is-free');
    // Only the weekly time, the type and when therapy began; no name, e-mail or language.
    const page = document.body.textContent!;
    expect(page).toContain('Terapiye başlangıç');
    expect(page).toContain('Görüşme türü');
    expect(page).not.toMatch(/Osman|osman@example|Konuşma dili/);
    expect(screen.getByRole('img', { name: /İşaretlenmedi %100/ })).toBeTruthy();
    expect(screen.getAllByText(/1\. seans/).length).toBeGreaterThan(0);
    const past = screen.getByRole('heading', { name: /Geçmiş seanslar/ }).parentElement!;
    const rows = within(past).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Katıldı' }));
    await waitFor(() => expect(api.state.clients[0].sessions).toContainEqual(expect.objectContaining({ day: day(-13), status: 'attended' })));
    const next = screen.getByRole('heading', { name: /Sıradaki seanslar/ }).parentElement!;
    fireEvent.click(within(within(next).getAllByRole('listitem')[0]).getByRole('button', { name: 'İptal' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Not (isteğe bağlı)'), { target: { value: 'Seyahat' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(api.state.clients[0].sessions).toContainEqual(expect.objectContaining({ status: 'cancelled', by: 'client', note: 'Seyahat' })));
    expect(await screen.findByText('danışan istedi')).toBeTruthy();
  });
});

describe("the client's own page, seen from the panel", () => {
  it('the link goes by e-mail as the owner edits it; what the client asked for shows on their page and in the list', async () => {
    const day = (n: number) => new Date(Date.now() + 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
    const weekday = new Date(`${day(3)}T12:00:00Z`).getUTCDay();
    const asked = client({ weekday, since: day(3), sessions: [{ day: day(3), time: '10:00', kind: 'weekly', minutes: 50, status: 'cancelled', by: 'client', late: true, note: 'Hastayım' }], endAsked: { at: Date.now(), note: 'İyiyim' } });
    const { api } = setup('client:c1', [], [asked]);
    expect(await screen.findByText('24 saatten az kala · tam ücret')).toBeTruthy();
    expect(screen.getByText('Hastayım')).toBeTruthy();
    expect(screen.getByText(/terapiyi sonlandırmak istediğini bildirdi/)).toBeTruthy();
    expect(screen.getByText('Notu: İyiyim')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bağlantıyı gönder' }));
    const dialog = await screen.findByRole('dialog');
    const body = within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement;
    expect(body.value).toMatch(/https:\/\/klinikterapist\.com\/randevum\/#k=c1\./);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gönder' }));
    await waitFor(() => expect(api.state.sent).toContainEqual(expect.objectContaining({ to: 'osman@example.com', subject: 'Randevu sayfanız – klinikterapist.com' })));
    expect(await screen.findByText(/danışana e-postayla gönderildi/)).toBeTruthy();
    cleanup();
    setup('tracking', [], [asked]);
    await row('KT007OGO');
    expect(screen.queryByText('Sonlandırmak istiyor')).toBeNull();
  });
});

describe('Faz 1: payments on the client’s page', () => {
  it('Ödendi sends the thank-you (or not) and marks the session; Ödeme hatırlat sends the reminder with the fee', async () => {
    const day = (n: number) => new Date(Date.now() + 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
    const weekday = new Date(`${day(3)}T12:00:00Z`).getUTCDay();
    const { api } = setup('client:c1', [], [client({ weekday, since: day(3) })]);
    api.state.payment = { year: 2026, fees: { individual: 1500, couple: 0, accessible: 0 }, bank: 'TR00 ÖRNEK', link: '', dueHours: 24 };
    const next = (await screen.findByRole('heading', { name: /Sıradaki seanslar/ })).parentElement!;
    const first = () => within(next).getAllByRole('listitem')[0];
    expect(first().textContent).toContain('Ödenmedi');
    fireEvent.click(within(first()).getByRole('button', { name: 'Ödeme hatırlat' }));
    let dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('Seans ücreti: 1.500 TL.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gönder' }));
    await waitFor(() => expect(api.state.sent).toContainEqual(expect.objectContaining({ to: 'osman@example.com', subject: 'Seans ödemesi hatırlatması – klinikterapist.com' })));
    fireEvent.click(within(first()).getByRole('button', { name: 'Ödendi' }));
    dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('ödemesi alınmıştır. Teşekkür ederim.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşaretle ve gönder' }));
    await waitFor(() => expect(api.state.clients[0].sessions).toContainEqual(expect.objectContaining({ day: day(3), paid: expect.any(Number) })));
    expect(api.state.sent.at(-1)).toMatchObject({ subject: 'Ödemeniz alındı – klinikterapist.com' });
    expect(await within(next).findByText(/^Ödendi · /)).toBeTruthy();
    // Only marking: no e-mail.
    const sent = api.state.sent.length;
    const second = within(next).getAllByRole('listitem')[1];
    fireEvent.click(within(second).getByRole('button', { name: 'Ödendi' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yalnızca işaretle' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'İşaretle' }));
    await waitFor(() => expect(api.state.clients[0].sessions?.filter((x) => x.paid)).toHaveLength(2));
    expect(api.state.sent).toHaveLength(sent);
  });
});
