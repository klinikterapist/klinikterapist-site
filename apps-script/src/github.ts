/**
 * Reads and writes the public site repo with the token kept in Script Properties. Every change
 * is one atomic commit (Git Data API), limited to the files the panel manages.
 */
import type { CommitDelete, CommitWrite, Encoding, RepoFile, SiteStatus, TreeEntry } from '../../src/admin/api/types';
import type { FetchOpts, FetchResult, Gas } from './gas';
import { ApiError, badRequest } from './respond';

/** The only paths the panel may read or change. Anything else (workflows, pages, CNAME) is refused. */
export const ALLOWED_PATH =
  /^(src\/content\/posts\/[a-z0-9-]+\/[a-z0-9-]+\.(md|webp|jpg)|src\/data\/[a-z0-9-]+\.json|src\/data\/legal\/[a-z]+\.(tr|en)\.md|public\/images\/[a-z0-9-]+(\/[a-z0-9-]+)*\.(webp|jpg))$/;
const TREE_PREFIXES = ['src/content/posts/', 'src/data/', 'public/images/'];

const TOKEN_MESSAGE =
  "GitHub bağlantı anahtarının süresi dolmuş ya da geçersiz. Kurulum rehberindeki 'GitHub anahtarı' adımını yenileyin.";
const DOWN_MESSAGE = 'GitHub şu an yanıt vermiyor. Değişikliğiniz kaydedilmedi; birkaç dakika sonra tekrar deneyin.';

type Cfg = { token: string; repo: string; branch: string };

function config(gas: Gas): Cfg {
  const token = gas.props.get('GITHUB_TOKEN');
  if (!token) throw new ApiError('github_token', TOKEN_MESSAGE);
  return { token, repo: gas.props.get('GITHUB_REPO') ?? 'klinikterapist/klinikterapist-site', branch: gas.props.get('GITHUB_BRANCH') ?? 'main' };
}

function call(gas: Gas, cfg: Cfg, path: string, opts: FetchOpts & { accept?: string } = {}): FetchResult {
  const res = gas.fetch(`https://api.github.com/repos/${cfg.repo}${path}`, {
    method: opts.method,
    payload: opts.payload,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: opts.accept ?? 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.code === 401) throw new ApiError('github_token', TOKEN_MESSAGE);
  return res;
}

function callJson<T>(gas: Gas, cfg: Cfg, path: string, opts: FetchOpts = {}): T {
  const res = call(gas, cfg, path, opts);
  if (res.code < 200 || res.code >= 300) {
    gas.log(`GitHub ${opts.method ?? 'get'} ${path} → ${res.code}`);
    throw new ApiError('github', DOWN_MESSAGE);
  }
  return JSON.parse(res.text) as T;
}

function checkPath(path: unknown): string {
  if (typeof path !== 'string' || !ALLOWED_PATH.test(path)) {
    throw new ApiError('forbidden_path', `Panel bu dosyayı değiştiremez: ${String(path)}`);
  }
  return path;
}

type GitTree = { tree: { path: string; type: string; sha: string; size?: number }[]; truncated: boolean };

function headTree(gas: Gas, cfg: Cfg) {
  const head = callJson<{ object: { sha: string } }>(gas, cfg, `/git/ref/heads/${cfg.branch}`).object.sha;
  const treeSha = callJson<{ tree: { sha: string } }>(gas, cfg, `/git/commits/${head}`).tree.sha;
  const t = callJson<GitTree>(gas, cfg, `/git/trees/${treeSha}?recursive=1`);
  if (t.truncated) gas.log('GitHub tree truncated');
  const blobs = new Map(t.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e]));
  return { head, treeSha, blobs };
}

const headers = (cfg: Cfg, accept = 'application/vnd.github+json') => ({
  Authorization: `Bearer ${cfg.token}`,
  Accept: accept,
  'X-GitHub-Api-Version': '2022-11-28',
});

/**
 * The branch head and its file tree in one round trip (two requests at once). Reading only: a
 * commit still uses `headTree`, whose tree is guaranteed to belong to the head it returns.
 */
function headTreeFast(gas: Gas, cfg: Cfg) {
  const base = `https://api.github.com/repos/${cfg.repo}`;
  const [ref, tree] = gas.fetchAll([
    { url: `${base}/git/ref/heads/${cfg.branch}`, opts: { headers: headers(cfg) } },
    { url: `${base}/git/trees/${encodeURIComponent(cfg.branch)}?recursive=1`, opts: { headers: headers(cfg) } },
  ]);
  for (const res of [ref, tree]) {
    if (res.code === 401) throw new ApiError('github_token', TOKEN_MESSAGE);
    if (res.code < 200 || res.code >= 300) {
      gas.log(`GitHub head/tree → ${res.code}`);
      throw new ApiError('github', DOWN_MESSAGE);
    }
  }
  const head = (JSON.parse(ref.text) as { object: { sha: string } }).object.sha;
  const t = JSON.parse(tree.text) as GitTree;
  if (t.truncated) gas.log('GitHub tree truncated');
  const blobs = new Map(t.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e]));
  return { head, blobs };
}

export function tree(gas: Gas): { headSha: string; files: TreeEntry[] } {
  const cfg = config(gas);
  const { head, blobs } = headTreeFast(gas, cfg);
  return { headSha: head, files: listed(blobs) };
}

const listed = (blobs: Map<string, { path: string; sha: string; size?: number }>): TreeEntry[] =>
  [...blobs.values()]
    .filter((e) => TREE_PREFIXES.some((p) => e.path.startsWith(p)))
    .map((e) => ({ path: e.path, sha: e.sha, size: e.size ?? 0 }));

const isBinary = (path: string) => /\.(webp|jpg)$/.test(path);

/** The given files at `head`, fetched all at once. */
function readAt(gas: Gas, cfg: Cfg, head: string, blobs: Map<string, { sha: string }>, paths: string[]): RepoFile[] {
  const base = `https://api.github.com/repos/${cfg.repo}`;
  const entries = paths.map((path) => {
    const entry = blobs.get(path);
    if (!entry) throw new ApiError('not_found', `Dosya bulunamadı: ${path}`);
    return { path, sha: entry.sha };
  });
  const results = gas.fetchAll(
    entries.map(({ path, sha }) =>
      isBinary(path)
        ? { url: `${base}/git/blobs/${sha}`, opts: { headers: headers(cfg) } }
        : { url: `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${head}`, opts: { headers: headers(cfg, 'application/vnd.github.raw+json') } },
    ),
  );
  return entries.map(({ path, sha }, i) => {
    const res = results[i];
    if (res.code === 401) throw new ApiError('github_token', TOKEN_MESSAGE);
    if (res.code !== 200) {
      gas.log(`GitHub read ${path} → ${res.code}`);
      throw new ApiError('github', DOWN_MESSAGE);
    }
    if (isBinary(path)) {
      return { path, sha, content: (JSON.parse(res.text) as { content: string }).content.replace(/\s/g, ''), encoding: 'base64' };
    }
    return { path, sha, content: res.text, encoding: 'utf8' };
  });
}

export function read(gas: Gas, p: { paths?: unknown }): { files: RepoFile[] } {
  if (!Array.isArray(p.paths) || p.paths.length === 0) throw badRequest();
  const paths = p.paths.map(checkPath);
  const cfg = config(gas);
  const { head, blobs } = headTreeFast(gas, cfg);
  return { files: readAt(gas, cfg, head, blobs, paths) };
}

const SNAPSHOT_FILE = /^src\/content\/posts\/[a-z0-9-]+\/(tr|en)\.md$/;
const SNAPSHOT_DATA = ['src/data/redirects.json', 'src/data/categories.json', 'src/data/seo.json'];

/**
 * Everything the posts screens need in one call: the tree, and the text of every post and of the
 * three data files they use. Replaces `site.tree` followed by `site.read` (two calls, one file at a
 * time), which made the panel's home and posts screens slow.
 */
export function snapshot(gas: Gas): { headSha: string; files: TreeEntry[]; contents: RepoFile[] } {
  const cfg = config(gas);
  const { head, blobs } = headTreeFast(gas, cfg);
  const wanted = [...blobs.keys()].filter((path) => SNAPSHOT_FILE.test(path) || SNAPSHOT_DATA.includes(path));
  return { headSha: head, files: listed(blobs), contents: readAt(gas, cfg, head, blobs, wanted) };
}

type CommitInput = { message?: unknown; writes?: unknown; deletes?: unknown };

function parseCommit(p: CommitInput): { message: string; writes: CommitWrite[]; deletes: CommitDelete[] } {
  if (typeof p.message !== 'string' || !p.message.trim() || !Array.isArray(p.writes) || !Array.isArray(p.deletes)) throw badRequest();
  const writes = (p.writes as CommitWrite[]).map((w) => {
    if (!w || typeof w.content !== 'string' || (w.encoding !== 'utf8' && w.encoding !== 'base64')) throw badRequest();
    if (w.expectSha !== null && typeof w.expectSha !== 'string') throw badRequest();
    return { path: checkPath(w.path), content: w.content, encoding: w.encoding as Encoding, expectSha: w.expectSha };
  });
  const deletes = (p.deletes as CommitDelete[]).map((d) => {
    if (!d || typeof d.expectSha !== 'string') throw badRequest();
    return { path: checkPath(d.path), expectSha: d.expectSha };
  });
  if (writes.length + deletes.length === 0) throw badRequest('Kaydedilecek bir değişiklik yok.');
  const all = [...writes, ...deletes].map((x) => x.path);
  if (new Set(all).size !== all.length) throw badRequest('Aynı dosya bir değişiklikte iki kez yer alamaz.');
  return { message: p.message.trim(), writes, deletes };
}

const conflict = (path: string) =>
  new ApiError('conflict', `"${path}" siz düzenlerken başka bir yerde değişmiş. Sayfayı yenileyip tekrar deneyin.`);

export function commit(gas: Gas, p: CommitInput): { commitSha: string } {
  const input = parseCommit(p);
  const cfg = config(gas);
  return gas.withLock(() => {
    for (let attempt = 0; ; attempt++) {
      const { head, treeSha, blobs } = headTree(gas, cfg);
      for (const w of input.writes) {
        const current = blobs.get(w.path)?.sha ?? null;
        if (current !== w.expectSha) throw conflict(w.path);
      }
      for (const d of input.deletes) {
        if (blobs.get(d.path)?.sha !== d.expectSha) throw conflict(d.path);
      }
      const entries = [
        ...input.writes.map((w) => {
          const blob = callJson<{ sha: string }>(gas, cfg, '/git/blobs', {
            method: 'post',
            payload: JSON.stringify({ content: w.content, encoding: w.encoding === 'utf8' ? 'utf-8' : 'base64' }),
          });
          return { path: w.path, mode: '100644', type: 'blob', sha: blob.sha };
        }),
        ...input.deletes.map((d) => ({ path: d.path, mode: '100644', type: 'blob', sha: null })),
      ];
      const newTree = callJson<{ sha: string }>(gas, cfg, '/git/trees', {
        method: 'post',
        payload: JSON.stringify({ base_tree: treeSha, tree: entries }),
      });
      const created = callJson<{ sha: string }>(gas, cfg, '/git/commits', {
        method: 'post',
        payload: JSON.stringify({ message: `${input.message}\n\n(Yönetim paneli)`, tree: newTree.sha, parents: [head] }),
      });
      const res = call(gas, cfg, `/git/refs/heads/${cfg.branch}`, {
        method: 'patch',
        payload: JSON.stringify({ sha: created.sha, force: false }),
      });
      if (res.code >= 200 && res.code < 300) return { commitSha: created.sha };
      if (res.code === 422 && attempt === 0) continue;
      gas.log(`GitHub ref update → ${res.code}`);
      throw new ApiError('github', DOWN_MESSAGE);
    }
  });
}

/** `2027-10-01 09:00:00 UTC` / `… +0300` → ISO, or null. */
function expiryIso(header: string | undefined): string | null {
  const m = header?.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) (UTC|[+-]\d{4})$/);
  if (!m) return null;
  const zone = m[3] === 'UTC' ? 'Z' : `${m[3].slice(0, 3)}:${m[3].slice(3)}`;
  const d = new Date(`${m[1]}T${m[2]}${zone}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type Run = { status: string; conclusion: string | null; head_sha: string; html_url: string; updated_at: string };

export function status(gas: Gas): SiteStatus {
  const cfg = config(gas);
  const res = call(gas, cfg, `/actions/workflows/deploy.yml/runs?branch=${cfg.branch}&per_page=1`);
  if (res.code !== 200) throw new ApiError('github', DOWN_MESSAGE);
  const tokenExpiresAt = expiryIso(res.headers['github-authentication-token-expiration']);
  const run = (JSON.parse(res.text) as { workflow_runs: Run[] }).workflow_runs[0];
  if (!run) return { state: 'unknown', commitSha: null, url: null, updatedAt: null, tokenExpiresAt };
  const state: SiteStatus['state'] =
    run.status === 'completed'
      ? run.conclusion === 'success'
        ? 'success'
        : 'failure'
      : run.status === 'in_progress'
        ? 'in_progress'
        : 'queued';
  return { state, commitSha: run.head_sha, url: run.html_url, updatedAt: run.updated_at, tokenExpiresAt };
}
