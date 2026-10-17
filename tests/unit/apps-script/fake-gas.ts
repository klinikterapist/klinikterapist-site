import { createHmac, randomUUID } from 'node:crypto';
import type { FetchOpts, FetchResult, FileLike, FolderLike, Gas } from '../../../apps-script/src/gas';

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
  createFile(name: string, content: string) {
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

export function fakeGas(init: { props?: Record<string, string>; routes?: Route[]; now?: number } = {}) {
  const props = new Map(Object.entries(init.props ?? {}));
  const cache = new Map<string, string>();
  const calls: { url: string; opts: FetchOpts }[] = [];
  const logs: string[] = [];
  const routes = [...(init.routes ?? [])];
  const root = new MemFolder('root', 'Klinikterapist Panel');
  const gas: Gas & { calls: typeof calls; logs: string[]; routes: Route[]; clock: { now: number }; root: MemFolder } = {
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
    props: { get: (k) => props.get(k) ?? null, set: (k, v) => void props.set(k, v) },
    cache: { get: (k) => cache.get(k) ?? null, put: (k, v) => void cache.set(k, v) },
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
  };
  return gas;
}
