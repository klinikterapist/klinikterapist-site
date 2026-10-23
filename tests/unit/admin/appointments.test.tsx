// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RequestsPage } from '../../../src/admin/ui/appointments/RequestsPage';
import { TrackingPage } from '../../../src/admin/ui/appointments/TrackingPage';
import { ClientPage } from '../../../src/admin/ui/appointments/ClientPage';
import { ProfilePage } from '../../../src/admin/ui/appointments/ProfilePage';
import { NotificationsPage } from '../../../src/admin/ui/appointments/NotificationsPage';
import { MailboxesCard } from '../../../src/admin/ui/appointments/MailboxesCard';
import { OnemliScreen } from '../../../src/admin/ui/settings/screens/important';
import { CloseHours } from '../../../src/admin/ui/settings/screens/booking';
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

function setup(page: 'requests' | 'tracking' | 'profile' | 'notifications' | 'mailboxes' | 'important' | 'close' | `client:${string}`, requests: BookingRequest[] = [session, intro], clients: (Client & { origin?: BookingRequest })[] = []) {
  const api = createMockApi({ seed: {} });
  api.state.requests.push(...requests.map((r) => ({ ...r })));
  api.state.calendar.push(
    ...requests.filter((r) => r.status === 'pending').map((r) => ({ id: r.holdId, start: Date.parse(`${r.day}T${r.time}:00+03:00`), minutes: 50, kind: r.kind, status: 'hold' as const, holdUntil: Date.now() + 864e5 })),
  );
  api.state.clients.push(...clients);
  render(
    <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x' }, store: createSessionStore(localStorage) }}>
      {page === 'requests' ? <RequestsPage add={null} /> : page === 'tracking' ? <TrackingPage /> : page === 'profile' ? <ProfilePage /> : page === 'notifications' ? <NotificationsPage /> : page === 'mailboxes' ? <MailboxesCard /> : page === 'important' ? <OnemliScreen /> : page === 'close' ? <CloseHours /> : <ClientPage id={page.slice(7)} />}
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
    expect(a.body).toContain('22 Ekim 2026, Perşembe, saat 19.20 için gönderdiğiniz randevu talebiniz onaylandı.');
    expect(a.body).toContain('– Seans türü: Aile ve çift terapisi');
    expect(a.body).toContain('→ Aydınlatma metnini oku: https://klinikterapist.com/aydinlatma-metni/');
    expect(a.body).toMatch(/Saygılarımla,\nOsman Güneş Özkurt\nKlinik Psikolog\nklinikterapist\.com$/);
    expect(decisionMail(intro, 'approve').body).toContain('konuları konuşmak istediğinizi belirttiniz:\n\n– Kaygı ve stres\n– Uyku');
    const u = decisionMail(session, 'unavailable');
    expect(u.body).toContain('Ne yazık ki bu tarih ve saatte uygun olmadığım için talebinizi onaylayamıyorum.');
    expect(u.body).toContain('https://klinikterapist.com/randevu/');
    expect(decisionMail({ ...intro, lang: 'en' }, 'cancel').body).toContain('https://klinikterapist.com/en/intro-call/');
  });

  it('ending therapy, the closing session and the apology', () => {
    const c = { name: 'Ayşe Yılmaz', lang: 'tr' as const };
    expect(endMail(c, 'complete').body).toContain('terapi sürecinin sona erdiğini');
    const closing = endMail(c, 'closing').body;
    expect(closing).toContain('ücretsiz, 25–30 dakikalık bir sonlandırma görüşmesi');
    expect(closing).toContain('Sonlandırma görüşmesi terapi sürecinin önemli bir parçasıdır.');
    const sorry = revertMail(c).body;
    expect(sorry).toContain('teknik bir sorun nedeniyle yanlışlıkla gönderildi');
    expect(sorry).toContain('ayrı bir e-postayla göndereceğim');
    expect(endMail({ ...c, lang: 'en' }, 'closing').subject).toBe('A closing session for our therapy – klinikterapist.com');
  });
});

describe('Randevu talepleri', () => {
  it('lists the newest active request first and the approved ones by appointment date (owner’s note 2026-10-22)', async () => {
    const t = Date.now();
    const old = { ...session, id: 'a', name: 'Eski Talep', createdAt: t - 3 * 864e5, holdId: 'ha' };
    const fresh = { ...session, id: 'b', name: 'Yeni Talep', createdAt: t - 1000, holdId: 'hb' };
    const mid = { ...intro, id: 'c', name: 'Orta Talep', createdAt: t - 864e5, holdId: 'hc' };
    const late = { ...session, id: 'd', name: 'Geç Onay', status: 'approved' as const, day: '2026-11-20', time: '10:00', createdAt: t - 5 * 864e5, holdId: 'hd' };
    const soon = { ...session, id: 'e', name: 'Yakın Onay', status: 'approved' as const, day: '2026-11-02', time: '18:00', createdAt: t - 1000, holdId: 'he' };
    setup('requests', [old, fresh, late, mid, soon]);
    await card('Yeni Talep');
    const names = () => [...document.querySelectorAll('.rq-list .rq-who b')].map((b) => b.textContent);
    expect(names()).toEqual(['Yeni Talep', 'Orta Talep', 'Eski Talep']);
    fireEvent.click(screen.getByRole('button', { name: /Onaylanan/ }));
    await card('Yakın Onay');
    expect(names()).toEqual(['Yakın Onay', 'Geç Onay']);
  });

  it('shows each request with its details and the three buttons, beside the calendar', async () => {
    setup('requests');
    const c = await card('Ayşe Yılmaz');
    // The kind in its own box beside the date; the session type under the name, no e-mail there.
    expect(c.querySelector('.rq-kindbox')!.textContent).toBe('SeansRandevusu');
    expect(c.querySelector('.rq-who')!.textContent).toBe('Ayşe YılmazAile ve çift terapisi · 60 dakika');
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
    // The weekly plan goes by e-mail, open for editing (owner's note 2026-10-23).
    const body = (within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value;
    expect(body).toContain('– Seans günü ve saati: Her perşembe, 19.20 (Türkiye saati)');
    expect(body).toContain('– Seans türü: Aile ve çift terapisi');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Takibe geçir ve gönder' }));
    await waitFor(() => expect(api.state.clients).toHaveLength(1));
    expect(api.state.clients[0]).toMatchObject({ number: 'KT001AY', weekday: 4, time: '19:20', status: 'active', contact: { email: 'ayse@example.com' } });
    expect(api.state.requests).toHaveLength(0);
    expect(api.state.sent).toEqual([expect.objectContaining({ to: 'ayse@example.com', subject: 'Haftalık seanslarımız planlandı – klinikterapist.com' })]);
    expect(await screen.findByText(/KT001AY numarasıyla Seans takibe alındı/)).toBeTruthy();
  });

  it('an intro call asks for the first session’s date and time; the weekday follows the date, the calendar shows what is taken', async () => {
    const { api } = setup('requests', [{ ...intro, status: 'approved', calendarId: 'c2' }]);
    fireEvent.click(screen.getByRole('button', { name: /Onaylanan/ }));
    fireEvent.click(within(await card('Ali Kaya')).getByRole('button', { name: 'Seans takibe geçir' }));
    let dialog = screen.getByRole('dialog', { name: 'Seans takibe geçir' });
    expect(within(dialog).queryByLabelText('Gün')).toBeNull();
    expect(within(dialog).getByText('Ortak takvim: dolu gün ve saatler')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yalnızca takibe geçir' }));
    dialog = screen.getByRole('dialog', { name: 'Seans takibe geçir' });
    const go = within(dialog).getByRole('button', { name: 'Takibe geçir' }) as HTMLButtonElement;
    // The next Wednesday from tomorrow on; 11:00 is open even on a bayram eve (closed from 13:00).
    const d = new Date(Date.now() + 3 * 3600e3 + 864e5);
    while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
    const wednesday = d.toISOString().slice(0, 10);
    fireEvent.change(within(dialog).getByLabelText('İlk seans tarihi'), { target: { value: wednesday } });
    expect(go.disabled).toBe(true);
    expect(dialog.textContent).toContain('Haftalık seans günü: Çarşamba');
    fireEvent.change(within(dialog).getByLabelText('Saat'), { target: { value: '11:00' } });
    fireEvent.click(go);
    await waitFor(() => expect(api.state.clients).toHaveLength(1));
    expect(api.state.clients[0]).toMatchObject({ number: 'KT001AK', weekday: 3, time: '11:00', since: wednesday, type: 'individual' });
    expect(api.state.sent).toHaveLength(0);
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
    fireEvent.click(await screen.findByRole('button', { name: 'Sonlandırma' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Terapiyi sonlandır' }));
    const dialog = screen.getByRole('dialog', { name: 'KT007OGO: terapiyi sonlandır' });
    expect(dialog.textContent).toContain('osman@example.com');
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('Sayın Osman Güneş Özkurt,');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gönder ve takipten çıkar' }));
    await waitFor(() => expect(api.state.clients).toHaveLength(0));
    expect(api.state.sent[0]).toMatchObject({ to: 'osman@example.com', subject: 'Terapi sürecimiz tamamlandı – klinikterapist.com' });
    expect(await screen.findByText(/Seans takipten çıkarıldı/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Danışanlara dön' })).toBeTruthy();
  });

  it('Sonlandırma görüşmesi talep et sends the invitation and keeps the client, marked; the list shows them in the closing stage', async () => {
    const { api } = setup('client:c1', [], [client()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Sonlandırma' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Terapiyi sonlandır' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sonlandırma görüşmesi talep et' }));
    // The invitation carries the client's page and the last day to pick a time (owner's decisions 2026-10-22).
    await waitFor(() => expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('→ Görüşme saatini seç: '));
    const body = (within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value;
    expect(body).toContain('sonlandırma görüşmesi');
    expect(body).toMatch(/→ Görüşme saatini seç: \S+\/randevum\/#k=/);
    expect(body).not.toContain('yanıtlayarak bana yazabilirsiniz');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Daveti gönder' }));
    await waitFor(() => expect(api.state.clients[0].status).toBe('closing'));
    expect(api.state.clients[0].closingAsk).toEqual(expect.objectContaining({ until: expect.any(Number) }));
    expect(await screen.findByText('Sonlandırma görüşmesi bekleniyor')).toBeTruthy();
    expect(screen.getByText(/kendi randevu sayfasından seçebilir/)).toBeTruthy();
    cleanup();
    setup('tracking', [], [{ ...client(), status: 'closing' }]);
    expect(await screen.findByText('Sonlandırma aşamasında (1)')).toBeTruthy();
  });

  it('Geri al sends the apology and the person is back in Randevu talepleri', async () => {
    const { api } = setup('client:c1', [], [{ ...client(), origin: { ...session, day: '2030-01-03' } }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Diğer işlemler' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Geri al' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Gönder ve geri al' }));
    await waitFor(() => expect(api.state.clients).toHaveLength(0));
    expect(api.state.requests).toEqual([expect.objectContaining({ status: 'pending', name: 'Ayşe Yılmaz' })]);
    expect(api.state.calendar.some((e) => e.status === 'hold')).toBe(true);
    expect(api.state.sent[0].body).toContain('teknik bir sorun');
    expect(await screen.findByRole('link', { name: 'Randevu taleplerine git →' })).toBeTruthy();
  });

  it('Sil removes the client with no e-mail', async () => {
    const { api } = setup('client:c1', [], [client()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Diğer işlemler' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sil' }));
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

  it('Önemli Ayarlar: each language closes and opens on its own, after asking; Randevu Talepleri shows the state', async () => {
    const { api } = setup('important', []);
    const tr = (await screen.findByText('Türkçe randevu alımı')).closest('.danger-row') as HTMLElement;
    const en = screen.getByText('İngilizce randevu alımı').closest('.danger-row') as HTMLElement;
    expect(en.textContent).toContain('Kapalı');
    fireEvent.click(within(tr).getByRole('button', { name: 'Kapat' }));
    const dialog = screen.getByRole('dialog', { name: 'Türkçe randevu alımı kapatılsın mı?' });
    expect(dialog.textContent).toContain('Gelmiş talepler, onaylı randevular');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Randevu alımını kapat' }));
    await waitFor(() => expect(api.state.open).toEqual({ tr: false, en: false }));
    expect(await screen.findByText(/Türkçe randevu alımı kapatıldı/)).toBeTruthy();
    fireEvent.click(within(en).getByRole('button', { name: 'Aç' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'İngilizce randevu alımı açılsın mı?' })).getByRole('button', { name: 'Randevu alımını aç' }));
    await waitFor(() => expect(api.state.open).toEqual({ tr: false, en: true }));
  });

  it('Randevu Talepleri: the state of both languages, as a link to Önemli Ayarlar', async () => {
    setup('requests', []);
    const link = await screen.findByRole('link', { name: 'Randevu alımı: Türkçe açık · İngilizce kapalı' });
    expect(link.getAttribute('href')).toBe('#/ayarlar/onemli');
    expect(screen.queryByRole('button', { name: 'Randevu alımını kapat' })).toBeNull();
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
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('– Tarih: 22 Ekim 2026, Perşembe\n– Saat: 19.20');
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
    // The weekly time, the type, when therapy began and the e-mail address (owner's review 2026-10-23,
    // item 21); no name or language.
    const page = document.body.textContent!;
    expect(page).toContain('Terapiye başlangıç');
    expect(page).toContain('Görüşme türü');
    expect(page).toContain('osman@example.com');
    expect(page).not.toMatch(/Osman|Konuşma dili/);
    expect(screen.getByRole('img', { name: /İşaretlenmedi %100/ })).toBeTruthy();
    expect(screen.getAllByText(/1\. seans/).length).toBeGreaterThan(0);
    const past = screen.getByRole('heading', { name: /Geçmiş seanslar/ }).parentElement!;
    const rows = within(past).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Katıldı' }));
    await waitFor(() => expect(api.state.clients[0].sessions).toContainEqual(expect.objectContaining({ day: day(-13), status: 'attended' })));
    const next = screen.getByRole('heading', { name: /Sıradaki seanslar/ }).parentElement!;
    fireEvent.click(within(within(next).getAllByRole('listitem')[0]).getByRole('button', { name: /diğer işlemler/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'İptal' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Not (isteğe bağlı, yalnızca panelde görünür)'), { target: { value: 'Seyahat' } });
    // Owner's note 2026-10-22: the client hears of it; the e-mail is shown for editing first.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Devam: e-postayı gör' }));
    const mail = await screen.findByRole('dialog');
    const body = within(mail).getByLabelText('E-posta metni') as HTMLTextAreaElement;
    expect(body.value).toContain('İsteğiniz üzerine aşağıdaki seansınız iptal edildi.');
    // The panel's own note stays in the panel.
    expect(body.value).not.toContain('Seyahat');
    fireEvent.click(within(mail).getByRole('button', { name: 'Kaydet ve gönder' }));
    await waitFor(() => expect(api.state.clients[0].sessions).toContainEqual(expect.objectContaining({ status: 'cancelled', by: 'client', note: 'Seyahat' })));
    await waitFor(() => expect(api.state.sent).toContainEqual(expect.objectContaining({ to: 'osman@example.com', subject: 'Seansınız iptal edildi – klinikterapist.com' })));
    expect(await screen.findByText(/Danışana e-posta gönderildi/)).toBeTruthy();
    expect(await screen.findByText('danışan istedi')).toBeTruthy();
  });

  it('a session moved by the owner tells the client the new time; "Yalnızca kaydet" sends nothing (owner’s note 2026-10-22)', async () => {
    const day = (n: number) => new Date(Date.now() + 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
    const weekday = new Date(`${day(2)}T12:00:00Z`).getUTCDay();
    const { api } = setup('client:c1', [], [client({ weekday, time: '10:00', since: day(2) })]);
    await screen.findByText('KT007OGO');
    const next = () => screen.getByRole('heading', { name: /Sıradaki seanslar/ }).parentElement!;
    fireEvent.click(within(within(next()).getAllByRole('listitem')[0]).getByRole('button', { name: /diğer işlemler/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ertele' }));
    let dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ben erteledim' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Devam: e-postayı gör' }));
    dialog = await screen.findByRole('dialog');
    const body = (within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value;
    expect(body).toContain('ertelemek durumunda kaldığımı');
    expect(body).toContain('Yeni tarihi ve saati en kısa sürede sizinle birlikte belirleyeceğiz.');
    // Back to the first step, then save without an e-mail.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yalnızca kaydet' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(api.state.clients[0].sessions).toContainEqual(expect.objectContaining({ status: 'postponed', by: 'owner' })));
    expect(api.state.sent).toHaveLength(0);
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
    await waitFor(() => expect(api.state.sent).toContainEqual(expect.objectContaining({ to: 'osman@example.com', subject: 'Randevu sayfanızın bağlantısı – klinikterapist.com' })));
    expect(await screen.findByText(/danışana e-postayla gönderildi/)).toBeTruthy();
    cleanup();
    setup('tracking', [], [asked]);
    await row('KT007OGO');
    expect(screen.queryByText('Sonlandırmak istiyor')).toBeNull();
  });
});

describe('Faz 1: payments on the client’s page', () => {
  it('"Ödeme alındı" sends the thank-you (or not) and marks the session; Ödeme hatırlat sends the reminder with the fee', async () => {
    const day = (n: number) => new Date(Date.now() + 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
    const weekday = new Date(`${day(3)}T12:00:00Z`).getUTCDay();
    const { api } = setup('client:c1', [], [client({ weekday, since: day(3) })]);
    api.state.payment = { year: 2026, fees: { individual: 1500, couple: 0, accessible: 0 }, bank: 'TR00 ÖRNEK', holder: '', bankName: '', iban: '', link: '', dueHours: 24 };
    const next = (await screen.findByRole('heading', { name: /Sıradaki seanslar/ })).parentElement!;
    const first = () => within(next).getAllByRole('listitem')[0];
    // Owner's note 2026-10-22: the payment is a state of its own, with the amount; the step is a verb.
    expect(first().querySelector('.ss-chip.is-due')!.textContent).toBe('Ödeme bekleniyor · 1.500 TLÖdeme alındı');
    expect(first().querySelector('.ss-status')!.textContent).toBe('Planlandı');
    fireEvent.click(within(first()).getByRole('button', { name: /diğer işlemler/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ödeme hatırlat' }));
    let dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('– Seans ücreti: 1.500 TL');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gönder' }));
    await waitFor(() => expect(api.state.sent).toContainEqual(expect.objectContaining({ to: 'osman@example.com', subject: 'Seans ödemesi hatırlatması – klinikterapist.com' })));
    fireEvent.click(within(first()).getByRole('button', { name: 'Ödeme alındı' }));
    dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('yaptığınız ödeme bana ulaştı.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'İşaretle ve gönder' }));
    await waitFor(() => expect(api.state.clients[0].sessions).toContainEqual(expect.objectContaining({ day: day(3), paid: expect.any(Number) })));
    expect(api.state.sent.at(-1)).toMatchObject({ subject: 'Seans ödemeniz alındı – klinikterapist.com' });
    expect(await within(next).findByText(/^Ödeme alındı · /)).toBeTruthy();
    // Only marking: no e-mail.
    const sent = api.state.sent.length;
    const second = within(next).getAllByRole('listitem')[1];
    fireEvent.click(within(second).getByRole('button', { name: 'Ödeme alındı' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yalnızca işaretle' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'İşaretle' }));
    await waitFor(() => expect(api.state.clients[0].sessions?.filter((x) => x.paid)).toHaveLength(2));
    expect(api.state.sent).toHaveLength(sent);
  });

  it('a client’s own fee: set, shown in the rows and the reminder, and back to the standard fee (owner’s note 2026-10-22)', async () => {
    const day = (n: number) => new Date(Date.now() + 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
    const weekday = new Date(`${day(3)}T12:00:00Z`).getUTCDay();
    const { api } = setup('client:c1', [], [client({ weekday, since: day(3) })]);
    api.state.payment = { year: 2026, fees: { individual: 1500, couple: 0, accessible: 0 }, bank: 'TR00 ÖRNEK', holder: '', bankName: '', iban: '', link: '', dueHours: 24 };
    const next = (await screen.findByRole('heading', { name: /Sıradaki seanslar/ })).parentElement!;
    await within(next).findAllByText(/1\.500 TL/);
    expect(screen.getByText('görüşme türünün standart ücreti')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Özel ücret belirle' }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Bu danışana özel ücret (TL)'), { target: { value: '1750' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(api.state.clients[0].fee).toBe(1750));
    expect(await screen.findByText('bu danışana özel')).toBeTruthy();
    const first = within(next).getAllByRole('listitem')[0];
    expect(first.querySelector('.ss-chip.is-due')!.textContent).toContain('1.750 TL');
    fireEvent.click(within(first).getByRole('button', { name: /diğer işlemler/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ödeme hatırlat' }));
    dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('– Seans ücreti: 1.750 TL');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Değiştir' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Standart ücrete dön' }));
    await waitFor(() => expect(api.state.clients[0]).not.toHaveProperty('fee'));
  });
});

describe('Faz 2: Terapist profili, Bildirimler, Saat kapat', () => {
  const day = (n: number) => new Date(Date.now() + 3 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
  const weekdayIn = (n: number) => new Date(`${day(n)}T12:00:00Z`).getUTCDay();

  it('routes: #/profil and #/bildirimler', () => {
    expect(parseRoute('#/profil')).toEqual({ name: 'profile' });
    expect(parseRoute('#/bildirimler')).toEqual({ name: 'notifications' });
  });

  it('Terapist profili: the numbers, the next sessions and the waiting requests', async () => {
    setup('profile', [session], [client({ weekday: weekdayIn(2), since: day(-20) })]);
    expect(await screen.findByText('Aktif danışan')).toBeTruthy();
    const next = screen.getByRole('heading', { name: /Yaklaşan seanslar/ }).parentElement!;
    expect(within(next).getAllByText('KT007OGO').length).toBeGreaterThan(0);
    expect(screen.getByText(/Gelen talepler \(1\)/)).toBeTruthy();
    expect(screen.getByLabelText('Şu an')).toBeTruthy();
  });

  it('Bildirimler: unpaid and unmarked sessions need attention; the events are listed by day', async () => {
    const { api } = setup('notifications', [], [client({ weekday: weekdayIn(-6), since: day(-13), sessions: [{ day: day(-13), time: '10:00', kind: 'weekly', minutes: 50, status: 'attended' }] })]);
    api.state.events.push({ id: 'e1', at: Date.now() - 3600e3, kind: 'client', text: 'KT007OGO seansını iptal etti', link: '#/seans-takip/c1' });
    expect(await screen.findByText('KT007OGO: 1 seansın ödemesi işaretlenmedi')).toBeTruthy();
    expect(screen.getByText('KT007OGO: 1 geçmiş seans işaretlenmeyi bekliyor')).toBeTruthy();
    expect(screen.getByText('KT007OGO seansını iptal etti')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Ödemeler/ }));
    expect(screen.queryByText('KT007OGO seansını iptal etti')).toBeNull();
  });

  it('Saat kapat (Ayarlar › Randevu Ayarları since 2026-10-23) closes a whole day in the calendar', async () => {
    const { api } = setup('close', [], []);
    fireEvent.click(await screen.findByRole('button', { name: 'Saat kapat' }));
    const dialog = screen.getByRole('dialog', { name: 'Saat kapat' });
    fireEvent.change(within(dialog).getByLabelText('Gün'), { target: { value: day(3) } });
    fireEvent.change(within(dialog).getByLabelText('Not (isteğe bağlı, yalnızca siz görürsünüz)'), { target: { value: 'İzin' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kapat' }));
    await waitFor(() => expect(api.state.calendar).toEqual([expect.objectContaining({ status: 'closed', minutes: 1440, note: 'İzin' })]));
    expect(await screen.findByText(/bütün gün kapatıldı/)).toBeTruthy();
  });
});

describe('Faz 4: E-posta adresleri (Ayarlar › E-posta Ayarları since 2026-10-21)', () => {
  it('shows the owner’s address until set, refuses a sender Gmail does not have, saves, and sends a test', async () => {
    const { api } = setup('mailboxes', [], []);
    const box = (await screen.findByRole('heading', { name: 'E-posta adresleri' })).parentElement!;
    expect((await within(box).findAllByText('Ana adresiniz (merhaba@klinikterapist.com)')).length).toBe(5);
    expect(within(box).getByText('Bugün gönderilebilecek e-posta: 1500')).toBeTruthy();
    fireEvent.click(within(box).getByRole('button', { name: 'Düzenle' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Bildirimler'), { target: { value: 'bildirim@klinikterapist.com' } });
    fireEvent.change(within(dialog).getByLabelText('Randevu e-postaları'), { target: { value: 'baska@klinikterapist.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    expect(await within(dialog).findByText(/baska@klinikterapist.com Gmail'de/)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Randevu e-postaları'), { target: { value: 'randevu@klinikterapist.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kaydet' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.state.mailboxes).toEqual({ notify: 'bildirim@klinikterapist.com', booking: 'randevu@klinikterapist.com', info: '', contact: '', contactEn: '' });
    expect(within(box).getByText('randevu@klinikterapist.com')).toBeTruthy();
    fireEvent.click(within(box).getByRole('button', { name: 'Deneme gönder' }));
    expect(await within(box).findByText(/^2 deneme e-postası gönderildi/)).toBeTruthy();
  });
});

