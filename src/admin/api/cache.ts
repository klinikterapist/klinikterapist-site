/**
 * The panel's memory of the appointment lists (owner's request 2026-10-22). Every call to the Apps
 * Script backend takes about 2 s even when it does nothing, so each screen waited that long.
 *
 * A list read once is now answered at once from memory. When that copy is older than `FRESH_MS`, or
 * a change was made since, the read also asks the backend in the background and, when the answer
 * differs, tells the open screens (`onFresh`) to read again. After a change, the lists it touches are
 * corrected here from what the change returned, so the screen shows the result without waiting; a
 * list that cannot be corrected here is forgotten and read again. Two screens asking for the same
 * list at the same time share one call.
 *
 * Memory only: nothing goes to the browser's storage, and everything is forgotten on sign-out.
 */
import type { Api, BookingRequest, Client } from './types';
import type { SessionStore } from './session';

/** How long a copy counts as current; an older one is still shown while a new one is fetched. */
export const FRESH_MS = 30e3;

// statsSummary is kept per date range; the others take no input.
const LISTS = ['clientsList', 'requestsList', 'eventsList', 'calendarList', 'waitlistList', 'bookingState', 'paymentGet', 'statsSummary'] as const;
type ListName = (typeof LISTS)[number];
type Lists = { [K in ListName]?: Awaited<ReturnType<Api[K]>> };

/** Calls that change nothing the lists show. */
const READS = new Set<string>(['tree', 'read', 'snapshot', 'status', 'listDrafts', 'getDraft', 'listVersions', 'getVersion', 'listTrash', 'getImage', 'mailSettings']);

type Fix = { set?: Lists; forget?: ListName[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Patch = (lists: Lists, input: any, output: any) => Fix;

const upsertClient = (l: Lists, c: Client): Lists =>
  l.clientsList ? { clientsList: { clients: l.clientsList.clients.some((x) => x.id === c.id) ? l.clientsList.clients.map((x) => (x.id === c.id ? c : x)) : [...l.clientsList.clients, c] } } : {};
const mapRequests = (l: Lists, fn: (r: BookingRequest[]) => BookingRequest[]): Lists => (l.requestsList ? { requestsList: { requests: fn(l.requestsList.requests) } } : {});
const withoutClient = (l: Lists, id: string): Lists => (l.clientsList ? { clientsList: { clients: l.clientsList.clients.filter((c) => c.id !== id) } } : {});

/** What each change does to the lists, as far as can be told here (the backend has the last word). */
const PATCHES: Partial<Record<keyof Api, Patch>> = {
  requestDecide: (l, i) => ({
    set: mapRequests(l, (rs) => (i.decision === 'approve' ? rs.map((r) => (r.id === i.id ? { ...r, status: 'approved' as const } : r)) : rs.filter((r) => r.id !== i.id))),
    forget: ['calendarList'],
  }),
  requestRevert: (l, i) => ({ set: mapRequests(l, (rs) => rs.map((r) => (r.id === i.id ? { ...r, status: 'pending' as const } : r))), forget: ['calendarList'] }),
  requestAdd: (l, _i, o) => ({ set: mapRequests(l, (rs) => [...rs, o.request]), forget: ['calendarList'] }),
  requestToClient: (l, _i, o) => ({ set: upsertClient(l, o.client), forget: ['requestsList', 'calendarList'] }),
  clientSession: (l, _i, o) => ({ set: upsertClient(l, o.client), forget: ['calendarList'] }),
  clientPay: (l, _i, o) => ({ set: upsertClient(l, o.client) }),
  clientFee: (l, _i, o) => ({ set: upsertClient(l, o.client) }),
  clientEnd: (l, i) => (i.mode === 'closing' ? { forget: ['clientsList', 'calendarList'] } : { set: withoutClient(l, i.id), forget: ['calendarList'] }),
  clientRevert: () => ({ forget: ['clientsList', 'requestsList', 'calendarList'] }),
  calendarAdd: (l, _i, o) => (l.calendarList ? { set: { calendarList: { entries: [...l.calendarList.entries, o.entry].sort((a, b) => a.start - b.start) } } } : {}),
  calendarClose: (l, _i, o) => (l.calendarList ? { set: { calendarList: { entries: [...l.calendarList.entries, o.entry].sort((a, b) => a.start - b.start) } } } : {}),
  calendarRemove: (l, id) => ({ set: l.calendarList ? { calendarList: { entries: l.calendarList.entries.filter((e) => e.id !== id) } } : {}, forget: ['requestsList'] }),
  waitlistRemove: (l, id) => ({ set: l.waitlistList ? { waitlistList: { entries: l.waitlistList.entries.filter((e) => e.id !== id) } } : {} }),
  waitlistMail: (l, i) => (i.remove && l.waitlistList ? { set: { waitlistList: { entries: l.waitlistList.entries.filter((e) => e.id !== i.id) } } } : {}),
  paymentSet: (_l, _i, o) => ({ set: { paymentGet: o } }),
};

type Entry = { value: unknown; at: number; gen: number };

const listeners = new WeakMap<Api, Set<() => void>>();

/** Calls `fn` when a list changed in memory (a background answer, or a change made here). No-op for an uncached api. */
export function onFresh(api: Api, fn: () => void): () => void {
  const set = listeners.get(api);
  if (!set) return () => {};
  set.add(fn);
  return () => set.delete(fn);
}

export function withListCache(api: Api, store: SessionStore, now: () => number = Date.now): Api {
  // Keyed by the list's name, plus its input when it has one.
  const entries = new Map<string, Entry>();
  const inflight = new Map<string, { gen: number; promise: Promise<unknown> }>();
  const subs = new Set<() => void>();
  // Bumped by every change: an answer to a read that started before it is not kept.
  let gen = 0;
  const emit = () => subs.forEach((fn) => fn());
  const forgetAll = () => {
    gen++;
    entries.clear();
    inflight.clear();
  };
  store.subscribe(() => {
    if (!store.get()) forgetAll();
  });

  const fetchList = (name: ListName, args: unknown[], key: string): Promise<{ value: unknown; changed: boolean }> => {
    const started = gen;
    let p = inflight.get(key);
    if (!p || p.gen !== started) {
      const promise = (api[name] as (...a: unknown[]) => Promise<unknown>)(...args);
      p = { gen: started, promise };
      inflight.set(key, p);
      promise.then(
        () => inflight.get(key) === p && inflight.delete(key),
        () => inflight.get(key) === p && inflight.delete(key),
      );
    }
    return p.promise.then((value) => {
      if (gen !== started) return { value, changed: false };
      const before = entries.get(key);
      const changed = !before || JSON.stringify(before.value) !== JSON.stringify(value);
      entries.set(key, { value, at: now(), gen: started });
      return { value, changed };
    });
  };

  const read = async (name: ListName, args: unknown[]): Promise<unknown> => {
    const key = args.length ? `${name}:${JSON.stringify(args)}` : name;
    const e = entries.get(key);
    if (!e) return structuredClone((await fetchList(name, args, key)).value);
    if (e.gen !== gen || now() - e.at >= FRESH_MS) {
      fetchList(name, args, key).then(
        ({ changed }) => changed && emit(),
        () => undefined,
      );
    }
    return structuredClone(e.value);
  };

  const out = { ...api } as Record<string, unknown>;
  for (const name of LISTS) out[name] = (...args: unknown[]) => read(name, args);
  for (const key of Object.keys(api) as (keyof Api)[]) {
    if ((LISTS as readonly string[]).includes(key) || READS.has(key) || key === 'login' || key === 'logout') continue;
    const call = api[key] as (...args: unknown[]) => Promise<unknown>;
    out[key] = async (...args: unknown[]) => {
      gen++;
      try {
        const result = await call(...args);
        const patch = PATCHES[key];
        if (patch) {
          const current: Lists = {};
          for (const [n, e] of entries) (current as Record<string, unknown>)[n] = e.value;
          const fix = patch(current, args[0], result);
          gen++;
          for (const n of fix.forget ?? []) entries.delete(n);
          for (const [n, v] of Object.entries(fix.set ?? {})) entries.set(n, { value: v, at: 0, gen: -1 });
          emit();
        }
        return result;
      } finally {
        gen++;
      }
    };
  }
  out.login = async (idToken: string, step?: string) => {
    forgetAll();
    return api.login(idToken, step);
  };
  out.logout = async () => {
    forgetAll();
    return api.logout();
  };

  const cached = out as unknown as Api;
  listeners.set(cached, subs);
  return cached;
}
