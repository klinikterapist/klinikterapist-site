import { describe, it, expect, vi } from 'vitest';
import { createHttpApi } from '../../../src/admin/api/http';
import { createSessionStore } from '../../../src/admin/api/session';
import { ApiFailure } from '../../../src/admin/api/types';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

const reply = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('createHttpApi', () => {
  it('posts text/plain JSON with the action and the session', async () => {
    const store = createSessionStore(memoryStorage(), () => 1000);
    store.set('sess-1', 5000);
    const fetchMock = vi.fn(() => reply({ ok: true, data: { drafts: [] } }));
    const api = createHttpApi('https://script.example/exec', store, { fetch: fetchMock });
    await expect(api.listDrafts()).resolves.toEqual({ drafts: [] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://script.example/exec');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(JSON.parse(String(init.body))).toEqual({ action: 'drafts.list', session: 'sess-1' });
  });

  it('login stores the session; an unauthorized reply clears it and signs out', async () => {
    const store = createSessionStore(memoryStorage(), () => 1000);
    const onSignedOut = vi.fn();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => reply({ ok: true, data: { session: 's', email: 'merhaba@klinikterapist.com', expiresAt: 9000 } }))
      .mockImplementationOnce(() => reply({ ok: false, error: { code: 'unauthorized', message: 'Oturum doldu' } }));
    const api = createHttpApi('u', store, { fetch: fetchMock, onSignedOut });
    await api.login('id-token');
    expect(store.get()).toBe('s');
    await expect(api.tree()).rejects.toMatchObject({ code: 'unauthorized', message: 'Oturum doldu' });
    expect(store.get()).toBeNull();
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it('a conflict carries the current draft', async () => {
    const store = createSessionStore(memoryStorage(), () => 1000);
    store.set('s', 5000);
    const api = createHttpApi('u', store, {
      fetch: () => reply({ ok: false, error: { code: 'conflict', message: 'm' }, data: { current: { rev: 7 } } }),
    });
    const err = await api.saveDraft({} as never).catch((e) => e);
    expect(err).toBeInstanceOf(ApiFailure);
    expect(err.current).toEqual({ rev: 7 });
  });

  it('a network failure becomes a Turkish network error', async () => {
    const store = createSessionStore(memoryStorage(), () => 1000);
    store.set('s', 5000);
    const api = createHttpApi('u', store, { fetch: () => Promise.reject(new TypeError('Failed to fetch')) });
    await expect(api.status()).rejects.toMatchObject({ code: 'network', message: expect.stringContaining('İnternet bağlantısı') });
  });
});

describe('createSessionStore', () => {
  it('forgets an expired session', () => {
    let now = 1000;
    const store = createSessionStore(memoryStorage(), () => now);
    store.set('s', 2000);
    expect(store.get()).toBe('s');
    now = 2001;
    expect(store.get()).toBeNull();
  });
});
