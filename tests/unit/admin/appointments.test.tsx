// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AppointmentsPage } from '../../../src/admin/ui/appointments/AppointmentsPage';
import { Panel, parseRoute, type AppointmentsTab } from '../../../src/admin/ui/context';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';
import { decisionMail } from '../../../src/admin/lib/booking-mail';
import type { BookingRequest } from '../../../src/admin/api/types';

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

function setup(tab: AppointmentsTab = 'requests', requests: BookingRequest[] = [session, intro]) {
  const api = createMockApi({ seed: {} });
  api.state.requests.push(...requests.map((r) => ({ ...r })));
  api.state.calendar.push(...requests.map((r) => ({ id: r.holdId, start: Date.parse(`${r.day}T${r.time}:00+03:00`), minutes: 50, kind: r.kind, status: 'hold' as const, holdUntil: Date.now() + 864e5 })));
  const view = render(
    <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' }, store: createSessionStore(localStorage) }}>
      <AppointmentsPage tab={tab} add={null} />
    </Panel.Provider>,
  );
  const rerender = (t: AppointmentsTab) =>
    view.rerender(
      <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' }, store: createSessionStore(localStorage) }}>
        <AppointmentsPage tab={t} add={null} />
      </Panel.Provider>,
    );
  return { api, rerender };
}

const card = async (title: RegExp) => (await screen.findByText(title)).closest('li') as HTMLElement;

describe('Randevular routes', () => {
  it('Talepler, Takvim and Danışanlar; the old ?ekle link opens Takvim', () => {
    expect(parseRoute('#/randevular')).toEqual({ name: 'calendar', tab: 'requests', add: null });
    expect(parseRoute('#/randevular/takvim')).toEqual({ name: 'calendar', tab: 'calendar', add: null });
    expect(parseRoute('#/randevular/danisanlar')).toEqual({ name: 'calendar', tab: 'clients', add: null });
    expect(parseRoute('#/randevular?ekle=2026-10-22T19:20&tur=couple')).toEqual({ name: 'calendar', tab: 'calendar', add: { day: '2026-10-22', time: '19:20', type: 'couple' } });
  });
});

describe('ready e-mails', () => {
  it('are personal: name, date, time and what was asked; intro approval names the topics', () => {
    const a = decisionMail(session, 'approve');
    expect(a.subject).toBe('Randevunuz onaylandı – klinikterapist.com');
    expect(a.body).toContain('Sayın Ayşe Yılmaz,');
    expect(a.body).toContain('22 Ekim 2026, Perşembe, saat 19.20 için çift terapisi randevu talebiniz onaylanmıştır.');
    const i = decisionMail(intro, 'approve');
    expect(i.body).toContain('ücretsiz ön görüşme talebiniz onaylanmıştır');
    expect(i.body).toContain('şu konuları konuşmak istediğinizi belirttiniz: Kaygı ve stres, Uyku');
    const u = decisionMail(session, 'unavailable');
    expect(u.body).toContain('Ne yazık ki bu saatte uygun değilim.');
    expect(u.body).toContain('https://klinikterapist.com/randevu/');
    expect(decisionMail({ ...intro, lang: 'en' }, 'cancel').body).toContain('https://klinikterapist.com/en/intro-call/');
  });
});

describe('Talepler', () => {
  it('shows each request with its details and the three buttons', async () => {
    setup();
    const c = await card(/Randevu talebi · Çift terapisi/);
    expect(c.textContent).toContain('22 Ekim 2026, Perşembe, 19.20');
    expect(c.textContent).toContain('ayse@example.com');
    expect(c.textContent).toContain('Akşam daha uygun.');
    for (const name of ['Onayla', 'Uygun değilim', 'İptal et']) expect(within(c).getByRole('button', { name })).toBeTruthy();
    const i = await card(/Ücretsiz ön görüşme talebi/);
    expect(i.textContent).toContain('Kaygı ve stres, Uyku');
  });

  it('Onayla opens the ready e-mail for editing; the edited text is what goes, and the time is confirmed', async () => {
    const { api } = setup();
    fireEvent.click(within(await card(/Randevu talebi/)).getByRole('button', { name: 'Onayla' }));
    const dialog = screen.getByRole('dialog', { name: 'Onay e-postası' });
    const body = within(dialog).getByLabelText('E-posta metni') as HTMLTextAreaElement;
    expect(body.value).toContain('Sayın Ayşe Yılmaz,');
    fireEvent.change(body, { target: { value: `${body.value}\n\nNot: İlk seanstan önce kısa bir form göndereceğim.` } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Onayla ve gönder' }));
    await waitFor(() => expect(api.state.sent).toHaveLength(1));
    expect(api.state.sent[0]).toMatchObject({ to: 'ayse@example.com', subject: 'Randevunuz onaylandı – klinikterapist.com' });
    expect(api.state.sent[0].body).toContain('kısa bir form');
    expect(api.state.calendar.find((e) => e.status === 'confirmed')).toMatchObject({ minutes: 60, type: 'couple' });
    expect(api.state.calendar.some((e) => e.id === 'h1')).toBe(false);
    expect(await screen.findByText('Onaylananlar (1)')).toBeTruthy();
  });

  it('Uygun değilim sends the e-mail, frees the time and deletes the request with its details', async () => {
    const { api } = setup();
    fireEvent.click(within(await card(/Randevu talebi/)).getByRole('button', { name: 'Uygun değilim' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Uygun değilim ve gönder' }));
    await waitFor(() => expect(api.state.requests.map((r) => r.id)).toEqual(['r2']));
    expect(api.state.calendar.some((e) => e.id === 'h1')).toBe(false);
    expect(api.state.sent[0].body).toContain('uygun değilim');
  });

  it('a booking moves to Randevu takibi with its own weekday and time; its details are deleted', async () => {
    const { api } = setup('requests', [{ ...session, status: 'approved', calendarId: 'c1' }]);
    fireEvent.click(within(await card(/Randevu talebi/)).getByRole('button', { name: 'Randevu takibine geçir' }));
    const dialog = screen.getByRole('dialog', { name: 'Randevu takibine geçir' });
    expect(dialog.textContent).toContain('her perşembe 19.20');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Takibe geçir' }));
    await waitFor(() => expect(api.state.clients).toHaveLength(1));
    expect(api.state.clients[0]).toMatchObject({ number: 'D-001', weekday: 4, time: '19:20', type: 'couple', minutes: 60, since: '2026-10-22' });
    expect(JSON.stringify(api.state.clients)).not.toMatch(/Ayşe|ayse|0532/);
    expect(api.state.requests).toHaveLength(0);
    expect(location.hash).toBe('#/randevular/danisanlar');
  });

  it('an intro call asks for the weekly day and time before moving', async () => {
    const { api } = setup('requests', [{ ...intro, status: 'approved', calendarId: 'c2' }]);
    fireEvent.click(within(await card(/Ücretsiz ön görüşme talebi/)).getByRole('button', { name: 'Randevu takibine geçir' }));
    const dialog = screen.getByRole('dialog', { name: 'Randevu takibine geçir' });
    const go = within(dialog).getByRole('button', { name: 'Takibe geçir' }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Gün'), { target: { value: '3' } });
    fireEvent.change(within(dialog).getByLabelText('Saat'), { target: { value: '19:50' } });
    fireEvent.click(go);
    await waitFor(() => expect(api.state.clients).toHaveLength(1));
    expect(api.state.clients[0]).toMatchObject({ weekday: 3, time: '19:50', type: 'individual' });
  });
});

describe('Danışanlar and Takvim', () => {
  it('lists clients by number and ends one after asking', async () => {
    const again = setup('calendar', []);
    again.api.state.clients.push({ id: 'c1', number: 'D-007', type: 'individual', weekday: 2, time: '10:00', minutes: 50, since: '2026-10-20' });
    again.rerender('clients');
    const row = (await screen.findByText('D-007')).closest('li') as HTMLElement;
    expect(row.textContent).toContain('Her salı 10.00 · Bireysel terapi (50 dk)');
    fireEvent.click(within(row).getByRole('button', { name: 'Terapi sona erdi' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Takipten çıkar' }));
    await waitFor(() => expect(again.api.state.clients).toHaveLength(0));
  });

  it('the month shows the occupancy of each day, counting weekly sessions, and the holidays', async () => {
    const { api, rerender } = setup('clients', []);
    api.state.clients.push({ id: 'c1', number: 'D-001', type: 'individual', weekday: 4, time: '19:20', minutes: 50, since: '2026-10-01' });
    rerender('calendar');
    // Thursdays: 19:20 holds 19:00, 19:20, 19:50, 20:20 of the 12 times → %33.
    const thursday = await screen.findByRole('button', { name: /22 Ekim 2026, Perşembe, %33 dolu/ });
    fireEvent.click(thursday);
    expect(screen.getByText('Haftalık seans · D-001')).toBeTruthy();
    expect(screen.getByRole('button', { name: /29 Ekim 2026, Perşembe, Cumhuriyet Bayramı/ }).className).toContain('is-holiday');
    expect(screen.getByText('29 Ekim: Cumhuriyet Bayramı (kapalı)')).toBeTruthy();
  });
});
