/**
 * In-memory backend for development (`/admin/?mock` in `npm run dev`) and component tests.
 * Seeded with the real settings files and the fixture posts. Never shipped: the panel only
 * imports it behind `import.meta.env.DEV`.
 */
import { ApiFailure, type Api, type BookingRequest, type CalendarEntry, type Client, type PanelEvent, type PanelEventKind, type MailSettings, type MailboxKey, type WaitlistEntry, type CommitDelete, type CommitWrite, type Draft, type Encoding, type SiteStatus } from './types';
import type { StatsSummary } from '../../lib/stats-wire';
import { INTRO_MINUTES, clientNumber, intakeOpen, previewClosedKey, holdOf, minutesOf, overlaps, slotInstant, type BusyInterval } from '../../lib/booking-form';
import { SessionError, applyChange, clientsBusy, type SessionChangeInput } from '../../lib/sessions';
import { TRACK_PATH } from '../../lib/tracking';
import { EMPTY_PAYMENT, parsePayment, type PaymentSettings } from '../../lib/payment';
import { EMAIL_RE } from '../../lib/field-rules';

/** Faz 4 demo: the owner's address and the aliases added in Gmail ("Send mail as"). */
const OWNER = 'merhaba@klinikterapist.com';
const MOCK_ALIASES = ['randevu@klinikterapist.com', 'bilgi@klinikterapist.com'];
/** A Workspace account sends 1500 a day; each demo e-mail uses one. */
const mailSettingsOf = (state: { mailboxes: Record<MailboxKey, string>; sent: unknown[] }): MailSettings => ({
  mailboxes: { ...state.mailboxes },
  owner: OWNER,
  aliases: [...MOCK_ALIASES],
  quota: Math.max(0, 1500 - state.sent.length),
});

const data = import.meta.glob('/src/data/**/*.{json,md}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const posts = import.meta.glob('/tests/fixtures/content/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const images = import.meta.glob('/tests/fixtures/content/**/*.webp', { query: '?inline', import: 'default', eager: true }) as Record<string, string>;

type File = { content: string; encoding: Encoding; sha: string };

/** Stable short content hash standing in for git blob shas. */
function sha(content: string): string {
  let h = 2166136261;
  for (let i = 0; i < content.length; i++) h = Math.imul(h ^ content.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export type MockState = {
  files: Map<string, File>;
  drafts: Map<string, Draft>;
  images: Map<string, string>;
  /** Snapshots by draft key, oldest first. `at` is epoch ms. */
  versions: Map<string, { name: string; at: number; draft: Draft }[]>;
  commits: { message: string; writes: CommitWrite[]; deletes: CommitDelete[] }[];
  /** The panel's trash: deleted drafts by key, `deletedAt` in epoch ms. */
  trash: Map<string, { deletedAt: number; draft: Draft }>;
  /** Planned-publish errors by draft key, as the backend's trigger records them. */
  scheduleErrors: Map<string, string>;
  /** How many times the panel asked for the hourly trigger. */
  triggerCalls: number;
  /** The booking calendar. */
  calendar: CalendarEntry[];
  requests: BookingRequest[];
  clients: (Client & { origin?: BookingRequest })[];
  /** E-mails the owner sent from Randevu talepleri and Seans takip. */
  sent: { to: string; subject: string; body: string }[];
  /** Randevu alımı açık mı. */
  open: { tr: boolean; en: boolean };
  /** "Haber et" list. */
  waitlist: WaitlistEntry[];
  /** Each client's link version ("Bağlantıyı yenile"). */
  linkGen: Map<string, number>;
  /** The owner's fees and payment details (Faz 1). */
  payment: PaymentSettings;
  /** Bildirimler (Faz 2), oldest first. */
  events: PanelEvent[];
  /** Faz 4: the addresses, and the aliases the demo account has in Gmail. */
  mailboxes: Record<MailboxKey, string>;
};

const TRASH_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

export function createMockApi(opts: { latency?: number; seed?: Record<string, string>; now?: () => number; stats?: StatsSummary; demoRequests?: boolean } = {}): Api & { state: MockState } {
  const files = new Map<string, File>();
  const put = (path: string, content: string, encoding: Encoding) => files.set(path, { content, encoding, sha: sha(content) });
  if (opts.seed) {
    for (const [p, c] of Object.entries(opts.seed)) put(p, c, /\.(webp|jpg)$/.test(p) ? 'base64' : 'utf8');
  } else {
    for (const [p, c] of Object.entries(data)) put(p.slice(1), c, 'utf8');
    for (const [p, c] of Object.entries(posts)) put(p.replace('/tests/fixtures/content/', 'src/content/posts/'), c, 'utf8');
    for (const [p, url] of Object.entries(images)) put(p.replace('/tests/fixtures/content/', 'src/content/posts/'), url.split(',')[1] ?? '', 'base64');
  }
  const state: MockState = { files, drafts: new Map(), images: new Map(), versions: new Map(), commits: [], trash: new Map(), scheduleErrors: new Map(), triggerCalls: 0, calendar: [], requests: [], clients: [], sent: [], open: { tr: true, en: false }, waitlist: [], linkGen: new Map(), payment: EMPTY_PAYMENT, events: [], mailboxes: { notify: '', booking: '', info: '' } };
  let clientSeq = 0;
  const bookingFile = files.get('src/data/booking.json');
  if (bookingFile) {
    try {
      const cfg = JSON.parse(bookingFile.content) as { intake?: { tr: boolean; en: boolean } };
      state.open = { tr: intakeOpen(cfg, 'tr'), en: intakeOpen(cfg, 'en') };
    } catch {
      /* keep the defaults */
    }
  }
  if (opts.demoRequests) {
    for (const lang of ['tr', 'en'] as const) {
      try {
        const v = localStorage.getItem(previewClosedKey(lang));
        if (v === '1' || v === '0') state.open[lang] = v === '0';
      } catch {
        /* no storage */
      }
    }
    const now = (opts.now ?? Date.now)();
    const requests = demoRequests(now);
    state.requests.push(...requests);
    // Their 24-hour holds, and one client in Seans takip, so the calendar shows both marks.
    for (const r of requests) {
      if (r.status === 'approved') state.calendar.push({ id: r.calendarId!, start: slotInstant(r.day, r.time), minutes: minutesOf(r.kind, r.type), kind: r.kind, ...(r.type ? { type: r.type } : {}), status: 'confirmed' });
      else state.calendar.push({ id: r.holdId, start: slotInstant(r.day, r.time), minutes: minutesOf(r.kind, r.type), kind: r.kind, ...(r.type ? { type: r.type } : {}), status: 'hold', holdUntil: r.createdAt + 864e5 });
    }
    // A client three weeks in: the intro call, two weekly sessions marked, one cancelled.
    const name = 'Zeynep Örnek';
    const iso = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
    let since = now - 24 * 864e5;
    while (new Date(since + 3 * 3600e3).getUTCDay() !== 2) since += 864e5;
    const tue = (n: number) => iso(since + n * 7 * 864e5);
    state.clients.push({
      id: 'demo-client', number: clientNumber(++clientSeq, name), type: 'individual', weekday: 2, time: '18:00', minutes: 50, since: tue(0), status: 'active',
      contact: { name, email: 'zeynep@example.com', lang: 'tr', verified: true },
      origin: { ...requests[0], id: 'demo-0', name, email: 'zeynep@example.com', time: '18:00' },
      sessions: [
        { day: iso(since - 4 * 864e5), time: '11:00', kind: 'intro', minutes: 30, status: 'attended' },
        { day: tue(0), time: '18:00', kind: 'weekly', minutes: 50, status: 'attended', paid: since - 864e5 },
        { day: tue(2), time: '18:00', kind: 'weekly', minutes: 50, status: 'attended', paid: since + 13 * 864e5 },
        // Cancelled on their own page less than 24 hours before (full fee).
        { day: tue(1), time: '18:00', kind: 'weekly', minutes: 50, status: 'cancelled', by: 'client', note: 'Hastalık', late: true },
      ],
    });
    // A few things that happened, for Bildirimler.
    const ev = (ago: number, kind: PanelEventKind, text: string, link?: string) => state.events.push({ id: `demo-ev-${state.events.length}`, at: now - ago, kind, text, ...(link ? { link } : {}) });
    ev(5 * 864e5, 'client', 'KT001ZO seansını iptal etti · 24 saatten az kala (tam ücret)', '#/seans-takip/demo-client');
    ev(2 * 864e5, 'waitlist', 'Bekleme listesine yeni kayıt: E. B.', '#/randevular?liste');
    ev(26 * 3600e3, 'request', 'Yeni ön görüşme talebi: M. D.', '#/randevular');
    ev(3 * 3600e3, 'request', 'Yeni seans talebi: A. Ö.', '#/randevular');
    ev(2 * 3600e3, 'reminder', 'Tutma süresi doluyor: M. D.', '#/randevular');
    state.waitlist.push({
      id: 'demo-wait', createdAt: now - 2 * 864e5, name: 'Elif Bekler', email: 'elif@example.com', phone: '0534 000 00 00', kinds: ['individual'], times: ['weekday-evening'],
      reason: 'Son aylarda iş stresiyle baş etmekte zorlanıyorum.', lang: 'tr', verified: true,
    });
  }
  /** As the backend's `assertFree` (review H1): a booking made in the panel must not land on a client's session. */
  const clientClash = (holds: BusyInterval[]) => {
    const now = clock();
    for (const c of state.clients) {
      if (clientsBusy([c], 30, now, now + 56 * 864e5).some((b) => holds.some((h) => overlaps(h, b)))) {
        throw new ApiFailure('conflict', `Bu saat ${c.number} numaralı danışanın seansıyla çakışıyor. Başka bir saat seçin.`);
      }
    }
  };
  const mail = (to: string, subject: string, body: string) => {
    if (!subject.trim() || !body.trim()) throw new ApiFailure('bad_request', 'E-postanın konusu ve metni boş olamaz.');
    state.sent.push({ to, subject, body });
  };
  /** A request put back holds its time again for 24 hours when that time is still ahead. */
  const holdAgain = (r: BookingRequest): string => {
    const start = slotInstant(r.day, r.time);
    if (start <= clock()) return '';
    const entry: CalendarEntry = { id: Math.random().toString(36).slice(2, 10), start, minutes: minutesOf(r.kind, r.type), kind: r.kind, ...(r.type ? { type: r.type } : {}), status: 'hold', holdUntil: clock() + 864e5 };
    state.calendar.push(entry);
    return entry.id;
  };
  let head = 1;
  let status: SiteStatus = { state: 'success', commitSha: 'c1', url: null, updatedAt: null, tokenExpiresAt: '2027-10-01T09:00:00.000Z' };
  let pollsSinceCommit = 0;

  const clock = opts.now ?? Date.now;
  /** A draft gone for good: trash entry, snapshots and images. */
  const purge = (key: string) => {
    state.trash.delete(key);
    state.versions.delete(key);
    for (const k of [...state.images.keys()]) if (k.startsWith(`${key}/`)) state.images.delete(k);
  };

  const wait = <T>(v: () => T): Promise<T> =>
    new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(v());
        } catch (e) {
          reject(e);
        }
      }, opts.latency ?? 0),
    );

  return {
    state,
    login: () => wait(() => ({ session: 'mock-session', email: 'merhaba@klinikterapist.com', expiresAt: Date.now() + 12 * 3600e3 })),
    logout: () => wait(() => undefined),
    tree: () => wait(() => ({ headSha: `c${head}`, files: [...files].map(([path, f]) => ({ path, sha: f.sha, size: f.content.length })) })),
    read: (paths) =>
      wait(() => ({
        files: paths.map((path) => {
          const f = files.get(path);
          if (!f) throw new ApiFailure('not_found', `Dosya bulunamadı: ${path}`);
          return { path, ...f };
        }),
      })),
    snapshot: () =>
      wait(() => {
        const list = [...files].map(([path, f]) => ({ path, sha: f.sha, size: f.content.length }));
        const wanted = /^src\/content\/posts\/[a-z0-9-]+\/(tr|en)\.md$|^src\/data\/(redirects|categories|seo)\.json$/;
        return { headSha: `c${head}`, files: list, contents: list.filter((f) => wanted.test(f.path)).map((f) => ({ path: f.path, ...files.get(f.path)! })) };
      }),
    commit: (input) =>
      wait(() => {
        for (const w of input.writes) if ((files.get(w.path)?.sha ?? null) !== w.expectSha) throw new ApiFailure('conflict', `"${w.path}" başka bir yerde değişmiş.`);
        for (const d of input.deletes) if (files.get(d.path)?.sha !== d.expectSha) throw new ApiFailure('conflict', `"${d.path}" başka bir yerde değişmiş.`);
        for (const w of input.writes) put(w.path, w.content, w.encoding);
        for (const d of input.deletes) files.delete(d.path);
        state.commits.push(input);
        head++;
        status = { ...status, state: 'in_progress', commitSha: `c${head}` };
        pollsSinceCommit = 0;
        return { commitSha: `c${head}` };
      }),
    status: () =>
      wait(() => {
        if (status.state === 'in_progress' && ++pollsSinceCommit >= 2) status = { ...status, state: 'success' };
        return status;
      }),
    listDrafts: () =>
      wait(() => ({
        drafts: [...state.drafts.values()]
          .map((d) => ({
            key: d.key,
            rev: d.rev,
            updatedAt: d.updatedAt,
            published: d.published,
            category: d.category,
            title: { tr: d.tr.title, en: d.en.title },
            scheduledAt: d.scheduledAt ?? null,
            scheduleError: d.scheduledAt ? (state.scheduleErrors.get(d.key) ?? null) : null,
          }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      })),
    getDraft: (key) =>
      wait(() => {
        const d = state.drafts.get(key);
        if (!d) throw new ApiFailure('not_found', 'Taslak bulunamadı.');
        return { draft: structuredClone(d) };
      }),
    saveDraft: (draft, saveOpts) =>
      wait(() => {
        const current = state.drafts.get(draft.key);
        if (current ? current.rev !== draft.rev : draft.rev !== 0) {
          throw new ApiFailure('conflict', 'Bu taslak başka bir cihazda daha yeni kaydedilmiş.', current ? structuredClone(current) : undefined);
        }
        if (current) {
          const now = clock();
          const kept = (state.versions.get(draft.key) ?? []).filter((v) => now - v.at <= 30 * 24 * 3600e3);
          const last = kept.at(-1);
          if (saveOpts?.snapshot === true || !last || now - last.at >= 10 * 60e3) {
            const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
            kept.push({ name: `${current.rev}-${stamp}.json`, at: now, draft: structuredClone(current) });
          }
          state.versions.set(draft.key, kept);
        }
        const next = { ...structuredClone(draft), rev: draft.rev + 1, updatedAt: new Date(clock()).toISOString() };
        state.drafts.set(draft.key, next);
        return { rev: next.rev, updatedAt: next.updatedAt };
      }),
    listVersions: (key) =>
      wait(() => ({
        versions: [...(state.versions.get(key) ?? [])]
          .sort((a, b) => b.at - a.at)
          .slice(0, 50)
          .map((v) => ({ name: v.name, rev: v.draft.rev, savedAt: new Date(v.at).toISOString() })),
      })),
    getVersion: (key, name) =>
      wait(() => {
        const v = state.versions.get(key)?.find((x) => x.name === name);
        if (!v) throw new ApiFailure('not_found', 'Bu sürüm bulunamadı. 30 günden eski sürümler silinir.');
        return { draft: structuredClone(v.draft) };
      }),
    deleteDraft: (key, o) =>
      wait(() => {
        const d = state.drafts.get(key);
        state.drafts.delete(key);
        if (o?.trash && d) {
          state.trash.set(key, { deletedAt: clock(), draft: d });
          return;
        }
        purge(key);
      }),
    listTrash: () =>
      wait(() => {
        const now = clock();
        for (const [k, t] of state.trash) if (now - t.deletedAt >= TRASH_KEEP_MS) purge(k);
        const items = [...state.trash.values()]
          .map(({ deletedAt, draft: d }) => ({
            key: d.key,
            rev: d.rev,
            updatedAt: d.updatedAt,
            published: d.published,
            category: d.category,
            title: { tr: d.tr.title, en: d.en.title },
            deletedAt: new Date(deletedAt).toISOString(),
            purgeAt: new Date(deletedAt + TRASH_KEEP_MS).toISOString(),
          }))
          .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
        return { items };
      }),
    restoreTrash: (key) =>
      wait(() => {
        const t = state.trash.get(key);
        if (!t) throw new ApiFailure('not_found', 'Bu yazı çöp kutusunda bulunamadı. 30 günü geçtiği için silinmiş olabilir.');
        if (state.drafts.has(key)) throw new ApiFailure('conflict', 'Aynı yazının açık bir taslağı var. Önce o taslağı silin ya da yayınlayın.');
        state.drafts.set(key, t.draft);
        state.trash.delete(key);
        const d = t.draft;
        return { draft: { key: d.key, rev: d.rev, updatedAt: d.updatedAt, published: d.published, category: d.category, title: { tr: d.tr.title, en: d.en.title } } };
      }),
    purgeTrash: (key) =>
      wait(() => {
        if (!state.trash.has(key)) throw new ApiFailure('not_found', 'Bu yazı çöp kutusunda bulunamadı.');
        purge(key);
      }),
    putImage: (key, name, base64) => wait(() => void state.images.set(`${key}/${name}`, base64)),
    getImage: (key, name) =>
      wait(() => {
        const b = state.images.get(`${key}/${name}`);
        if (b === undefined) throw new ApiFailure('not_found', 'Görsel bulunamadı.');
        return { base64: b };
      }),
    statsSummary: ({ from, to }) =>
      wait(() => {
        const all = opts.stats ?? demoStats(files, clock());
        const days: StatsSummary['days'] = {};
        for (const [d, c] of Object.entries(all.days)) if (d >= from && d <= to) days[d] = { ...c };
        return { days, since: all.since };
      }),
    ensureTriggers: () => wait(() => void state.triggerCalls++),
    calendarList: () => wait(() => ({ entries: [...state.calendar].sort((a, b) => a.start - b.start) })),
    calendarAdd: ({ day, time, kind, type }) =>
      wait(() => {
        const start = slotInstant(day, time);
        const minutes = minutesOf(kind, type);
        clientClash([holdOf(day, time, minutes, 30)]);
        const end = (e: CalendarEntry) => e.start + (e.minutes + 30) * 60e3;
        if (state.calendar.some((e) => e.status === 'confirmed' && e.start < start + (minutes + 30) * 60e3 && start < end(e))) {
          throw new ApiFailure('conflict', 'Bu saat onaylı başka bir randevuyla çakışıyor. Önce o randevuyu silin ya da başka bir saat seçin.');
        }
        state.calendar = state.calendar.filter((e) => !(e.status === 'hold' && e.start < start + (minutes + 30) * 60e3 && start < end(e)));
        const entry: CalendarEntry = { id: Math.random().toString(36).slice(2, 10), start, minutes, kind, ...(type ? { type } : {}), status: 'confirmed' };
        state.calendar.push(entry);
        return { entry };
      }),
    calendarClose: ({ day, from, to, note }) =>
      wait(() => {
        const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
        const minutes = mins(to) - mins(from);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(minutes > 0)) throw new ApiFailure('bad_request', 'Bitiş saati başlangıçtan sonra olmalı.');
        const entry: CalendarEntry = { id: Math.random().toString(36).slice(2, 10), start: slotInstant(day, from), minutes, kind: 'session', status: 'closed', ...(note?.trim() ? { note: note.trim().slice(0, 80) } : {}) };
        state.calendar.push(entry);
        return { entry };
      }),
    calendarRemove: (id) => wait(() => void (state.calendar = state.calendar.filter((e) => e.id !== id))),
    requestsList: () => wait(() => ({ requests: [...state.requests].sort((a, b) => a.createdAt - b.createdAt) })),
    requestDecide: ({ id, decision, subject, body }) =>
      wait(() => {
        const r = state.requests.find((x) => x.id === id);
        if (!r) throw new ApiFailure('not_found', 'Bu talep bulunamadı.');
        if (decision === 'approve') clientClash([holdOf(r.day, r.time, minutesOf(r.kind, r.type), 30)]);
        mail(r.email, subject, body);
        if (decision === 'approve') {
          const entry: CalendarEntry = { id: Math.random().toString(36).slice(2, 10), start: slotInstant(r.day, r.time), minutes: minutesOf(r.kind, r.type), kind: r.kind, ...(r.type ? { type: r.type } : {}), status: 'confirmed' };
          state.calendar = [...state.calendar.filter((e) => e.id !== r.holdId), entry];
          state.requests = state.requests.map((x) => (x.id === id ? { ...x, status: 'approved', calendarId: entry.id } : x));
        } else {
          state.calendar = state.calendar.filter((e) => e.id !== r.holdId && e.id !== r.calendarId);
          state.requests = state.requests.filter((x) => x.id !== id);
        }
      }),
    requestToClient: ({ id, weekday, time, since }) =>
      wait(() => {
        const r = state.requests.find((x) => x.id === id);
        if (!r) throw new ApiFailure('not_found', 'Bu talep bulunamadı.');
        if (r.status !== 'approved') throw new ApiFailure('bad_request', 'Önce talebi onaylayın.');
        const session = r.kind === 'session';
        if (!session && (weekday === undefined || !time || !since)) throw new ApiFailure('bad_request', 'Haftalık seans günü, saati ve başlangıç tarihi gerekli.');
        const type = session ? (r.type ?? 'individual') : (r.forWhom ?? 'individual');
        const now = clock();
        clientClash(
          clientsBusy(
            [{ weekday: session ? new Date(`${r.day}T12:00:00Z`).getUTCDay() : weekday!, time: session ? r.time : time!, minutes: minutesOf('session', type), since: session ? r.day : since!, sessions: [] }],
            30,
            now,
            now + 56 * 864e5,
          ),
        );
        const client: Client = {
          id: Math.random().toString(36).slice(2, 10),
          number: clientNumber(++clientSeq, r.name),
          type,
          weekday: session ? new Date(`${r.day}T12:00:00Z`).getUTCDay() : weekday!,
          time: session ? r.time : time!,
          minutes: minutesOf('session', type),
          since: session ? r.day : since!,
          status: 'active',
          contact: { name: r.name, email: r.email, lang: r.lang },
        };
        if (session) state.calendar = state.calendar.filter((e) => e.id !== r.calendarId);
        state.clients.push({ ...client, origin: r });
        state.requests = state.requests.filter((x) => x.id !== id);
        return { client };
      }),
    requestRevert: ({ id, subject, body }) =>
      wait(() => {
        const r = state.requests.find((x) => x.id === id);
        if (!r || r.status !== 'approved') throw new ApiFailure('not_found', 'Bu talep bulunamadı.');
        mail(r.email, subject, body);
        state.calendar = state.calendar.filter((e) => e.id !== r.calendarId);
        state.requests = state.requests.map((x) => (x.id === id ? { ...x, status: 'pending', holdId: holdAgain(x), calendarId: undefined } : x));
      }),
    clientsList: () => wait(() => ({ clients: state.clients.map(({ origin: _o, ...c }) => c).sort((a, b) => a.number.localeCompare(b.number)) })),
    clientSession: ({ id, ...change }) =>
      wait(() => {
        const c = state.clients.find((x) => x.id === id);
        if (!c) throw new ApiFailure('not_found', 'Bu danışan bulunamadı.');
        try {
          c.sessions = applyChange(c, change as SessionChangeInput, INTRO_MINUTES).sessions;
        } catch (e) {
          if (e instanceof SessionError) throw new ApiFailure('bad_request', e.message);
          throw e;
        }
        const { origin: _o, ...pub } = c;
        return { client: structuredClone(pub) };
      }),
    clientLink: ({ id, renew }) =>
      wait(() => {
        const c = state.clients.find((x) => x.id === id);
        if (!c) throw new ApiFailure('not_found', 'Bu danışan bulunamadı.');
        if (renew) state.linkGen.set(id, (state.linkGen.get(id) ?? 0) + 1);
        const sig = `${id}${state.linkGen.get(id) ?? 0}`.padEnd(32, 'x').slice(0, 32).replace(/[^\w-]/g, 'x');
        return { link: `https://klinikterapist.com${TRACK_PATH[c.contact.lang]}#k=${id}.${sig}` };
      }),
    eventsList: () => wait(() => ({ events: [...state.events].reverse().sort((a, b) => b.at - a.at) })),
    paymentGet: () => wait(() => ({ payment: structuredClone(state.payment) })),
    paymentSet: (payment) =>
      wait(() => {
        const p = parsePayment(payment);
        if (!p.year) throw new ApiFailure('bad_request', 'Ücretlerin geçerli olduğu yılı girin.');
        state.payment = { ...p, qr: typeof payment.qr === 'string' ? payment.qr : (state.payment.qr ?? '') };
        return { payment: structuredClone(state.payment) };
      }),
    mailSettings: () => wait(() => mailSettingsOf(state)),
    mailSettingsSet: (boxes) =>
      wait(() => {
        const next = { notify: boxes.notify.trim().toLowerCase(), booking: boxes.booking.trim().toLowerCase(), info: boxes.info.trim().toLowerCase() };
        for (const v of Object.values(next)) if (v && !EMAIL_RE.test(v)) throw new ApiFailure('bad_request', `Bu adres geçerli görünmüyor: ${v}`);
        for (const v of [next.booking, next.info]) {
          if (v && !MOCK_ALIASES.includes(v)) throw new ApiFailure('bad_request', `${v} Gmail'de "Farklı adresten gönder" olarak eklenmemiş. Önce rehberdeki adımları yapın, sonra tekrar kaydedin.`);
        }
        state.mailboxes = next;
        return mailSettingsOf(state);
      }),
    mailTest: () =>
      wait(() => {
        const sent = 1 + [state.mailboxes.booking, state.mailboxes.info].filter(Boolean).length;
        for (let i = 0; i < sent; i++) state.sent.push({ to: OWNER, subject: '[klinikterapist] Deneme', body: '' });
        return { sent };
      }),
    clientPay: ({ id, day, time, paid, mail: m }) =>
      wait(() => {
        const c = state.clients.find((x) => x.id === id);
        if (!c) throw new ApiFailure('not_found', 'Bu danışan bulunamadı.');
        try {
          const sessions = applyChange(c, { op: 'pay', day, time, paid, paidAt: clock() }, INTRO_MINUTES).sessions;
          if (paid && m) mail(c.contact.email, m.subject, m.body);
          c.sessions = sessions;
          state.events.push({ id: Math.random().toString(36).slice(2, 10), at: clock(), kind: 'payment', text: `${c.number}: ${day} seansı ${paid ? 'ödendi' : 'için ödeme işareti kaldırıldı'}`, link: `#/seans-takip/${c.id}` });
        } catch (e) {
          if (e instanceof SessionError) throw new ApiFailure('bad_request', e.message);
          throw e;
        }
        const { origin: _o, ...pub } = c;
        return { client: structuredClone(pub) };
      }),
    clientMail: ({ id, subject, body }) =>
      wait(() => {
        const c = state.clients.find((x) => x.id === id);
        if (!c) throw new ApiFailure('not_found', 'Bu danışan bulunamadı.');
        mail(c.contact.email, subject, body);
      }),
    clientLinkMail: ({ id, subject, body }) =>
      wait(() => {
        const c = state.clients.find((x) => x.id === id);
        if (!c) throw new ApiFailure('not_found', 'Bu danışan bulunamadı.');
        mail(c.contact.email, subject, body);
      }),
    bookingState: () => wait(() => ({ open: state.open, waiting: state.waitlist.length })),
    bookingSetOpen: (open, lang) =>
      wait(() => {
        state.open = { ...state.open, [lang]: open };
        // The trial mode tells the booking pages on the dev server (previewClosedKey); the site's
        // buttons keep following booking.json on disk.
        if (opts.demoRequests) {
          try {
            localStorage.setItem(previewClosedKey(lang), open ? '0' : '1');
          } catch {
            /* no storage */
          }
        }
      }),
    requestAdd: (input) =>
      wait(() => {
        if (input.name.trim().length < 2) throw new ApiFailure('bad_request', 'Ad soyad eksik.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim())) throw new ApiFailure('bad_request', 'E-posta adresi hatalı görünüyor.');
        const start = slotInstant(input.day, input.time);
        const minutes = minutesOf(input.kind, input.type);
        clientClash([holdOf(input.day, input.time, minutes, 30)]);
        if (state.calendar.some((e) => e.status === 'confirmed' && e.start < start + (minutes + 30) * 60e3 && start < e.start + (e.minutes + 30) * 60e3)) {
          throw new ApiFailure('conflict', 'Bu saat onaylı başka bir randevuyla çakışıyor. Önce o randevuyu silin ya da başka bir saat seçin.');
        }
        const entry: CalendarEntry = { id: Math.random().toString(36).slice(2, 10), start, minutes, kind: input.kind, ...(input.type ? { type: input.type } : {}), status: 'confirmed' };
        state.calendar.push(entry);
        const request: BookingRequest = {
          id: Math.random().toString(36).slice(2, 10), createdAt: clock(), kind: input.kind, ...(input.type ? { type: input.type } : {}), day: input.day, time: input.time,
          name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim(), note: input.note.trim(), lang: input.lang, status: 'approved', holdId: '', calendarId: entry.id, source: 'manual',
        };
        if (input.mail) mail(request.email, input.mail.subject, input.mail.body);
        state.requests.push(request);
        return { request };
      }),
    waitlistList: () => wait(() => ({ entries: [...state.waitlist].sort((a, b) => a.createdAt - b.createdAt) })),
    waitlistMail: ({ id, subject, body, remove }) =>
      wait(() => {
        const e = state.waitlist.find((x) => x.id === id);
        if (!e) throw new ApiFailure('not_found', 'Bu kişi listede bulunamadı.');
        mail(e.email, subject, body);
        state.waitlist = remove ? state.waitlist.filter((x) => x.id !== id) : state.waitlist.map((x) => (x.id === id ? { ...x, offeredAt: clock() } : x));
      }),
    waitlistRemove: (id) => wait(() => void (state.waitlist = state.waitlist.filter((x) => x.id !== id))),
    clientEnd: ({ id, mode, subject = '', body = '' }) =>
      wait(() => {
        const c = state.clients.find((x) => x.id === id);
        if (!c) throw new ApiFailure('not_found', 'Bu danışan bulunamadı.');
        if (mode !== 'delete') mail(c.contact.email, subject, body);
        state.clients = mode === 'closing' ? state.clients.map((x) => (x.id === id ? { ...x, status: 'closing' } : x)) : state.clients.filter((x) => x.id !== id);
      }),
    clientRevert: ({ id, subject, body }) =>
      wait(() => {
        const c = state.clients.find((x) => x.id === id);
        if (!c) throw new ApiFailure('not_found', 'Bu danışan bulunamadı.');
        mail(c.contact.email, subject, body);
        state.clients = state.clients.filter((x) => x.id !== id);
        if (c.origin) {
          const back: BookingRequest = { ...c.origin, id: Math.random().toString(36).slice(2, 10), createdAt: clock(), status: 'pending', calendarId: undefined, holdId: '' };
          state.requests.push({ ...back, holdId: holdAgain(back) });
        }
      }),
  };
}

/** Two made-up requests (a session and an intro call), so Randevu talepleri has something to show in dev. */
function demoRequests(now: number): BookingRequest[] {
  const day = (n: number) => {
    const d = new Date(now + n * 24 * 3600e3);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const weekend = (() => {
    const d = new Date(now + 3 * 24 * 3600e3);
    while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  return [
    { id: 'demo-1', createdAt: now - 3 * 3600e3, kind: 'session', type: 'individual', day: day(3), time: '19:20', name: 'Ayşe Örnek', email: 'ayse@example.com', phone: '0532 000 00 00', note: 'Akşam saatleri benim için daha uygun.', lang: 'tr', status: 'pending', holdId: 'demo-hold-1' },
    { id: 'demo-2', createdAt: now - 26 * 3600e3, kind: 'intro', day: weekend, time: '11:00', name: 'Mehmet Deneme', email: 'mehmet@example.com', phone: '0533 000 00 00', note: '', lang: 'tr', forWhom: 'couple', topics: [2, 3], before: 'no', age: 2, status: 'pending', holdId: 'demo-hold-2' },
    // More of them (owner's review 2026-10-21: see the page when it is busy).
    { id: 'demo-3', createdAt: now - 45 * 60e3, kind: 'intro', day: day(2), time: '10:00', name: 'Selin Kaya', email: 'selin@example.com', phone: '', note: 'Daha önce hiç terapi almadım, nasıl ilerlediğini merak ediyorum.', lang: 'tr', forWhom: 'individual', topics: [0, 1], before: 'no', age: 1, status: 'pending', holdId: 'demo-hold-3', verified: true },
    { id: 'demo-4', createdAt: now - 5 * 3600e3, kind: 'session', type: 'couple', day: day(4), time: '20:30', name: 'Can ve Ece Yıldız', email: 'can@example.com', phone: '0535 000 00 00', note: 'İkimiz de çalışıyoruz, akşam saatleri uygun.', lang: 'tr', status: 'pending', holdId: 'demo-hold-4', verified: true },
    { id: 'demo-5', createdAt: now - 9 * 3600e3, kind: 'session', type: 'accessible', day: day(5), time: '14:40', name: 'Deniz Arı', email: 'deniz@example.com', phone: '', note: 'Üniversite öğrencisiyim.', lang: 'tr', status: 'pending', holdId: 'demo-hold-5' },
    { id: 'demo-6', createdAt: now - 14 * 3600e3, kind: 'intro', day: day(6), time: '17:00', name: 'Laura Smith', email: 'laura@example.com', phone: '', note: 'I live in Istanbul but I prefer English.', lang: 'en', forWhom: 'individual', topics: [4], before: 'yes', age: 2, status: 'pending', holdId: 'demo-hold-6', verified: true },
    { id: 'demo-7', createdAt: now - 21 * 3600e3, kind: 'session', type: 'individual', day: day(7), time: '09:00', name: 'Burak Demir', email: 'burak@example.com', phone: '0536 000 00 00', note: '', lang: 'tr', status: 'pending', holdId: 'demo-hold-7' },
    { id: 'demo-8', createdAt: now - 30 * 3600e3, kind: 'intro', day: day(8), time: '12:00', name: 'Hatice Ünal', email: 'hatice@example.com', phone: '', note: 'Annem için bilgi almak istiyorum.', lang: 'tr', forWhom: 'accessible', topics: [1, 5], before: 'no', age: 4, status: 'pending', holdId: 'demo-hold-8' },
    { id: 'demo-9', createdAt: now - 2 * 864e5, kind: 'session', type: 'individual', day: day(9), time: '18:00', name: 'Ozan Er', email: 'ozan@example.com', phone: '0537 000 00 00', note: 'Haftalık düzenli görüşme istiyorum.', lang: 'tr', status: 'approved', holdId: '', calendarId: 'demo-cal-9', verified: true },
    { id: 'demo-10', createdAt: now - 3 * 864e5, kind: 'intro', day: day(1), time: '15:00', name: 'Nilay Taş', email: 'nilay@example.com', phone: '', note: '', lang: 'tr', forWhom: 'individual', topics: [2], before: 'yes', age: 1, status: 'approved', holdId: '', calendarId: 'demo-cal-10', verified: true },
  ];
}

/** Deterministic demo counts for the last 120 days, so the dashboard has something to show in dev. */
export function demoStats(files: Map<string, { content: string }>, now: number): StatsSummary {
  const slugs: string[] = [];
  const keys: string[] = [];
  for (const [p, f] of files) {
    const m = /^src\/content\/posts\/([a-z0-9-]+)\/tr\.md$/.exec(p);
    const slug = /\nslug:\s*['"]?([a-z0-9-]+)/.exec(f.content)?.[1];
    if (m && slug) {
      keys.push(m[1]);
      slugs.push(slug);
    }
  }
  const pages = ['/', '/hakkimda/', '/blog/', '/iletisim/', '/randevu/', '/sik-sorulan-sorular/', '/en/', '/kaynaklar/'];
  const refs = ['direct', 'instagram.com', 'l.instagram.com', 'google.com', 'google.com.tr', 't.co', 'linkedin.com', 'bing.com'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const days: StatsSummary['days'] = {};
  const day0 = new Date(now + 3 * 3600e3).toISOString().slice(0, 10);
  for (let i = 119; i >= 0; i--) {
    const d = new Date(Date.parse(`${day0}T00:00:00Z`) - i * 86400e3).toISOString().slice(0, 10);
    const trend = 0.6 + (119 - i) / 120;
    const weekend = [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()) ? 0.7 : 1;
    const c: Record<string, number> = {};
    const add = (k: string, n: number) => n > 0 && (c[k] = (c[k] ?? 0) + Math.round(n));
    pages.forEach((p, j) => add(`v|${p}`, (40 / (j + 1)) * trend * weekend * (0.6 + rnd())));
    slugs.forEach((s, j) => {
      const v = (18 / (j + 1)) * trend * weekend * (0.5 + rnd());
      add(`v|/blog/${s}/`, v);
      add(`rd|${keys[j]}`, v * (0.35 + rnd() * 0.3));
    });
    const views = Object.entries(c).reduce((sum, [k, n]) => (k.startsWith('v|') ? sum + n : sum), 0);
    refs.forEach((r, j) => add(`ref|${r}`, (views * [0.38, 0.22, 0.08, 0.16, 0.06, 0.03, 0.04, 0.03][j]) * (0.8 + rnd() * 0.4)));
    add('dev|m', views * 0.68);
    add('dev|d', views * 0.27);
    add('dev|t', views * 0.05);
    add('lang|tr', views * 0.88);
    add('lang|en', views * 0.12);
    add('c|randevu', views * 0.035 * (0.6 + rnd()));
    add('c|instagram', views * 0.02 * (0.6 + rnd()));
    add('c|email', views * 0.01 * (0.6 + rnd()));
    add('c|substack', views * 0.006 * (0.6 + rnd()));
    days[d] = c;
  }
  return { days, since: Object.keys(days)[0] ?? null };
}
