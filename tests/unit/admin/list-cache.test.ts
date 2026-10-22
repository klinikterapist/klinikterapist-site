import { describe, it, expect, vi } from 'vitest';
import { FRESH_MS, onFresh, withListCache } from '../../../src/admin/api/cache';
import type { Api, BookingRequest, Client } from '../../../src/admin/api/types';
import type { SessionStore } from '../../../src/admin/api/session';

function fakeStore(): SessionStore & { signOut(): void } {
  const fns = new Set<() => void>();
  let session: string | null = 's';
  return {
    get: () => session,
    set: () => undefined,
    clear: () => undefined,
    subscribe: (fn) => (fns.add(fn), () => fns.delete(fn)),
    signOut() {
      session = null;
      fns.forEach((fn) => fn());
    },
  };
}

const req = (id: string, status: BookingRequest['status'] = 'pending') => ({ id, status }) as BookingRequest;
const client = (id: string, number: string) => ({ id, number }) as Client;
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  let requests = [req('a'), req('b')];
  let clients = [client('c1', '1')];
  const base = {
    requestsList: vi.fn(async () => ({ requests })),
    clientsList: vi.fn(async () => ({ clients })),
    requestDecide: vi.fn(async () => undefined),
    clientPay: vi.fn(async () => ({ client: client('c1', '1-paid') })),
    saveDraft: vi.fn(async () => ({ rev: 1, updatedAt: '' })),
    listDrafts: vi.fn(async () => ({ drafts: [] })),
    login: vi.fn(async () => ({ session: 's', email: 'e', expiresAt: 1 })),
    logout: vi.fn(async () => undefined),
  };
  const store = fakeStore();
  let t = 1000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const api = withListCache(base as unknown as Api, store, clock.now);
  return {
    base,
    api,
    store,
    clock,
    setRequests: (r: BookingRequest[]) => (requests = r),
    setClients: (c: Client[]) => (clients = c),
  };
}

describe('withListCache', () => {
  it('answers a second read from memory without calling the backend', async () => {
    const { base, api } = setup();
    await api.requestsList();
    const second = await api.requestsList();
    expect(second.requests.map((r) => r.id)).toEqual(['a', 'b']);
    expect(base.requestsList).toHaveBeenCalledTimes(1);
  });

  it('two screens asking at once share one call', async () => {
    const { base, api } = setup();
    await Promise.all([api.clientsList(), api.clientsList()]);
    expect(base.clientsList).toHaveBeenCalledTimes(1);
  });

  it('an old copy is shown at once, refreshed in the background, and the screens are told when it changed', async () => {
    const { base, api, clock, setRequests } = setup();
    const told = vi.fn();
    onFresh(api, told);
    await api.requestsList();
    clock.advance(FRESH_MS + 1);
    setRequests([req('a')]);
    const shown = await api.requestsList();
    expect(shown.requests).toHaveLength(2);
    await flush();
    expect(base.requestsList).toHaveBeenCalledTimes(2);
    expect(told).toHaveBeenCalledTimes(1);
    expect((await api.requestsList()).requests).toHaveLength(1);
    expect(base.requestsList).toHaveBeenCalledTimes(2);
  });

  it('does not tell the screens when the background answer is the same', async () => {
    const { api, clock } = setup();
    const told = vi.fn();
    onFresh(api, told);
    await api.requestsList();
    clock.advance(FRESH_MS + 1);
    await api.requestsList();
    await flush();
    expect(told).not.toHaveBeenCalled();
  });

  it('after a decision the list shows it at once, then checks with the backend', async () => {
    const { base, api, setRequests } = setup();
    const told = vi.fn();
    onFresh(api, told);
    await api.requestsList();
    await api.requestDecide({ id: 'a', decision: 'approve', subject: 's', body: 'b' });
    expect(told).toHaveBeenCalled();
    setRequests([req('a', 'approved'), req('b')]);
    const shown = await api.requestsList();
    expect(shown.requests.find((r) => r.id === 'a')?.status).toBe('approved');
    await flush();
    expect(base.requestsList).toHaveBeenCalledTimes(2);

    await api.requestDecide({ id: 'b', decision: 'cancel', subject: 's', body: 'b' });
    expect((await api.requestsList()).requests.map((r) => r.id)).toEqual(['a']);
  });

  it('a change puts the client the backend returned into the list', async () => {
    const { api } = setup();
    await api.clientsList();
    await api.clientPay({ id: 'c1', day: '2026-10-22', time: '10:00', paid: true });
    expect((await api.clientsList()).clients[0].number).toBe('1-paid');
  });

  it('keeps a background answer that started before a change from overwriting it', async () => {
    const { base, api, clock } = setup();
    await api.requestsList();
    clock.advance(FRESH_MS + 1);
    let release!: (v: unknown) => void;
    base.requestsList.mockImplementationOnce(() => new Promise((r) => (release = r as (v: unknown) => void)));
    await api.requestsList(); // starts the slow background read
    await api.requestDecide({ id: 'a', decision: 'approve', subject: 's', body: 'b' });
    release({ requests: [req('a'), req('b')] });
    await flush();
    expect((await api.requestsList()).requests.find((r) => r.id === 'a')?.status).toBe('approved');
  });

  it('a failed change still makes the next read check with the backend', async () => {
    const { base, api } = setup();
    await api.requestsList();
    base.requestDecide.mockRejectedValueOnce(new Error('x') as never);
    await expect(api.requestDecide({ id: 'a', decision: 'approve', subject: 's', body: 'b' })).rejects.toThrow('x');
    await api.requestsList();
    await flush();
    expect(base.requestsList).toHaveBeenCalledTimes(2);
  });

  it('forgets everything on sign-out', async () => {
    const { base, api, store } = setup();
    await api.requestsList();
    store.signOut();
    await api.requestsList();
    expect(base.requestsList).toHaveBeenCalledTimes(2);
  });

  it('hands out copies, so a screen cannot change the memory', async () => {
    const { api } = setup();
    const first = await api.requestsList();
    first.requests.pop();
    expect((await api.requestsList()).requests).toHaveLength(2);
  });

  it('passes other calls straight through', async () => {
    const { base, api } = setup();
    await api.listDrafts();
    await api.listDrafts();
    expect(base.listDrafts).toHaveBeenCalledTimes(2);
  });
});

describe('withListCache: statistics', () => {
  it('keeps each date range on its own', async () => {
    const statsSummary = vi.fn(async (r: { from: string; to: string }) => ({ days: [r.from] }));
    const api = withListCache({ statsSummary } as unknown as Api, fakeStore());
    await api.statsSummary({ from: '2026-10-01', to: '2026-10-22' });
    await api.statsSummary({ from: '2026-10-01', to: '2026-10-22' });
    const other = await api.statsSummary({ from: '2026-09-01', to: '2026-10-22' });
    expect(statsSummary).toHaveBeenCalledTimes(2);
    expect(other).toEqual({ days: ['2026-09-01'] });
  });
});
