// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RequestsPage } from '../../../src/admin/ui/appointments/RequestsPage';
import { TrackingPage } from '../../../src/admin/ui/appointments/TrackingPage';
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

function setup(page: 'requests' | 'tracking', requests: BookingRequest[] = [session, intro], clients: (Client & { origin?: BookingRequest })[] = []) {
  const api = createMockApi({ seed: {} });
  api.state.requests.push(...requests.map((r) => ({ ...r })));
  api.state.calendar.push(
    ...requests.filter((r) => r.status === 'pending').map((r) => ({ id: r.holdId, start: Date.parse(`${r.day}T${r.time}:00+03:00`), minutes: 50, kind: r.kind, status: 'hold' as const, holdUntil: Date.now() + 864e5 })),
  );
  api.state.clients.push(...clients);
  render(
    <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' }, store: createSessionStore(localStorage) }}>
      {page === 'requests' ? <RequestsPage add={null} /> : <TrackingPage />}
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
    expect(c.textContent).toContain('Randevu talebi · Çift terapisi');
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
  it('lists clients by number; Terapi tamamlandı sends the e-mail and removes the client', async () => {
    const { api } = setup('tracking', [], [client()]);
    const r = await row('KT007OGO');
    expect(r.textContent).toContain('Her salı 10.00 · Bireysel terapi (50 dk)');
    expect(r.textContent).not.toContain('Osman');
    fireEvent.click(within(r).getByRole('button', { name: 'Terapiyi sonlandır' }));
    const dialog = screen.getByRole('dialog', { name: 'KT007OGO: terapiyi sonlandır' });
    expect(dialog.textContent).toContain('osman@example.com');
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('Sayın Osman Güneş Özkurt,');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Gönder ve takipten çıkar' }));
    await waitFor(() => expect(api.state.clients).toHaveLength(0));
    expect(api.state.sent[0]).toMatchObject({ to: 'osman@example.com', subject: 'Terapi sürecimizin sonlanması – klinikterapist.com' });
  });

  it('Sonlandırma görüşmesi talep et sends the invitation and keeps the client, marked', async () => {
    const { api } = setup('tracking', [], [client()]);
    fireEvent.click(within(await row('KT007OGO')).getByRole('button', { name: 'Terapiyi sonlandır' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sonlandırma görüşmesi talep et' }));
    expect((within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement).value).toContain('sonlandırma görüşmesi');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Daveti gönder' }));
    await waitFor(() => expect(api.state.clients[0].status).toBe('closing'));
    expect(await screen.findByText('Sonlandırma görüşmesi bekleniyor')).toBeTruthy();
    expect(screen.getByText('Sonlandırma aşamasında (1)')).toBeTruthy();
  });

  it('Geri al sends the apology and the person is back in Randevu talepleri', async () => {
    const { api } = setup('tracking', [], [{ ...client(), origin: { ...session, day: '2030-01-03' } }]);
    fireEvent.click(within(await row('KT007OGO')).getByRole('button', { name: 'Geri al' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Gönder ve geri al' }));
    await waitFor(() => expect(api.state.clients).toHaveLength(0));
    expect(api.state.requests).toEqual([expect.objectContaining({ status: 'pending', name: 'Ayşe Yılmaz' })]);
    expect(api.state.calendar.some((e) => e.status === 'hold')).toBe(true);
    expect(api.state.sent[0].body).toContain('teknik bir sorun');
  });

  it('Sil removes the client with no e-mail', async () => {
    const { api } = setup('tracking', [], [client()]);
    fireEvent.click(within(await row('KT007OGO')).getByRole('button', { name: 'Sil' }));
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
