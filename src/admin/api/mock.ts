/**
 * In-memory backend for development (`/admin/?mock` in `npm run dev`) and component tests.
 * Seeded with the real settings files and the fixture posts. Never shipped: the panel only
 * imports it behind `import.meta.env.DEV`.
 */
import { ApiFailure, type Api, type CommitDelete, type CommitWrite, type Draft, type Encoding, type SiteStatus } from './types';

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
};

export function createMockApi(opts: { latency?: number; seed?: Record<string, string>; now?: () => number } = {}): Api & { state: MockState } {
  const files = new Map<string, File>();
  const put = (path: string, content: string, encoding: Encoding) => files.set(path, { content, encoding, sha: sha(content) });
  if (opts.seed) {
    for (const [p, c] of Object.entries(opts.seed)) put(p, c, /\.(webp|jpg)$/.test(p) ? 'base64' : 'utf8');
  } else {
    for (const [p, c] of Object.entries(data)) put(p.slice(1), c, 'utf8');
    for (const [p, c] of Object.entries(posts)) put(p.replace('/tests/fixtures/content/', 'src/content/posts/'), c, 'utf8');
    for (const [p, url] of Object.entries(images)) put(p.replace('/tests/fixtures/content/', 'src/content/posts/'), url.split(',')[1] ?? '', 'base64');
  }
  const state: MockState = { files, drafts: new Map(), images: new Map(), versions: new Map(), commits: [] };
  let head = 1;
  let status: SiteStatus = { state: 'success', commitSha: 'c1', url: null, updatedAt: null, tokenExpiresAt: '2027-10-01T09:00:00.000Z' };
  let pollsSinceCommit = 0;

  const clock = opts.now ?? Date.now;

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
          .map((d) => ({ key: d.key, rev: d.rev, updatedAt: d.updatedAt, published: d.published, category: d.category, title: { tr: d.tr.title, en: d.en.title } }))
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
          .reverse()
          .map((v) => ({ name: v.name, rev: v.draft.rev, savedAt: new Date(v.at).toISOString(), title: { tr: v.draft.tr.title, en: v.draft.en.title } })),
      })),
    getVersion: (key, name) =>
      wait(() => {
        const v = state.versions.get(key)?.find((x) => x.name === name);
        if (!v) throw new ApiFailure('not_found', 'Bu sürüm bulunamadı. 30 günden eski sürümler silinir.');
        return { draft: structuredClone(v.draft) };
      }),
    deleteDraft: (key) =>
      wait(() => {
        state.drafts.delete(key);
        state.versions.delete(key);
        for (const k of [...state.images.keys()]) if (k.startsWith(`${key}/`)) state.images.delete(k);
      }),
    putImage: (key, name, base64) => wait(() => void state.images.set(`${key}/${name}`, base64)),
    getImage: (key, name) =>
      wait(() => {
        const b = state.images.get(`${key}/${name}`);
        if (b === undefined) throw new ApiFailure('not_found', 'Görsel bulunamadı.');
        return { base64: b };
      }),
  };
}
