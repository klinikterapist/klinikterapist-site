/**
 * The contract between the admin panel and the Apps Script backend. One POST endpoint takes
 * `{ action, session?, ...params }` and always answers HTTP 200 with an `ApiResponse`.
 * Both sides import this file (Apps Script only for types).
 */
import type { JSONContent } from '@tiptap/core';
import type { Reference } from '../../lib/apa/types';

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
  /** `YYYY-MM-DD`, shared by both languages. */
  publishedAt: string;
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
};

/** One snapshot of a draft (the stored copy as it was before a later save). */
export type VersionSummary = { name: string; rev: number; savedAt: string; title: { tr: string; en: string } };

export type Session = { session: string; email: string; expiresAt: number };

/** One method per backend action. Methods throw `ApiFailure`. */
export interface Api {
  login(idToken: string): Promise<Session>;
  logout(): Promise<void>;
  tree(): Promise<{ headSha: string; files: TreeEntry[] }>;
  read(paths: string[]): Promise<{ files: RepoFile[] }>;
  commit(input: { message: string; writes: CommitWrite[]; deletes: CommitDelete[] }): Promise<{ commitSha: string }>;
  status(): Promise<SiteStatus>;
  listDrafts(): Promise<{ drafts: DraftSummary[] }>;
  getDraft(key: string): Promise<{ draft: Draft }>;
  /** Throws `ApiFailure('conflict')` with `current` set to the stored draft. */
  saveDraft(draft: Draft, opts?: { snapshot?: boolean }): Promise<{ rev: number; updatedAt: string }>;
  /** Snapshots of a draft, newest first. */
  listVersions(key: string): Promise<{ versions: VersionSummary[] }>;
  getVersion(key: string, name: string): Promise<{ draft: Draft }>;
  deleteDraft(key: string): Promise<void>;
  putImage(key: string, name: string, base64: string): Promise<void>;
  getImage(key: string, name: string): Promise<{ base64: string }>;
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
  commit: 'site.commit',
  status: 'site.status',
  listDrafts: 'drafts.list',
  getDraft: 'drafts.get',
  saveDraft: 'drafts.save',
  listVersions: 'drafts.versions',
  getVersion: 'drafts.version',
  deleteDraft: 'drafts.delete',
  putImage: 'images.put',
  getImage: 'images.get',
} as const satisfies Record<keyof Api, string>;
