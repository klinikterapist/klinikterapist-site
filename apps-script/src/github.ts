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

export function tree(gas: Gas): { headSha: string; files: TreeEntry[] } {
  const cfg = config(gas);
  const { head, blobs } = headTree(gas, cfg);
  const files = [...blobs.values()]
    .filter((e) => TREE_PREFIXES.some((p) => e.path.startsWith(p)))
    .map((e) => ({ path: e.path, sha: e.sha, size: e.size ?? 0 }));
  return { headSha: head, files };
}

const isBinary = (path: string) => /\.(webp|jpg)$/.test(path);

export function read(gas: Gas, p: { paths?: unknown }): { files: RepoFile[] } {
  if (!Array.isArray(p.paths) || p.paths.length === 0) throw badRequest();
  const paths = p.paths.map(checkPath);
  const cfg = config(gas);
  const { head, blobs } = headTree(gas, cfg);
  const files = paths.map((path): RepoFile => {
    const entry = blobs.get(path);
    if (!entry) throw new ApiError('not_found', `Dosya bulunamadı: ${path}`);
    if (isBinary(path)) {
      const blob = callJson<{ content: string }>(gas, cfg, `/git/blobs/${entry.sha}`);
      return { path, sha: entry.sha, content: blob.content.replace(/\s/g, ''), encoding: 'base64' };
    }
    const res = call(gas, cfg, `/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${head}`, {
      accept: 'application/vnd.github.raw+json',
    });
    if (res.code !== 200) throw new ApiError('github', DOWN_MESSAGE);
    return { path, sha: entry.sha, content: res.text, encoding: 'utf8' };
  });
  return { files };
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
