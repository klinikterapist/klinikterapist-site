/**
 * The contract between the admin panel and the Apps Script backend. One POST endpoint takes
 * `{ action, session?, ...params }` and always answers HTTP 200 with an `ApiResponse`.
 * Both sides import this file (Apps Script only for types).
 */
import type { StatsSummary } from '../../lib/stats-wire';
import type { JSONContent } from '@tiptap/core';
import type { Reference } from '../../lib/apa/types';
import type { CropArea } from '../../lib/crop-area';
import type { SessionRecord, SessionStatus } from '../../lib/sessions';
import type { PaymentSettings } from '../../lib/payment';

export type ErrorCode =
  | 'unauthorized'
  | 'forbidden_path'
  | 'conflict'
  | 'not_found'
  | 'github'
  | 'github_token'
  | 'bad_request'
  | 'internal'
  /** Panel side only: the request never reached the backend. */
  | 'network';

export type ApiResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string }; data?: unknown };

export type Encoding = 'utf8' | 'base64';

export type RepoFile = { path: string; sha: string; content: string; encoding: Encoding };
export type TreeEntry = { path: string; sha: string; size: number };

/** `expectSha: null` = the file must not exist yet. A mismatch is a `conflict`. */
export type CommitWrite = { path: string; content: string; encoding: Encoding; expectSha: string | null };
export type CommitDelete = { path: string; expectSha: string };

export type SiteStatus = {
  state: 'queued' | 'in_progress' | 'success' | 'failure' | 'unknown';
  commitSha: string | null;
  url: string | null;
  updatedAt: string | null;
  /** When the GitHub token expires (ISO), if GitHub reports it. */
  tokenExpiresAt: string | null;
};

export type LangFields = {
  title: string;
  /** Optional line under the title; shown on the post page instead of the description. */
  subtitle: string;
  seoTitle: string;
  slug: string;
  /** The owner edited the slug by hand: stop deriving it from the title. */
  slugTouched: boolean;
  description: string;
  focusKeyword: string;
  coverAlt: string;
  doc: JSONContent;
  /** Works cited in this language's text. */
  references: Reference[];
};

export type Draft = {
  key: string;
  /** Revision the stored copy has; a save must send the rev it was based on. 0 = never saved. */
  rev: number;
  updatedAt: string;
  /** A live version of this post exists in the repo. */
  published: boolean;
  category: string;
  /** Image name of the cover (`cover.webp`), or null. */
  cover: string | null;
  /** The uncropped upload kept next to the cover (`cover-orig.webp`), so the crop can be changed; null for older covers. */
  coverOriginal: string | null;
  /** The 16:9 frame chosen in "Kapağı ayarla", in percent of the original; null = centred. */
  coverCrop: CropArea | null;
  /** Planned publish time, an instant with offset (`2026-10-24T09:00:00+03:00`); null or missing = not planned. */
  scheduledAt?: string | null;
  /** `YYYY-MM-DD`, shared by both languages. */
  publishedAt: string;
  /** Shown as a featured post on the site; omitted (not false) when off. */
  featured?: boolean;
  tr: LangFields;
  en: LangFields;
  /** For an edit of a live post: the blob shas of tr.md / en.md it started from. */
  base?: { tr: string; en: string } | null;
};

export type DraftSummary = {
  key: string;
  rev: number;
  updatedAt: string;
  published: boolean;
  category: string;
  title: { tr: string; en: string };
  scheduledAt?: string | null;
  /** Why the last planned publish failed (it is retried every hour); null when it did not fail. */
  scheduleError?: string | null;
};

/** A deleted draft in the panel's trash: removed for good at `purgeAt` (30 days after `deletedAt`). */
export type TrashItem = DraftSummary & { deletedAt: string; purgeAt: string };

/**
 * One taken time in the booking calendar: times, length and kind only (no names). `hold`: a request's
 * 24-hour hold; `confirmed`: put in the calendar by the owner.
 */
export type CalendarEntry = {
  id: string;
  /** Epoch ms. */
  start: number;
  minutes: number;
  kind: 'session' | 'intro';
  type?: string;
  /** `closed`: a stretch the owner closed with "Saat kapat" (Faz 2): taken on the site, no rest added. */
  status: 'hold' | 'confirmed' | 'closed';
  holdUntil?: number;
  /** For a closed stretch: the owner's own note ("izin", "kongre"). */
  note?: string;
};

/**
 * A request sent from the site's booking or intro-call form, kept in the owner's Drive until the
 * owner decides (owner's decision 2026-10-20): declined or cancelled ones are deleted when the
 * e-mail goes; approved ones when the person moves to Randevu takibi; any of them after 30 days.
 */
export type BookingRequest = {
  id: string;
  createdAt: number;
  kind: 'session' | 'intro';
  type?: string;
  day: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  lang: 'tr' | 'en';
  forWhom?: string;
  topics?: number[];
  before?: 'yes' | 'no' | '';
  age?: number;
  status: 'pending' | 'approved';
  /** The 24-hour hold the request put in the calendar. */
  holdId: string;
  /** The calendar entry made when it was approved. */
  calendarId?: string;
  /** The person opened the link in the acknowledgement e-mail: the address is right. */
  verified?: boolean;
  /** An approved one-off appointment got its 72-hour reminder (Faz 1). */
  reminded?: boolean;
  /** The owner was told its 24-hour hold is running out (review E3); told once. */
  holdWarned?: boolean;
  /** `manual`: the owner put it in with "Randevu ekle". */
  source?: 'site' | 'manual';
};

/** Bildirimler (Faz 2): what happened. `link`: a panel route (`#/…`) to the place it concerns. */
export type PanelEventKind = 'request' | 'decision' | 'client' | 'payment' | 'reminder' | 'waitlist' | 'info';
export type PanelEvent = { id: string; at: number; kind: PanelEventKind; text: string; link?: string };

/** "Haber et": someone who wants a time when one frees up (booking closed). Kept at most 90 days. */
export type WaitlistEntry = {
  id: string;
  createdAt: number;
  name: string;
  email: string;
  phone: string;
  kinds: string[];
  times: string[];
  reason: string;
  lang: 'tr' | 'en';
  verified?: boolean;
  /** The owner wrote to them about a free time (they stay on the list). */
  offeredAt?: number;
};

/** "Randevu ekle": an appointment the owner puts in by hand, with the person's name and e-mail. */
export type ManualAppointment = {
  kind: 'session' | 'intro';
  type?: string;
  day: string;
  time: string;
  name: string;
  email: string;
  phone: string;
  lang: 'tr' | 'en';
  note: string;
  /** The confirmation e-mail to send, as the owner edited it; none when left out. */
  mail?: { subject: string; body: string };
};

/** A change to a client's sessions (Seans takip › the client's page). */
export type SessionChange =
  | { op: 'mark'; id: string; day: string; time: string; status: SessionStatus; by?: 'client' | 'owner'; note?: string; newDay?: string; newTime?: string }
  | { op: 'add'; id: string; kind: 'closing' | 'extra'; day: string; time: string }
  | { op: 'remove'; id: string; day: string; time: string };

export type RequestDecision = 'approve' | 'unavailable' | 'cancel';

/**
 * A client in Seans takip: a number (KT001OGO: KT, a running number, the initials) and a weekly
 * session. The name, e-mail and page language are kept, sealed in the owner's Drive, only so the
 * owner can write to them (ending therapy, an apology); they go when therapy ends.
 */
export type Client = {
  id: string;
  number: string;
  type: string;
  weekday: number;
  time: string;
  minutes: number;
  since: string;
  /** `closing`: the owner asked for a closing session; the weekly time stays until therapy ends. */
  status: 'active' | 'closing';
  contact: { name: string; email: string; lang: 'tr' | 'en'; verified?: boolean };
  /** Marks on the weekly sessions and the other sessions (intro, closing, extra). */
  sessions?: SessionRecord[];
  /** The client said on their own page that they want to end therapy (with their note). */
  endAsked?: { at: number; note?: string };
};

/** How therapy ends: `complete` (e-mail: therapy is over), `closing` (e-mail: a free closing session), `delete` (no e-mail). */
export type ClientEnd = 'complete' | 'closing' | 'delete';

/** One snapshot of a draft (the stored copy as it was before a later save). */
export type VersionSummary = { name: string; rev: number; savedAt: string };

export type Session = { session: string; email: string; expiresAt: number };

/** One method per backend action. Methods throw `ApiFailure`. */
export interface Api {
  login(idToken: string): Promise<Session>;
  logout(): Promise<void>;
  tree(): Promise<{ headSha: string; files: TreeEntry[] }>;
  read(paths: string[]): Promise<{ files: RepoFile[] }>;
  /** The tree plus every post and the data files the posts screens need, in one call. */
  snapshot(): Promise<{ headSha: string; files: TreeEntry[]; contents: RepoFile[] }>;
  commit(input: { message: string; writes: CommitWrite[]; deletes: CommitDelete[] }): Promise<{ commitSha: string }>;
  status(): Promise<SiteStatus>;
  listDrafts(): Promise<{ drafts: DraftSummary[] }>;
  getDraft(key: string): Promise<{ draft: Draft }>;
  /** Throws `ApiFailure('conflict')` with `current` set to the stored draft. */
  saveDraft(draft: Draft, opts?: { snapshot?: boolean }): Promise<{ rev: number; updatedAt: string }>;
  /** Snapshots of a draft, newest first. */
  listVersions(key: string): Promise<{ versions: VersionSummary[] }>;
  getVersion(key: string, name: string): Promise<{ draft: Draft }>;
  /** `trash`: keep it in the panel's trash for 30 days (the owner's "Taslağı sil"). */
  deleteDraft(key: string, opts?: { trash?: boolean }): Promise<void>;
  listTrash(): Promise<{ items: TrashItem[] }>;
  restoreTrash(key: string): Promise<{ draft: DraftSummary }>;
  purgeTrash(key: string): Promise<void>;
  putImage(key: string, name: string, base64: string): Promise<void>;
  getImage(key: string, name: string): Promise<{ base64: string }>;
  /** The page counter's day counts for [from, to] (Istanbul days, `YYYY-MM-DD`). */
  statsSummary(range: { from: string; to: string }): Promise<StatsSummary>;
  /** Makes sure the backend's hourly trigger (planned publishing) exists. */
  ensureTriggers(): Promise<void>;
  /** The booking calendar, soonest first. */
  calendarList(): Promise<{ entries: CalendarEntry[] }>;
  /** Puts an appointment in the calendar (`day` YYYY-MM-DD, `time` HH:MM, Istanbul). */
  calendarAdd(input: { day: string; time: string; kind: 'session' | 'intro'; type?: string }): Promise<{ entry: CalendarEntry }>;
  calendarRemove(id: string): Promise<void>;
  /** Saat kapat: a day (whole, or `from`–`to`, Istanbul) taken on the site; the appointments in it stay. */
  calendarClose(input: { day: string; from: string; to: string; note?: string }): Promise<{ entry: CalendarEntry }>;
  /** Requests from the site, oldest first. */
  requestsList(): Promise<{ requests: BookingRequest[] }>;
  /** Sends the owner's (edited) e-mail to the person and applies the decision. */
  requestDecide(input: { id: string; decision: RequestDecision; subject: string; body: string }): Promise<void>;
  /** Moves an approved request to Randevu takibi: its personal data is deleted, a client number is made. */
  requestToClient(input: { id: string; weekday?: number; time?: string; since?: string }): Promise<{ client: Client }>;
  /**
   * Geri al: an approval sent by mistake. The apology e-mail goes, the confirmed time is freed and
   * the request is pending again.
   */
  requestRevert(input: { id: string; subject: string; body: string }): Promise<void>;
  clientsList(): Promise<{ clients: Client[] }>;
  /**
   * Terapiyi sonlandır. `complete` and `delete` remove the client with their details and free the
   * weekly time (`complete` sends the owner's e-mail first); `closing` sends the closing-session
   * e-mail and marks the client.
   */
  clientEnd(input: { id: string; mode: ClientEnd; subject?: string; body?: string }): Promise<void>;
  /** Geri al: back to Randevu talepleri as a pending request, with the apology e-mail. */
  clientRevert(input: { id: string; subject: string; body: string }): Promise<void>;
  /** Marks a session (attended, cancelled …), adds a closing or extra session, or removes one. */
  clientSession(input: SessionChange): Promise<{ client: Client }>;
  /** Bildirimler: the last 90 days, newest first. */
  eventsList(): Promise<{ events: PanelEvent[] }>;
  /** The owner's fees, bank details and payment link (script properties, never in the repository). */
  paymentGet(): Promise<{ payment: PaymentSettings }>;
  paymentSet(payment: PaymentSettings): Promise<{ payment: PaymentSettings }>;
  /** A session paid or not; when paid with `mail`, the owner's thank-you goes to the client. */
  clientPay(input: { id: string; day: string; time: string; paid: boolean; mail?: { subject: string; body: string } }): Promise<{ client: Client }>;
  /** The owner's (edited) e-mail to the client, e.g. a payment reminder. */
  clientMail(input: { id: string; subject: string; body: string }): Promise<void>;
  /** The client's secret page link; `renew` makes a new one (the old one stops working). */
  clientLink(input: { id: string; renew?: boolean }): Promise<{ link: string }>;
  /** Sends the owner's (edited) e-mail with the link to the client's address. */
  clientLinkMail(input: { id: string; subject: string; body: string }): Promise<void>;
  /** Whether the site takes bookings, and how many people wait to hear of a free time. */
  bookingState(): Promise<{ open: boolean; waiting: number }>;
  /** Randevu alımını kapat / aç: closed, the site says every session is taken and offers "Haber et". */
  bookingSetOpen(open: boolean): Promise<void>;
  /** Randevu ekle: an approved request with the person's details and the time confirmed. */
  requestAdd(input: ManualAppointment): Promise<{ request: BookingRequest }>;
  waitlistList(): Promise<{ entries: WaitlistEntry[] }>;
  /** Writes to someone on the list; `remove` takes them off it (and deletes their details). */
  waitlistMail(input: { id: string; subject: string; body: string; remove?: boolean }): Promise<void>;
  /** Takes someone off the list without an e-mail. */
  waitlistRemove(id: string): Promise<void>;
}

export class ApiFailure extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    /** Extra data the backend sent with the error (e.g. the current draft on a conflict). */
    readonly current?: unknown,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

/** Action names on the wire, by `Api` method. */
export const ACTIONS = {
  login: 'auth.login',
  logout: 'auth.logout',
  tree: 'site.tree',
  read: 'site.read',
  snapshot: 'site.snapshot',
  commit: 'site.commit',
  status: 'site.status',
  listDrafts: 'drafts.list',
  getDraft: 'drafts.get',
  saveDraft: 'drafts.save',
  listVersions: 'drafts.versions',
  getVersion: 'drafts.version',
  deleteDraft: 'drafts.delete',
  listTrash: 'trash.list',
  restoreTrash: 'trash.restore',
  purgeTrash: 'trash.purge',
  putImage: 'images.put',
  getImage: 'images.get',
  statsSummary: 'stats.summary',
  ensureTriggers: 'admin.triggers',
  calendarList: 'calendar.list',
  calendarAdd: 'calendar.add',
  calendarRemove: 'calendar.remove',
  calendarClose: 'calendar.close',
  requestsList: 'requests.list',
  requestDecide: 'requests.decide',
  requestToClient: 'requests.toClient',
  requestRevert: 'requests.revert',
  clientsList: 'clients.list',
  clientEnd: 'clients.end',
  clientRevert: 'clients.revert',
  clientSession: 'clients.session',
  clientLink: 'clients.link',
  clientLinkMail: 'clients.linkMail',
  eventsList: 'events.list',
  paymentGet: 'payment.get',
  paymentSet: 'payment.set',
  clientPay: 'clients.pay',
  clientMail: 'clients.mail',
  bookingState: 'booking.state',
  bookingSetOpen: 'booking.setOpen',
  requestAdd: 'requests.add',
  waitlistList: 'waitlist.list',
  waitlistMail: 'waitlist.mail',
  waitlistRemove: 'waitlist.remove',
} as const satisfies Record<keyof Api, string>;
