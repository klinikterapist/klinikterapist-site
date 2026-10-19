/// <reference types="google-apps-script" />
/**
 * The only file that touches Apps Script globals. Everything else takes a `Gas`, so the backend
 * runs under Vitest with an in-memory fake.
 */
export type FetchOpts = {
  method?: 'get' | 'post' | 'patch' | 'put' | 'delete';
  headers?: Record<string, string>;
  payload?: string;
};
/** `headers` keys are lowercase. */
export type FetchResult = { code: number; text: string; headers: Record<string, string> };

export type FileKind = 'json' | 'image';

export interface FileLike {
  getName(): string;
  /** Text for JSON files, base64 for images. */
  read(): string;
  write(content: string): void;
  /** Moves to Drive trash (recoverable for 30 days), never a permanent delete. */
  trash(): void;
}

export interface FolderLike {
  getId(): string;
  findFile(name: string): FileLike | null;
  createFile(name: string, content: string, kind: FileKind): FileLike;
  listFiles(): FileLike[];
  findFolder(name: string): FolderLike | null;
  createFolder(name: string): FolderLike;
  trash(): void;
}

export interface DriveLike {
  /** The panel's private folder, created on first use. */
  rootFolder(): FolderLike;
}

export interface Gas {
  fetch(url: string, opts?: FetchOpts): FetchResult;
  /** Several requests at once (UrlFetchApp.fetchAll); results in the same order. */
  fetchAll(requests: { url: string; opts?: FetchOpts }[]): FetchResult[];
  props: { get(key: string): string | null; set(key: string, value: string): void; del(key: string): void };
  cache: { get(key: string): string | null; put(key: string, value: string, ttlSec: number): void };
  withLock<T>(fn: () => T): T;
  drive: DriveLike;
  now(): number;
  /** HMAC-SHA256 of `data`, base64url without padding. */
  hmac(key: string, data: string): string;
  uuid(): string;
  /** UTF-8 text ⇄ base64url without padding (Apps Script has no atob/btoa/TextEncoder). */
  b64url: { encode(text: string): string; decode(text: string): string };
  /** Error log (Apps Script executions log). Never pass request bodies here. */
  log(message: string): void;
  /** One plain-text e-mail from the deploying account (MailApp; needs the script.send_mail scope). */
  mail: { send(m: MailMessage): void };
}

export type MailMessage = { to: string; replyTo: string; subject: string; body: string; name?: string };

const ROOT_NAME = 'Klinikterapist Panel';
const JSON_MIME = 'application/json';

class GasFile implements FileLike {
  constructor(private file: GoogleAppsScript.Drive.File) {}
  getName() {
    return this.file.getName();
  }
  read() {
    const blob = this.file.getBlob();
    return this.file.getMimeType() === JSON_MIME ? blob.getDataAsString('UTF-8') : Utilities.base64Encode(blob.getBytes());
  }
  write(content: string) {
    this.file.setContent(content);
  }
  trash() {
    this.file.setTrashed(true);
  }
}

class GasFolder implements FolderLike {
  constructor(private folder: GoogleAppsScript.Drive.Folder) {}
  getId() {
    return this.folder.getId();
  }
  findFile(name: string) {
    const it = this.folder.getFilesByName(name);
    while (it.hasNext()) {
      const f = it.next();
      if (!f.isTrashed()) return new GasFile(f);
    }
    return null;
  }
  createFile(name: string, content: string, kind: FileKind) {
    const blob =
      kind === 'json'
        ? Utilities.newBlob(content, JSON_MIME, name)
        : Utilities.newBlob(Utilities.base64Decode(content), name.endsWith('.jpg') ? 'image/jpeg' : 'image/webp', name);
    return new GasFile(this.folder.createFile(blob));
  }
  listFiles() {
    const out: FileLike[] = [];
    const it = this.folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (!f.isTrashed()) out.push(new GasFile(f));
    }
    return out;
  }
  findFolder(name: string) {
    const it = this.folder.getFoldersByName(name);
    while (it.hasNext()) {
      const f = it.next();
      if (!f.isTrashed()) return new GasFolder(f);
    }
    return null;
  }
  createFolder(name: string) {
    return new GasFolder(this.folder.createFolder(name));
  }
  trash() {
    this.folder.setTrashed(true);
  }
}

function toParams(opts: FetchOpts): GoogleAppsScript.URL_Fetch.URLFetchRequestOptions {
  return {
    method: opts.method ?? 'get',
    headers: opts.headers,
    payload: opts.payload,
    contentType: opts.payload === undefined ? undefined : 'application/json',
    muteHttpExceptions: true,
  };
}

function toResult(res: GoogleAppsScript.URL_Fetch.HTTPResponse): FetchResult {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(res.getAllHeaders() as Record<string, unknown>)) headers[k.toLowerCase()] = String(v);
  return { code: res.getResponseCode(), text: res.getContentText(), headers };
}

export function realGas(): Gas {
  const props = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();
  return {
    fetch(url, opts = {}) {
      return toResult(UrlFetchApp.fetch(url, toParams(opts)));
    },
    fetchAll(requests) {
      if (requests.length === 0) return [];
      return UrlFetchApp.fetchAll(requests.map((r) => ({ url: r.url, ...toParams(r.opts ?? {}) }))).map(toResult);
    },
    props: { get: (k) => props.getProperty(k), set: (k, v) => void props.setProperty(k, v), del: (k) => void props.deleteProperty(k) },
    cache: { get: (k) => cache.get(k), put: (k, v, ttl) => cache.put(k, v, ttl) },
    withLock(fn) {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        return fn();
      } finally {
        lock.releaseLock();
      }
    },
    drive: {
      rootFolder() {
        const id = props.getProperty('DRIVE_FOLDER_ID');
        if (id) {
          try {
            const f = DriveApp.getFolderById(id);
            if (!f.isTrashed()) return new GasFolder(f);
          } catch {
            // Deleted or inaccessible: create a new one below.
          }
        }
        const folder = DriveApp.createFolder(ROOT_NAME);
        props.setProperty('DRIVE_FOLDER_ID', folder.getId());
        return new GasFolder(folder);
      },
    },
    now: () => Date.now(),
    hmac: (key, data) => Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(data, key)).replace(/=+$/, ''),
    uuid: () => Utilities.getUuid(),
    b64url: {
      encode: (text) => Utilities.base64EncodeWebSafe(text, Utilities.Charset.UTF_8).replace(/=+$/, ''),
      decode: (text) => {
        const padded = text + '='.repeat((4 - (text.length % 4)) % 4);
        return Utilities.newBlob(Utilities.base64DecodeWebSafe(padded)).getDataAsString('UTF-8');
      },
    },
    log: (message) => console.error(message),
    mail: {
      send: (m) => MailApp.sendEmail({ to: m.to, replyTo: m.replyTo, subject: m.subject, body: m.body, name: m.name }),
    },
  };
}
