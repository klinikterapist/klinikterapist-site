import { describe, it, expect } from 'vitest';
import { deleteDraft, getDraft, getImage, listDrafts, putImage, saveDraft } from '../../../apps-script/src/drive';
import { ApiError } from '../../../apps-script/src/respond';
import type { Draft } from '../../../src/admin/api/types';
import { fakeGas } from './fake-gas';

const lang = (title: string) => ({
  title, seoTitle: '', slug: '', slugTouched: false, description: '', focusKeyword: '', coverAlt: '', doc: { type: 'doc', content: [] },
});
const draft = (over: Partial<Draft> = {}): Draft => ({
  key: 'taslak-abc', rev: 0, updatedAt: '', published: false, category: 'terapi', cover: null, publishedAt: '2026-10-17',
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
