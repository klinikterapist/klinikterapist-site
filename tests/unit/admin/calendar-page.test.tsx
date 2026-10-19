// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CalendarPage } from '../../../src/admin/ui/CalendarPage';
import { Panel, parseRoute } from '../../../src/admin/ui/context';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';

afterEach(() => {
  cleanup();
  location.hash = '';
});

function setup(add: { day: string; time: string; type: string } | null = null) {
  const api = createMockApi({ seed: {} });
  render(
    <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' }, store: createSessionStore(localStorage) }}>
      <CalendarPage add={add} />
    </Panel.Provider>,
  );
  return api;
}

describe('Randevu takvimi', () => {
  it('the request e-mail link opens the screen with the time to put in the calendar', () => {
    expect(parseRoute('#/randevular?ekle=2026-10-22T19:20&tur=couple')).toEqual({ name: 'calendar', add: { day: '2026-10-22', time: '19:20', type: 'couple' } });
    expect(parseRoute('#/randevular')).toEqual({ name: 'calendar', add: null });
    expect(parseRoute('#/randevular?ekle=yarın')).toEqual({ name: 'calendar', add: null });
  });

  it('"Takvime işle" confirms it; the row shows its time, kind and "Onaylı"', async () => {
    const api = setup({ day: '2026-10-22', time: '19:20', type: 'couple' });
    const box = screen.getByRole('region', { name: 'Takvime işlenecek randevu' });
    expect(box.textContent).toContain('22 Ekim 2026, Perşembe, 19.20 · Çift terapisi (60 dk)');
    fireEvent.click(within(box).getByRole('button', { name: 'Takvime işle' }));
    await waitFor(() => expect(api.state.calendar).toHaveLength(1));
    expect(api.state.calendar[0]).toMatchObject({ status: 'confirmed', minutes: 60, kind: 'session', type: 'couple', start: Date.parse('2026-10-22T19:20:00+03:00') });
    expect(await screen.findByText('19.20–20.20')).toBeTruthy();
    expect(screen.getByText('Onaylı')).toBeTruthy();
    expect(location.hash).toBe('#/randevular');
  });

  it('adds one by hand from the template times of the chosen day, and deletes it after asking', async () => {
    const api = setup();
    await screen.findByText('Önümüzdeki günlerde dolu saat yok.');
    fireEvent.change(screen.getByLabelText('Tarih'), { target: { value: '2026-10-23' } });
    const time = screen.getByLabelText('Saat') as HTMLSelectElement;
    expect([...time.options].map((o) => o.value)).toContain('19:50');
    fireEvent.change(time, { target: { value: '19:50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ekle' }));
    await waitFor(() => expect(api.state.calendar).toHaveLength(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Sil' }));
    const dialog = screen.getByRole('dialog', { name: 'Randevu silinsin mi?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sil' }));
    await waitFor(() => expect(api.state.calendar).toHaveLength(0));
  });

  it('a public holiday has no times to choose', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Tarih'), { target: { value: '2026-10-29' } });
    expect([...(screen.getByLabelText('Saat') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Bu gün kapalı']);
  });
});
