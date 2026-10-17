// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('with a session shows the posts list, also for an unknown address', async () => {
    const store = createSessionStore(localStorage);
    store.set('s', Date.now() + 3600e3);
    location.hash = '#/boyle-bir-sayfa-yok';
    render(<App api={createMockApi()} store={store} config={config} />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Yazılar' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Panel menüsü' })).toBeTruthy();
  });

  it('signing in (mock backend) opens the panel', async () => {
    render(<App api={createMockApi()} store={createSessionStore(localStorage)} config={{ ...config, apiUrl: 'mock' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Deneme girişi/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Yazılar' })).toBeTruthy();
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
    expect(screen.queryByRole('heading', { name: /giriş/i })).toBeNull();
    expect((screen.getByLabelText('E-posta adresi') as HTMLInputElement).value).toBe('yeni@klinikterapist.com');
  });

  it('an unconfigured panel says so', async () => {
    render(<App api={createMockApi()} store={createSessionStore(localStorage)} config={{ ...config, apiUrl: '' }} />);
    expect(await screen.findByText(/Panel henüz kurulmadı/)).toBeTruthy();
  });
});
