/** The real backend: one POST endpoint on the Apps Script web app. */
import { ACTIONS, ApiFailure, type Api, type ApiResponse, type BookingRequest, type Client, type Session } from './types';
import type { SessionStore } from './session';
import { personName } from '../../lib/person-name';

const NETWORK_MESSAGE = 'İnternet bağlantısı yok gibi görünüyor. Değişiklikleriniz bu cihazda saklandı.';

export function createHttpApi(
  apiUrl: string,
  store: SessionStore,
  opts: { fetch?: (url: string, init: RequestInit) => Promise<Response>; onSignedOut?: () => void } = {},
): Api {
  const doFetch = opts.fetch ?? ((url, init) => fetch(url, init));

  async function call<T>(action: string, params: Record<string, unknown> = {}, withSession = true): Promise<T> {
    const body = JSON.stringify({ action, ...(withSession ? { session: store.get() } : {}), ...params });
    let res: Response;
    try {
      // text/plain keeps this a CORS "simple request": Apps Script cannot answer a preflight.
      res = await doFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow' });
    } catch {
      throw new ApiFailure('network', NETWORK_MESSAGE);
    }
    let out: ApiResponse<T>;
    try {
      out = (await res.json()) as ApiResponse<T>;
    } catch {
      throw new ApiFailure('internal', 'Sunucudan anlaşılmayan bir yanıt geldi. Biraz sonra tekrar deneyin.');
    }
    if (out.ok) return out.data;
    if (out.error.code === 'unauthorized' && withSession) {
      store.clear();
      opts.onSignedOut?.();
    }
    const current = (out.data as { current?: unknown } | undefined)?.current;
    throw new ApiFailure(out.error.code, out.error.message, current);
  }

  return {
    loginStart: () => call(ACTIONS.loginStart, {}, false),
    loginPassword: (username, password) => call(ACTIONS.loginPassword, { username, password }, false),
    setPassword: (input) => call(ACTIONS.setPassword, input).then(() => undefined),
    async login(idToken, step) {
      const s = await call<Session>(ACTIONS.login, { idToken, ...(step ? { step } : {}) }, false);
      store.set(s.session, s.expiresAt);
      return s;
    },
    async logout() {
      try {
        await call(ACTIONS.logout);
      } finally {
        store.clear();
      }
    },
    tree: () => call(ACTIONS.tree),
    read: (paths) => call(ACTIONS.read, { paths }),
    snapshot: () => call(ACTIONS.snapshot),
    commit: (input) => call(ACTIONS.commit, input),
    status: () => call(ACTIONS.status),
    listDrafts: () => call(ACTIONS.listDrafts),
    getDraft: (key) => call(ACTIONS.getDraft, { key }),
    saveDraft: (draft, opts) => call(ACTIONS.saveDraft, { draft, snapshot: opts?.snapshot === true }),
    listVersions: (key) => call(ACTIONS.listVersions, { key }),
    getVersion: (key, name) => call(ACTIONS.getVersion, { key, name }),
    deleteDraft: async (key, opts) => {
      await call(ACTIONS.deleteDraft, { key, ...(opts?.trash ? { trash: true } : {}) });
    },
    listTrash: () => call(ACTIONS.listTrash),
    restoreTrash: (key) => call(ACTIONS.restoreTrash, { key }),
    purgeTrash: async (key) => {
      await call(ACTIONS.purgeTrash, { key });
    },
    putImage: async (key, name, base64) => {
      await call(ACTIONS.putImage, { key, name, base64 });
    },
    getImage: (key, name) => call(ACTIONS.getImage, { key, name }),
    statsSummary: (range) => call(ACTIONS.statsSummary, range),
    ensureTriggers: () => call(ACTIONS.ensureTriggers, {}).then(() => undefined),
    calendarList: () => call(ACTIONS.calendarList),
    calendarAdd: (input) => call(ACTIONS.calendarAdd, input),
    calendarRemove: (id) => call(ACTIONS.calendarRemove, { id }).then(() => undefined),
    // Names saved before the capitals rule (2026-10-23) are shown with capitals too.
    requestsList: () => call<{ requests: BookingRequest[] }>(ACTIONS.requestsList).then((r) => ({ ...r, requests: r.requests.map((q) => ({ ...q, name: personName(q.name, q.lang) })) })),
    requestDecide: (input) => call(ACTIONS.requestDecide, input).then(() => undefined),
    requestToClient: (input) => call(ACTIONS.requestToClient, input),
    clientsList: () =>
      call<{ clients: Client[] }>(ACTIONS.clientsList).then((r) => ({ ...r, clients: r.clients.map((c) => ({ ...c, contact: { ...c.contact, name: personName(c.contact.name, c.contact.lang) } })) })),
    requestRevert: (input) => call(ACTIONS.requestRevert, input).then(() => undefined),
    clientEnd: (input) => call(ACTIONS.clientEnd, input).then(() => undefined),
    clientRevert: (input) => call(ACTIONS.clientRevert, input).then(() => undefined),
    clientSession: (input) => call(ACTIONS.clientSession, input),
    clientLink: (input) => call(ACTIONS.clientLink, input),
    calendarClose: (input) => call(ACTIONS.calendarClose, input),
    clientLinkMail: (input) => call(ACTIONS.clientLinkMail, input).then(() => undefined),
    eventsList: () => call(ACTIONS.eventsList, {}),
    paymentGet: () => call(ACTIONS.paymentGet, {}),
    paymentSet: (payment) => call(ACTIONS.paymentSet, { payment }),
    mailSettings: () => call(ACTIONS.mailSettings, {}),
    mailSettingsSet: (mailboxes) => call(ACTIONS.mailSettingsSet, { mailboxes }),
    mailTest: () => call(ACTIONS.mailTest, {}),
    clientPay: (input) => call(ACTIONS.clientPay, input),
    clientFee: (input) => call(ACTIONS.clientFee, input),
    clientMail: (input) => call(ACTIONS.clientMail, input).then(() => undefined),
    bookingState: () => call(ACTIONS.bookingState),
    bookingSetOpen: (open, lang) => call(ACTIONS.bookingSetOpen, { open, lang }).then(() => undefined),
    requestAdd: (input) => call(ACTIONS.requestAdd, input),
    waitlistList: () => call(ACTIONS.waitlistList),
    waitlistMail: (input) => call(ACTIONS.waitlistMail, input).then(() => undefined),
    waitlistRemove: (id) => call(ACTIONS.waitlistRemove, { id }).then(() => undefined),
  };
}
