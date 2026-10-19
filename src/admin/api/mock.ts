/**
 * In-memory backend for development (`/admin/?mock` in `npm run dev`) and component tests.
 * Seeded with the real settings files and the fixture posts. Never shipped: the panel only
 * imports it behind `import.meta.env.DEV`.
 */
import { ApiFailure, type Api, type CommitDelete, type CommitWrite, type Draft, type Encoding, type SiteStatus } from './types';
import type { StatsSummary } from '../../lib/stats-wire';

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
};

const TRASH_KEEP_MS = 30 * 24 * 60 * 60 * 1000;

export function createMockApi(opts: { latency?: number; seed?: Record<string, string>; now?: () => number; stats?: StatsSummary } = {}): Api & { state: MockState } {
  const files = new Map<string, File>();
  const put = (path: string, content: string, encoding: Encoding) => files.set(path, { content, encoding, sha: sha(content) });
  if (opts.seed) {
    for (const [p, c] of Object.entries(opts.seed)) put(p, c, /\.(webp|jpg)$/.test(p) ? 'base64' : 'utf8');
  } else {
    for (const [p, c] of Object.entries(data)) put(p.slice(1), c, 'utf8');
    for (const [p, c] of Object.entries(posts)) put(p.replace('/tests/fixtures/content/', 'src/content/posts/'), c, 'utf8');
    for (const [p, url] of Object.entries(images)) put(p.replace('/tests/fixtures/content/', 'src/content/posts/'), url.split(',')[1] ?? '', 'base64');
  }
  const state: MockState = { files, drafts: new Map(), images: new Map(), versions: new Map(), commits: [], trash: new Map() };
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
  };
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
