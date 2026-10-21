// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../../src/admin/ui/App';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';

afterEach(() => {
  cleanup();
  localStorage.clear();
  location.hash = '';
});

const config = { apiUrl: 'https://script.example/exec', googleClientId: 'cid', ownerEmail: 'merhaba@klinikterapist.com' };

describe('App', () => {
  it('without a session shows the sign-in screen', async () => {
    render(<App api={createMockApi()} store={createSessionStore(localStorage)} config={config} />);
    expect(await screen.findByRole('heading', { name: /Giriş/ })).toBeTruthy();
  });

  it('with a session shows the home dashboard, also for an unknown address', async () => {
    const store = createSessionStore(localStorage);
    store.set('s', Date.now() + 3600e3);
    location.hash = '#/boyle-bir-sayfa-yok';
    render(<App api={createMockApi()} store={store} config={config} />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Genel Bakış' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Panel menüsü' })).toBeTruthy();
  });

  it('signing in (mock backend) opens the panel', async () => {
    render(<App api={createMockApi()} store={createSessionStore(localStorage)} config={{ ...config, apiUrl: 'mock' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Deneme girişi/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Genel Bakış' })).toBeTruthy();
  });

  it('when the session ends, sign-in appears on top and the open screen keeps its edits (review I6)', async () => {
    const store = createSessionStore(localStorage);
    store.set('s', Date.now() + 3600e3);
    location.hash = '#/ayarlar/iletisim';
    render(<App api={createMockApi()} store={store} config={{ ...config, apiUrl: 'mock' }} />);
    const email = await screen.findByLabelText('E-posta adresi');
    fireEvent.change(email, { target: { value: 'yeni@klinikterapist.com' } });
    act(() => store.clear());
    expect(await screen.findByRole('heading', { name: /giriş/i })).toBeTruthy();
    expect((screen.getByLabelText('E-posta adresi') as HTMLInputElement).value).toBe('yeni@klinikterapist.com');
    fireEvent.click(screen.getByRole('button', { name: /Deneme girişi/ }));
    await screen.findByRole('heading', { level: 2, name: 'İletişim' });
    // The screen underneath was there all along; wait for the sign-in on top to go.
    await waitFor(() => expect(screen.queryByRole('heading', { name: /giriş/i })).toBeNull());
    expect((screen.getByLabelText('E-posta adresi') as HTMLInputElement).value).toBe('yeni@klinikterapist.com');
  });

  it('the sidebar has both logos, the main links, the new-post button and a theme toggle', async () => {
    const store = createSessionStore(localStorage);
    store.set('s', Date.now() + 3600e3);
    render(<App api={createMockApi()} store={store} config={config} />);
    const nav = await screen.findByRole('navigation', { name: 'Panel menüsü' });
    const srcs = Array.from(nav.querySelectorAll('img[alt="klinikterapist"]')).map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(['/admin/logo-black.png', '/admin/logo-white.png']);
    expect(within(nav).getByRole('link', { name: 'Genel Bakış' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Yazılar' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: /Siteyi Aç/ })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Yeni Yazı' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Karanlık Mod' }));
    expect(screen.getByRole('button', { name: 'Açık Mod' })).toBeTruthy();
  });

  it('the phone menu toggle is a Lucide icon and "Menü", no text glyph', async () => {
    const store = createSessionStore(localStorage);
    store.set('s', Date.now() + 3600e3);
    render(<App api={createMockApi()} store={store} config={config} />);
    const toggle = await screen.findByRole('button', { name: 'Menü' });
    expect(toggle.querySelector('svg.lucide')).toBeTruthy();
    expect(toggle.textContent).not.toContain('☰');
  });

  it('the theme switch sits at the bottom of the menu', async () => {
    const store = createSessionStore(localStorage);
    store.set('s', Date.now() + 3600e3);
    render(<App api={createMockApi()} store={store} config={config} />);
    const nav = await screen.findByRole('navigation', { name: 'Panel menüsü' });
    expect(within(nav).getByRole('button', { name: /Karanlık Mod|Açık Mod/ })).toBeTruthy();
    expect(document.querySelector('.panel-tools')).toBeNull();
  });

  it('"Yeni yazı" in the sidebar opens a fresh draft', async () => {
    const store = createSessionStore(localStorage);
    store.set('s', Date.now() + 3600e3);
    render(<App api={createMockApi()} store={store} config={config} />);
    const nav = await screen.findByRole('navigation', { name: 'Panel menüsü' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Yeni Yazı' }));
    expect(location.hash).toMatch(/^#\/yazi\/taslak-/);
  });

  it('an unconfigured panel says so', async () => {
    render(<App api={createMockApi()} store={createSessionStore(localStorage)} config={{ ...config, apiUrl: '' }} />);
    expect(await screen.findByText(/Panel henüz kurulmadı/)).toBeTruthy();
  });
});

describe('grouped menu and the bell (owner 2026-10-21)', () => {
  const config = { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'a@b.c' };
  afterEach(() => localStorage.clear());

  it('has Genel Bakış and four groups in order, with the renamed screens', async () => {
    const store = createSessionStore(localStorage);
    store.set('s', Date.now() + 3600e3);
    render(<App api={createMockApi()} store={store} config={config} />);
    const nav = await screen.findByRole('navigation', { name: 'Panel menüsü' });
    const folds = within(nav).getAllByRole('button', { expanded: true }).map((b) => b.textContent);
    expect(folds).toEqual(['Danışanlar ve Randevular', 'İçerik', 'Site Sayfaları', 'Ayarlar']);
    for (const name of ['Randevu Özeti', 'Danışanlar', 'Silinen Yazılar', 'Kategoriler', 'Site Ana Sayfası', 'Profil ve Kimlik', 'Gizlilik ve Analitik']) {
      expect(within(nav).getByRole('link', { name })).toBeTruthy();
    }
    expect(within(nav).queryByText('Kendi ziyaretlerimi sayma')).toBeNull();
  });

  it('a folded group stays folded after a reload', async () => {
    const store = createSessionStore(localStorage);
    store.set('s', Date.now() + 3600e3);
    const first = render(<App api={createMockApi()} store={store} config={config} />);
    const nav = await screen.findByRole('navigation', { name: 'Panel menüsü' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Site Sayfaları' }));
    expect(within(nav).queryByRole('link', { name: 'Hakkımda' })).toBeNull();
    first.unmount();
    render(<App api={createMockApi()} store={store} config={config} />);
    const again = await screen.findByRole('navigation', { name: 'Panel menüsü' });
    expect(within(again).getByRole('button', { name: 'Site Sayfaları' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('the bell opens a preview of the latest notifications with a way to all of them', async () => {
    const store = createSessionStore(localStorage);
    store.set('s', Date.now() + 3600e3);
    location.hash = '#/profil';
    render(<App api={createMockApi()} store={store} config={config} />);
    const bell = await screen.findByRole('button', { name: /^Bildirimler/ });
    fireEvent.click(bell);
    const preview = await screen.findByRole('dialog', { name: 'Son bildirimler' });
    expect(within(preview).getByRole('link', { name: 'Tüm bildirimler' }).getAttribute('href')).toBe('#/bildirimler');
  });
});
