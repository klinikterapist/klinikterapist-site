import { describe, it, expect } from 'vitest';
import { commit, read, snapshot, status, tree } from '../../../apps-script/src/github';
import { ApiError } from '../../../apps-script/src/respond';
import { fakeGas } from './fake-gas';
import { FakeGitHub } from './fake-github';

const props = { GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'klinikterapist/klinikterapist-site', GITHUB_BRANCH: 'main' };
const seed = {
  'src/data/contact.json': '{"a":1}\n',
  'src/content/posts/eski/tr.md': '---\ntitle: "Eski"\n---\nMetin\n',
  'src/content/posts/eski/cover.webp': 'binary-cover',
  '.github/workflows/deploy.yml': 'name: x',
  'src/pages/index.astro': '---',
};

function setup() {
  const gh = new FakeGitHub(seed);
  const gas = fakeGas({ props, routes: [gh.route] });
  return { gh, gas };
}

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected an ApiError');
};

describe('tree and read', () => {
  it('lists only the panel-managed folders', () => {
    const { gas } = setup();
    const t = tree(gas);
    expect(t.headSha).toBe('c0');
    expect(t.files.map((f) => f.path).sort()).toEqual(['src/content/posts/eski/cover.webp', 'src/content/posts/eski/tr.md', 'src/data/contact.json']);
  });
  it('reads text as utf8 and images as base64 without line breaks', () => {
    const { gas } = setup();
    const { files } = read(gas, { paths: ['src/data/contact.json', 'src/content/posts/eski/cover.webp'] });
    expect(files[0]).toMatchObject({ path: 'src/data/contact.json', encoding: 'utf8', content: '{"a":1}\n' });
    expect(files[1].encoding).toBe('base64');
    expect(Buffer.from(files[1].content, 'base64').toString()).toBe('binary-cover');
    expect(files[1].content).not.toContain('\n');
  });
  it('refuses to read outside the allow-list', () => {
    const { gas } = setup();
    expect(errorOf(() => read(gas, { paths: ['.github/workflows/deploy.yml'] })).code).toBe('forbidden_path');
  });
  it('reports a missing file as not_found', () => {
    const { gas } = setup();
    expect(errorOf(() => read(gas, { paths: ['src/data/yok.json'] })).code).toBe('not_found');
  });
});

describe('commit', () => {
  it.each(['.github/workflows/deploy.yml', 'src/pages/x.astro', '../x', 'src/data/../../x.json', 'src/content/posts/a/b/c.md', 'public/CNAME'])(
    'rejects %s without calling GitHub',
    (path) => {
      const { gas } = setup();
      const e = errorOf(() => commit(gas, { message: 'x', writes: [{ path, content: 'x', encoding: 'utf8', expectSha: null }], deletes: [] }));
      expect(e.code).toBe('forbidden_path');
      expect(gas.calls).toHaveLength(0);
    },
  );

  it('writes and deletes in exactly one commit', () => {
    const { gh, gas } = setup();
    const res = commit(gas, {
      message: 'Yazı yayınlandı',
      writes: [
        { path: 'src/data/contact.json', content: '{"a":2}\n', encoding: 'utf8', expectSha: gh.shaOf('src/data/contact.json') },
        { path: 'src/content/posts/yeni/gorsel.webp', content: Buffer.from('img').toString('base64'), encoding: 'base64', expectSha: null },
      ],
      deletes: [{ path: 'src/content/posts/eski/cover.webp', expectSha: gh.shaOf('src/content/posts/eski/cover.webp')! }],
    });
    expect(res.commitSha).toBe(gh.head);
    expect(gh.commits).toHaveLength(2);
    expect(gh.refUpdates).toBe(1);
    expect(gh.text('src/data/contact.json')).toBe('{"a":2}\n');
    expect(gh.text('src/content/posts/yeni/gorsel.webp')).toBe('img');
    expect(gh.files.has('src/content/posts/eski/cover.webp')).toBe(false);
    expect(gh.commits[1].message).toBe('Yazı yayınlandı\n\n(Yönetim paneli)');
  });

  it('accepts JPEG images in a post folder (iPhone uploads)', () => {
    const { gh, gas } = setup();
    commit(gas, { message: 'x', writes: [{ path: 'src/content/posts/yeni/kapak.jpg', content: 'SlBH', encoding: 'base64', expectSha: null }], deletes: [] });
    expect(gh.files.has('src/content/posts/yeni/kapak.jpg')).toBe(true);
  });

  it('a stale expectSha is a conflict and the branch does not move', () => {
    const { gh, gas } = setup();
    const e = errorOf(() =>
      commit(gas, { message: 'x', writes: [{ path: 'src/data/contact.json', content: '{}', encoding: 'utf8', expectSha: 'stale' }], deletes: [] }),
    );
    expect(e.code).toBe('conflict');
    expect(e.message).toContain('src/data/contact.json');
    expect(gh.refUpdates).toBe(0);
  });

  it('expectSha null for an existing file is a conflict', () => {
    const { gas } = setup();
    expect(
      errorOf(() => commit(gas, { message: 'x', writes: [{ path: 'src/data/contact.json', content: '{}', encoding: 'utf8', expectSha: null }], deletes: [] }))
        .code,
    ).toBe('conflict');
  });

  it('retries once when the branch moved meanwhile', () => {
    const { gh, gas } = setup();
    gh.rejectRefUpdates = 1;
    commit(gas, { message: 'x', writes: [{ path: 'src/data/seo.json', content: '{}', encoding: 'utf8', expectSha: null }], deletes: [] });
    expect(gh.refUpdates).toBe(2);
    expect(gh.text('src/data/seo.json')).toBe('{}');
  });

  it('an empty commit is a bad request', () => {
    const { gas } = setup();
    expect(errorOf(() => commit(gas, { message: 'x', writes: [], deletes: [] })).code).toBe('bad_request');
  });

  it('a rejected token gets the Turkish renewal message', () => {
    const { gh, gas } = setup();
    gh.status = 401;
    const e = errorOf(() => tree(gas));
    expect(e.code).toBe('github_token');
    expect(e.message).toMatch(/GitHub bağlantı anahtarı/);
  });

  it('other GitHub failures say nothing was saved', () => {
    const { gh, gas } = setup();
    gh.status = 502;
    const e = errorOf(() => tree(gas));
    expect(e.code).toBe('github');
    expect(e.message).toMatch(/kaydedilmedi/);
  });
});

describe('status', () => {
  const run = (status: string, conclusion: string | null) => ({
    status, conclusion, head_sha: 'c9', html_url: 'https://github.com/run/1', updated_at: '2026-10-17T12:00:00Z',
  });
  it.each([
    [run('in_progress', null), 'in_progress'],
    [run('queued', null), 'queued'],
    [run('completed', 'success'), 'success'],
    [run('completed', 'failure'), 'failure'],
    [run('completed', 'cancelled'), 'failure'],
  ])('maps %o to %s', (r, state) => {
    const { gh, gas } = setup();
    gh.runs = [r];
    expect(status(gas)).toMatchObject({ state, commitSha: 'c9', url: 'https://github.com/run/1' });
  });
  it('no runs is unknown, and the token expiry is reported', () => {
    const { gas } = setup();
    expect(status(gas)).toEqual({ state: 'unknown', commitSha: null, url: null, updatedAt: null, tokenExpiresAt: '2027-10-01T09:00:00.000Z' });
  });
});

describe('snapshot (one call for the posts screens)', () => {
  it('returns the tree and the text of every post and data file the screens need', () => {
    const gh = new FakeGitHub({
      ...seed,
      'src/content/posts/eski/en.md': '---\ntitle: "Old"\n---\nText\n',
      'src/data/categories.json': '[]\n',
      'src/data/seo.json': '{}\n',
    });
    const gas = fakeGas({ props, routes: [gh.route] });
    const s = snapshot(gas);
    expect(s.headSha).toBe('c0');
    expect(s.files.some((f) => f.path === 'src/content/posts/eski/cover.webp')).toBe(true);
    expect(s.contents.map((f) => f.path).sort()).toEqual([
      'src/content/posts/eski/en.md',
      'src/content/posts/eski/tr.md',
      'src/data/categories.json',
      'src/data/seo.json',
    ]);
    expect(s.contents.find((f) => f.path === 'src/content/posts/eski/tr.md')?.content).toContain('title: "Eski"');
  });

  it('reads the head and its tree together, and all files together, not one by one', () => {
    const { gas } = setup();
    const batches: number[] = [];
    const original = gas.fetchAll.bind(gas);
    gas.fetchAll = (reqs) => {
      batches.push(reqs.length);
      return original(reqs);
    };
    snapshot(gas);
    // One batch for head + tree, one for the file contents: two round trips in all.
    expect(batches).toEqual([2, 1]);
  });
});
