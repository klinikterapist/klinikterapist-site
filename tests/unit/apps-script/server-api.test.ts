import { describe, it, expect } from 'vitest';
import { serverApi } from '../../../apps-script/src/server-api';
import { getDraft, putImage, saveDraft } from '../../../apps-script/src/drive';
import { publishDraft } from '../../../src/admin/lib/publish-flow';
import { ApiFailure } from '../../../src/admin/api/types';
import { completeDraft, ghProps, ghSeed } from './publish-fixtures';
import { fakeGas } from './fake-gas';
import { FakeGitHub } from './fake-github';

describe('serverApi', () => {
  it('publishDraft runs end to end inside the backend', async () => {
    const gh = new FakeGitHub(ghSeed);
    const gas = fakeGas({ props: ghProps, routes: [gh.route] });
    saveDraft(gas, { draft: completeDraft() });
    putImage(gas, { key: 'taslak-abc', name: 'yaprak.webp', base64: 'WUFQUkFL' });
    const draft = getDraft(gas, { key: 'taslak-abc' }).draft;
    const r = await publishDraft(serverApi(gas), draft, { now: new Date('2026-10-20T10:00:00') });
    expect(r.key).toBe('kaygi');
    expect(gh.commits).toHaveLength(2);
    expect(gh.commits[1].message.startsWith('Yazı yayınlandı: Kaygı')).toBe(true);
    expect([...gh.files.keys()]).toEqual(expect.arrayContaining(['src/content/posts/kaygi/tr.md', 'src/content/posts/kaygi/en.md', 'src/content/posts/kaygi/yaprak.webp']));
    expect(gh.files.get('src/content/posts/kaygi/yaprak.webp')).toBe('WUFQUkFL');
    expect(() => getDraft(gas, { key: 'taslak-abc' })).toThrow();
  });

  it('a backend error reaches the flow as an ApiFailure with its code', async () => {
    const gas = fakeGas({ props: ghProps, routes: [new FakeGitHub(ghSeed).route] });
    const err = await serverApi(gas).getImage('taslak-abc', 'yok.webp').catch((e) => e);
    expect(err).toBeInstanceOf(ApiFailure);
    expect((err as ApiFailure).code).toBe('not_found');
  });
});
