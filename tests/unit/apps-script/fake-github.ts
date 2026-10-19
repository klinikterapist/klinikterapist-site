import { createHash } from 'node:crypto';
import type { FetchOpts, FetchResult } from '../../../apps-script/src/gas';
import { json } from './fake-gas';

const API = 'https://api.github.com/repos/klinikterapist/klinikterapist-site';

/** Just enough of the GitHub REST API for the backend: refs, trees, blobs, commits, contents, runs. */
export class FakeGitHub {
  /** path → base64 content of the current head. */
  files = new Map<string, string>();
  head = 'c0';
  commits: { sha: string; message: string; files: Map<string, string> }[] = [];
  blobs = new Map<string, string>();
  trees = new Map<string, Map<string, string>>();
  refUpdates = 0;
  /** Fail the next N ref updates with 422 (someone else pushed). */
  rejectRefUpdates = 0;
  status = 200;
  runs: unknown[] = [];
  tokenExpiration: string | null = '2027-10-01 09:00:00 UTC';

  constructor(seed: Record<string, string> = {}) {
    for (const [p, text] of Object.entries(seed)) this.files.set(p, Buffer.from(text).toString('base64'));
    this.trees.set('t0', new Map(this.files));
    this.commits.push({ sha: 'c0', message: 'seed', files: new Map(this.files) });
  }

  static sha(b64: string) {
    return createHash('sha1').update(b64).digest('hex');
  }

  shaOf(path: string): string | null {
    const b = this.files.get(path);
    return b === undefined ? null : FakeGitHub.sha(b);
  }

  text(path: string) {
    const b = this.files.get(path);
    return b === undefined ? undefined : Buffer.from(b, 'base64').toString('utf8');
  }

  route = (url: string, opts: FetchOpts): FetchResult | undefined => {
    if (!url.startsWith(API) && !url.startsWith('https://api.github.com/')) return undefined;
    const headers: Record<string, string> = this.tokenExpiration
      ? { 'github-authentication-token-expiration': this.tokenExpiration }
      : {};
    if (this.status !== 200) return json(this.status, { message: 'Bad credentials' }, headers);
    const method = opts.method ?? 'get';
    const body = opts.payload ? JSON.parse(opts.payload) : undefined;
    const path = url.slice(API.length);
    const commit = this.commits.find((c) => c.sha === this.head)!;

    if (method === 'get' && path === '/git/ref/heads/main') return json(200, { object: { sha: this.head } });
    let m = path.match(/^\/git\/commits\/(\w+)$/);
    if (method === 'get' && m) return json(200, { sha: m[1], tree: { sha: `t-${m[1]}` } });
    // A tree by its commit's tree sha (`t-<commit>`), or by branch name (the head's tree).
    m = path.match(/^\/git\/trees\/(t-\w+|main)\?recursive=1$/);
    if (method === 'get' && m) {
      const c = this.commits.find((x) => (m![1] === 'main' ? x.sha === this.head : `t-${x.sha}` === m![1]))!;
      return json(200, {
        truncated: false,
        tree: [...c.files].map(([p, b]) => ({ path: p, type: 'blob', sha: FakeGitHub.sha(b), size: Buffer.from(b, 'base64').length })),
      });
    }
    if (method === 'post' && path === '/git/blobs') {
      const b64 = body.encoding === 'base64' ? body.content : Buffer.from(body.content, 'utf8').toString('base64');
      const sha = FakeGitHub.sha(b64);
      this.blobs.set(sha, b64);
      return json(201, { sha });
    }
    m = path.match(/^\/git\/blobs\/(\w+)$/);
    if (method === 'get' && m) {
      const b = [...commit.files.values()].find((x) => FakeGitHub.sha(x) === m![1]);
      return b ? json(200, { content: b.replace(/(.{60})/g, '$1\n'), encoding: 'base64' }) : json(404, {});
    }
    if (method === 'post' && path === '/git/trees') {
      const baseCommit = this.commits.find((c) => `t-${c.sha}` === body.base_tree)!;
      const files = new Map(baseCommit.files);
      for (const e of body.tree) {
        if (e.sha === null) files.delete(e.path);
        else files.set(e.path, this.blobs.get(e.sha)!);
      }
      const sha = `nt${this.trees.size}`;
      this.trees.set(sha, files);
      return json(201, { sha });
    }
    if (method === 'post' && path === '/git/commits') {
      const sha = `c${this.commits.length}`;
      this.commits.push({ sha, message: body.message, files: this.trees.get(body.tree)! });
      return json(201, { sha, parents: body.parents });
    }
    if (method === 'patch' && path === '/git/refs/heads/main') {
      this.refUpdates++;
      if (this.rejectRefUpdates > 0) {
        this.rejectRefUpdates--;
        // Someone else moved the branch meanwhile.
        const other = `c${this.commits.length}`;
        this.commits.push({ sha: other, message: 'other', files: new Map(commit.files) });
        this.head = other;
        return json(422, { message: 'Update is not a fast forward' });
      }
      this.head = body.sha;
      this.files = new Map(this.commits.find((c) => c.sha === body.sha)!.files);
      return json(200, { object: { sha: body.sha } });
    }
    m = path.match(/^\/contents\/(.+)\?ref=(\w+)$/);
    if (method === 'get' && m) {
      const c = this.commits.find((x) => x.sha === m![2])!;
      const b = c.files.get(decodeURIComponent(m[1]));
      return b === undefined ? json(404, {}) : { code: 200, text: Buffer.from(b, 'base64').toString('utf8'), headers };
    }
    if (method === 'get' && path.startsWith('/actions/workflows/deploy.yml/runs')) {
      return json(200, { total_count: this.runs.length, workflow_runs: this.runs }, headers);
    }
    return json(404, { message: `fake: no route ${method} ${path}` });
  };
}
