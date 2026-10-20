import { createHmac, randomUUID } from 'node:crypto';
import type { FetchOpts, FetchResult, FileKind, FileLike, FolderLike, Gas, MailMessage } from '../../../apps-script/src/gas';

export type Route = (url: string, opts: FetchOpts) => FetchResult | undefined;

export const json = (code: number, body: unknown, headers: Record<string, string> = {}): FetchResult => ({
  code,
  text: JSON.stringify(body),
  headers,
});

/** In-memory Drive folder tree. */
export class MemFolder implements FolderLike {
  files = new Map<string, MemFile>();
  folders = new Map<string, MemFolder>();
  trashed = false;
  constructor(readonly id: string, readonly name: string) {}
  getId() { return this.id; }
  findFile(name: string) {
    const f = this.files.get(name);
    return f && !f.trashed ? f : null;
  }
  createFile(name: string, content: string, _kind?: FileKind) {
    const f = new MemFile(name, content);
    this.files.set(name, f);
    return f;
  }
  listFiles() { return [...this.files.values()].filter((f) => !f.trashed); }
  findFolder(name: string) {
    const f = this.folders.get(name);
    return f && !f.trashed ? f : null;
  }
  createFolder(name: string) {
    const f = new MemFolder(`${this.id}/${name}`, name);
    this.folders.set(name, f);
    return f;
  }
  trash() { this.trashed = true; }
}

export class MemFile implements FileLike {
  trashed = false;
  constructor(readonly name: string, public content: string) {}
  getName() { return this.name; }
  read() { return this.content; }
  write(content: string) { this.content = content; }
  trash() { this.trashed = true; }
}

export function fakeGas(init: { props?: Record<string, string>; routes?: Route[]; now?: number; aliases?: string[] } = {}) {
  const props = new Map(Object.entries(init.props ?? {}));
  // Entries expire like CacheService: `ttlSec` after the fake clock time of the put.
  const cache = new Map<string, { value: string; until: number }>();
  const mails: MailMessage[] = [];
  const calls: { url: string; opts: FetchOpts }[] = [];
  const logs: string[] = [];
  const triggers: string[] = [];
  const routes = [...(init.routes ?? [])];
  const root = new MemFolder('root', 'Klinikterapist Panel');
  const gas: Gas & { triggerList: string[]; calls: typeof calls; logs: string[]; mails: MailMessage[]; routes: Route[]; clock: { now: number }; root: MemFolder } = {
    mails,
    triggerList: triggers,
    calls,
    logs,
    routes,
    root,
    clock: { now: init.now ?? Date.UTC(2026, 9, 17, 12) },
    fetch(url, opts = {}) {
      calls.push({ url, opts });
      for (const r of routes) {
        const res = r(url, opts);
        if (res) return res;
      }
      return json(404, { message: 'Not Found' });
    },
    fetchAll(requests) {
      return requests.map((r) => gas.fetch(r.url, r.opts));
    },
    props: { get: (k) => props.get(k) ?? null, set: (k, v) => void props.set(k, v), del: (k) => void props.delete(k) },
    cache: {
      get: (k) => {
        const e = cache.get(k);
        return e && e.until > gas.clock.now ? e.value : null;
      },
      put: (k, v, ttl) => void cache.set(k, { value: v, until: gas.clock.now + ttl * 1000 }),
    },
    withLock: (fn) => fn(),
    drive: { rootFolder: () => root },
    now() { return this.clock.now; },
    hmac: (key, data) => createHmac('sha256', key).update(data).digest('base64url'),
    uuid: () => randomUUID(),
    b64url: {
      encode: (text) => Buffer.from(text, 'utf8').toString('base64url'),
      decode: (text) => Buffer.from(text, 'base64url').toString('utf8'),
    },
    log: (msg) => void logs.push(msg),
    mail: { send: (m) => void mails.push(m), quota: () => 100 - mails.length, aliases: () => [...(init.aliases ?? [])] },
    triggers: { ensureHourly: (h) => void (triggers.includes(h) || triggers.push(h)) },
  };
  return gas;
}
