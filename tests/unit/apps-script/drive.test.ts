import { describe, it, expect } from 'vitest';
import { deleteDraft, getDraft, getImage, getVersion, listDrafts, listTrash, listVersions, purgeTrash, putImage, restoreTrash, saveDraft } from '../../../apps-script/src/drive';
import { ApiError } from '../../../apps-script/src/respond';
import type { Draft } from '../../../src/admin/api/types';
import { fakeGas } from './fake-gas';

const lang = (title: string) => ({
  title, seoTitle: '', slug: '', slugTouched: false, description: '', subtitle: '', focusKeyword: '', coverAlt: '', references: [], doc: { type: 'doc', content: [] },
});
const draft = (over: Partial<Draft> = {}): Draft => ({
  key: 'taslak-abc', rev: 0, updatedAt: '', published: false, category: 'terapi', cover: null, coverOriginal: null, coverCrop: null, publishedAt: '2026-10-17',
  tr: lang('Başlık'), en: lang('Title'), ...over,
});

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected an ApiError');
};

describe('drafts', () => {
  it('save then get round-trips and bumps the revision', () => {
    const gas = fakeGas();
    const saved = saveDraft(gas, { draft: draft() });
    expect(saved).toEqual({ rev: 1, updatedAt: new Date(gas.now()).toISOString() });
    const got = getDraft(gas, { key: 'taslak-abc' }).draft;
    expect(got.rev).toBe(1);
    expect(got.tr.title).toBe('Başlık');
    expect(gas.root.findFolder('taslaklar')?.findFile('taslak-abc.json')).not.toBeNull();
  });

  it('a save from an older copy is a conflict and returns the stored draft', () => {
    const gas = fakeGas();
    saveDraft(gas, { draft: draft() });
    saveDraft(gas, { draft: draft({ rev: 1, tr: lang('Telefonda') }) });
    const e = errorOf(() => saveDraft(gas, { draft: draft({ rev: 1, tr: lang('Bilgisayarda') }) }));
    expect(e.code).toBe('conflict');
    expect((e.data as { current: Draft }).current.tr.title).toBe('Telefonda');
    expect(getDraft(gas, { key: 'taslak-abc' }).draft.tr.title).toBe('Telefonda');
  });

  it('a brand-new key must start at revision 0', () => {
    const gas = fakeGas();
    expect(errorOf(() => saveDraft(gas, { draft: draft({ rev: 3 }) })).code).toBe('conflict');
  });

  it.each(['../x', 'A', '', 'a/b', 'x'.repeat(81)])('rejects the key %j', (key) => {
    const gas = fakeGas();
    expect(errorOf(() => saveDraft(gas, { draft: draft({ key }) })).code).toBe('bad_request');
    expect(errorOf(() => getDraft(gas, { key })).code).toBe('bad_request');
  });

  it('a missing draft is not_found', () => {
    expect(errorOf(() => getDraft(fakeGas(), { key: 'yok' })).code).toBe('not_found');
  });

  it('lists summaries newest first and forgets deleted drafts', () => {
    const gas = fakeGas();
    saveDraft(gas, { draft: draft({ key: 'eski' }) });
    gas.clock.now += 60_000;
    saveDraft(gas, { draft: draft({ key: 'yeni', published: true, en: lang('New') }) });
    expect(listDrafts(gas).drafts).toEqual([
      { key: 'yeni', rev: 1, updatedAt: new Date(gas.now()).toISOString(), published: true, category: 'terapi', title: { tr: 'Başlık', en: 'New' } },
      expect.objectContaining({ key: 'eski' }),
    ]);
    putImage(gas, { key: 'eski', name: 'a.webp', base64: 'AAAA' });
    deleteDraft(gas, { key: 'eski' });
    expect(listDrafts(gas).drafts.map((d) => d.key)).toEqual(['yeni']);
    expect(errorOf(() => getImage(gas, { key: 'eski', name: 'a.webp' })).code).toBe('not_found');
  });
});

describe('draft images', () => {
  it('put then get returns the same base64, and a second put replaces it', () => {
    const gas = fakeGas();
    putImage(gas, { key: 'taslak-abc', name: 'kapak.webp', base64: 'UklGRg==' });
    expect(getImage(gas, { key: 'taslak-abc', name: 'kapak.webp' })).toEqual({ base64: 'UklGRg==' });
    putImage(gas, { key: 'taslak-abc', name: 'kapak.webp', base64: 'QUJD' });
    expect(getImage(gas, { key: 'taslak-abc', name: 'kapak.webp' })).toEqual({ base64: 'QUJD' });
  });
  it.each(['../a.webp', 'a.png', 'A.webp', 'a.webp.exe'])('rejects the name %j', (name) => {
    expect(errorOf(() => putImage(fakeGas(), { key: 'taslak-abc', name, base64: 'QUJD' })).code).toBe('bad_request');
  });
});

describe('draft snapshots', () => {
  const MIN = 60_000;
  const snaps = (gas: ReturnType<typeof fakeGas>, k = 'taslak-abc') =>
    (gas.root.findFolder('surumler')?.findFolder(k)?.listFiles() ?? []).map((f) => f.getName()).sort();
  /** Saves `n` times in a row, `gap` ms apart, each from the latest rev. */
  const saves = (gas: ReturnType<typeof fakeGas>, n: number, gap: number, snapshot = false) => {
    let rev = 0;
    for (let i = 0; i < n; i++) {
      if (i) gas.clock.now += gap;
      rev = saveDraft(gas, { draft: draft({ rev, tr: lang(`v${i + 1}`) }), snapshot }).rev;
    }
    return rev;
  };

  it('the first save of a new draft makes no snapshot', () => {
    const gas = fakeGas();
    saves(gas, 1, 0);
    expect(snaps(gas)).toEqual([]);
  });

  it('a save 11 minutes after the last snapshot snapshots the previous stored copy', () => {
    const gas = fakeGas({ now: Date.UTC(2026, 9, 17, 14, 32, 0) });
    saves(gas, 1, 0);
    gas.clock.now += 11 * MIN;
    saveDraft(gas, { draft: draft({ rev: 1, tr: lang('v2') }) });
    expect(snaps(gas)).toEqual(['1-20261017T144300Z.json']);
    const v = getVersion(gas, { key: 'taslak-abc', name: '1-20261017T144300Z.json' }).draft;
    expect(v.rev).toBe(1);
    expect(v.tr.title).toBe('v1');
  });

  it('a save 3 minutes after the last snapshot makes none', () => {
    const gas = fakeGas();
    saves(gas, 2, 11 * MIN);
    expect(snaps(gas)).toHaveLength(1);
    gas.clock.now += 3 * MIN;
    saveDraft(gas, { draft: draft({ rev: 2 }) });
    expect(snaps(gas)).toHaveLength(1);
  });

  it('snapshot: true forces one even right after another', () => {
    const gas = fakeGas();
    saves(gas, 2, 11 * MIN);
    gas.clock.now += 1 * MIN;
    saveDraft(gas, { draft: draft({ rev: 2 }), snapshot: true });
    expect(snaps(gas)).toHaveLength(2);
  });

  it('a conflicting save writes no snapshot', () => {
    const gas = fakeGas();
    saves(gas, 3, 1 * MIN);
    const before = snaps(gas);
    gas.clock.now += 20 * MIN;
    expect(errorOf(() => saveDraft(gas, { draft: draft({ rev: 1 }), snapshot: true })).code).toBe('conflict');
    expect(snaps(gas)).toEqual(before);
  });

  it('trashes snapshots older than 30 days on the next save', () => {
    const gas = fakeGas();
    saves(gas, 2, 11 * MIN);
    expect(snaps(gas)).toHaveLength(1);
    gas.clock.now += 31 * 24 * 60 * MIN;
    saveDraft(gas, { draft: draft({ rev: 2 }) });
    const names = snaps(gas);
    expect(names).toHaveLength(1);
    expect(names[0].startsWith('2-')).toBe(true);
  });

  it('lists versions newest first with rev and savedAt, without reading contents', () => {
    const gas = fakeGas({ now: Date.UTC(2026, 9, 17, 14, 0, 0) });
    saves(gas, 4, 11 * MIN);
    const { versions } = listVersions(gas, { key: 'taslak-abc' });
    expect(versions.map((v) => v.rev)).toEqual([3, 2, 1]);
    expect(versions[0]).toEqual({ name: '3-20261017T143300Z.json', rev: 3, savedAt: '2026-10-17T14:33:00.000Z' });
    expect(listVersions(gas, { key: 'yok' })).toEqual({ versions: [] });
  });

  it('listing ignores foreign file names, never parses contents, and returns at most 50', () => {
    const gas = fakeGas();
    const folder = gas.root.createFolder('surumler').createFolder('taslak-abc');
    folder.createFile('notlar.txt', 'x', 'json');
    folder.createFile('3-bozuk.json', 'x', 'json');
    folder.createFile('1-20261017T100000Z.json', '{bozuk json', 'json');
    for (let i = 0; i < 60; i++) folder.createFile(`${i + 2}-2026101${i % 10}T1${String(i % 10)}0000Z.json`, '{bozuk', 'json');
    const { versions } = listVersions(gas, { key: 'taslak-abc' });
    expect(versions).toHaveLength(50);
    expect(versions.every((v) => /^\d+-\d{8}T\d{6}Z\.json$/.test(v.name))).toBe(true);
    expect(versions.map((v) => v.savedAt)).toEqual([...versions.map((v) => v.savedAt)].sort().reverse());
    expect(Object.keys(versions[0])).toEqual(['name', 'rev', 'savedAt']);
  });

  it('a corrupt snapshot is a Turkish not_found on getVersion', () => {
    const gas = fakeGas();
    gas.root.createFolder('surumler').createFolder('taslak-abc').createFile('1-20261017T100000Z.json', '{bozuk', 'json');
    const e = errorOf(() => getVersion(gas, { key: 'taslak-abc', name: '1-20261017T100000Z.json' }));
    expect(e.code).toBe('not_found');
    expect(e.message).toBe('Bu sürüm okunamadı.');
  });

  it('a bad version name is bad_request, a missing one not_found', () => {
    const gas = fakeGas();
    for (const name of ['../x.json', '1-2.json', 'a', 5, undefined]) {
      expect(errorOf(() => getVersion(gas, { key: 'taslak-abc', name })).code).toBe('bad_request');
    }
    const e = errorOf(() => getVersion(gas, { key: 'taslak-abc', name: '1-20261017T144300Z.json' }));
    expect(e.code).toBe('not_found');
    expect(e.message).toMatch(/sürüm/i);
    expect(errorOf(() => getVersion(gas, { key: 'A', name: '1-20261017T144300Z.json' })).code).toBe('bad_request');
    expect(errorOf(() => listVersions(gas, { key: '../x' })).code).toBe('bad_request');
  });

  it('deleting a draft also trashes its snapshots', () => {
    const gas = fakeGas();
    saves(gas, 2, 11 * MIN);
    deleteDraft(gas, { key: 'taslak-abc' });
    expect(snaps(gas)).toEqual([]);
    expect(listVersions(gas, { key: 'taslak-abc' }).versions).toEqual([]);
  });

  it('restoring a version is a normal save from the current rev', () => {
    const gas = fakeGas();
    const rev = saves(gas, 3, 11 * MIN);
    const old = listVersions(gas, { key: 'taslak-abc' }).versions.at(-1)!;
    const restored = getVersion(gas, { key: 'taslak-abc', name: old.name }).draft;
    expect(saveDraft(gas, { draft: { ...restored, rev } }).rev).toBe(rev + 1);
    expect(getDraft(gas, { key: 'taslak-abc' }).draft.tr.title).toBe('v1');
    expect(errorOf(() => saveDraft(gas, { draft: restored })).code).toBe('conflict');
  });
});

describe('trash (Çöp kutusu)', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('"Taslağı sil" keeps the draft in the trash; it leaves the drafts list', () => {
    const gas = fakeGas();
    saveDraft(gas, { draft: draft() });
    deleteDraft(gas, { key: 'taslak-abc', trash: true });
    expect(listDrafts(gas).drafts).toEqual([]);
    const { items } = listTrash(gas);
    expect(items).toHaveLength(1);
    expect(items[0].title.tr).toBe('Başlık');
    expect(items[0].deletedAt).toBe(new Date(gas.now()).toISOString());
    expect(Date.parse(items[0].purgeAt) - Date.parse(items[0].deletedAt)).toBe(30 * DAY);
  });

  it('restoring brings the draft back with its text, and empties the trash entry', () => {
    const gas = fakeGas();
    saveDraft(gas, { draft: draft() });
    deleteDraft(gas, { key: 'taslak-abc', trash: true });
    expect(restoreTrash(gas, { key: 'taslak-abc' }).draft.title.tr).toBe('Başlık');
    expect(getDraft(gas, { key: 'taslak-abc' }).draft.tr.title).toBe('Başlık');
    expect(listDrafts(gas).drafts.map((d) => d.key)).toEqual(['taslak-abc']);
    expect(listTrash(gas).items).toEqual([]);
  });

  it('will not restore over an open draft with the same key', () => {
    const gas = fakeGas();
    saveDraft(gas, { draft: draft() });
    deleteDraft(gas, { key: 'taslak-abc', trash: true });
    saveDraft(gas, { draft: draft() });
    expect(errorOf(() => restoreTrash(gas, { key: 'taslak-abc' })).code).toBe('conflict');
  });

  it('keeps images while in the trash; "Kalıcı sil" removes them too', () => {
    const gas = fakeGas();
    saveDraft(gas, { draft: draft() });
    putImage(gas, { key: 'taslak-abc', name: 'kapak.webp', base64: 'QUJD' });
    deleteDraft(gas, { key: 'taslak-abc', trash: true });
    expect(getImage(gas, { key: 'taslak-abc', name: 'kapak.webp' }).base64).toBe('QUJD');
    purgeTrash(gas, { key: 'taslak-abc' });
    expect(listTrash(gas).items).toEqual([]);
    expect(errorOf(() => getImage(gas, { key: 'taslak-abc', name: 'kapak.webp' })).code).toBe('not_found');
  });

  it('removes anything older than 30 days for good when the trash is listed', () => {
    const gas = fakeGas();
    saveDraft(gas, { draft: draft() });
    putImage(gas, { key: 'taslak-abc', name: 'kapak.webp', base64: 'QUJD' });
    deleteDraft(gas, { key: 'taslak-abc', trash: true });
    gas.clock.now += 29 * DAY;
    expect(listTrash(gas).items).toHaveLength(1);
    gas.clock.now += 1 * DAY;
    expect(listTrash(gas).items).toEqual([]);
    expect(errorOf(() => getImage(gas, { key: 'taslak-abc', name: 'kapak.webp' })).code).toBe('not_found');
  });

  it('a delete without trash (after publishing) skips the trash, as before', () => {
    const gas = fakeGas();
    saveDraft(gas, { draft: draft() });
    deleteDraft(gas, { key: 'taslak-abc' });
    expect(listTrash(gas).items).toEqual([]);
  });
});

describe('drafts list cache', () => {
  it('serves the list from the cache, kept current by saves and deletes', () => {
    const gas = fakeGas();
    saveDraft(gas, { draft: draft() });
    expect(listDrafts(gas).drafts.map((d) => d.title.tr)).toEqual(['Başlık']);
    // A second draft and an edit go through saveDraft, which updates the cached list.
    saveDraft(gas, { draft: draft({ key: 'taslak-xyz', tr: lang('İkinci') }) });
    gas.clock.now += 1000;
    saveDraft(gas, { draft: draft({ rev: 1, tr: lang('Yeni başlık') }) });
    const reads: string[] = [];
    for (const f of gas.root.findFolder('taslaklar')!.listFiles()) {
      const read = f.read.bind(f);
      f.read = () => {
        reads.push(f.getName());
        return read();
      };
    }
    expect(listDrafts(gas).drafts.map((d) => d.title.tr)).toEqual(['Yeni başlık', 'İkinci']);
    expect(reads).toEqual([]);
    deleteDraft(gas, { key: 'taslak-xyz', trash: true });
    expect(listDrafts(gas).drafts.map((d) => d.key)).toEqual(['taslak-abc']);
  });
});
