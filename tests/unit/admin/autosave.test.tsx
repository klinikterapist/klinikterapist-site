// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAutosave, readBackup } from '../../../src/admin/ui/editor/useAutosave';
import { newDraft } from '../../../src/admin/lib/draft';
import { ApiFailure, type Api, type Draft } from '../../../src/admin/api/types';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

function fakeApi(save: (d: Draft) => Promise<{ rev: number; updatedAt: string }>) {
  const saveDraft = vi.fn(save);
  return { api: { saveDraft } as unknown as Api, saveDraft };
}
const ok = (d: Draft) => Promise.resolve({ rev: d.rev + 1, updatedAt: '2026-10-17T12:00:00Z' });
const initial = () => newDraft(new Date('2026-10-17T10:00:00'));
const type = (r: { current: ReturnType<typeof useAutosave> }, title: string) =>
  act(() => r.current.update((d) => ({ ...d, tr: { ...d.tr, title } })));
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe('useAutosave', () => {
  it('edits within 2 s are sent as one save with the latest text, and the revision moves on', async () => {
    const { api, saveDraft } = fakeApi(ok);
    const { result } = renderHook(() => useAutosave(initial(), api));
    type(result, 'B');
    await tick(500);
    type(result, 'Ba');
    await tick(500);
    type(result, 'Baş');
    await tick(1999);
    expect(saveDraft).not.toHaveBeenCalled();
    await tick(1);
    expect(saveDraft).toHaveBeenCalledOnce();
    expect(saveDraft.mock.calls[0][0].tr.title).toBe('Baş');
    expect(result.current.status).toBe('kaydedildi');
    expect(result.current.draft.rev).toBe(1);
  });

  it('continuous typing still saves within 10 s', async () => {
    const { api, saveDraft } = fakeApi(ok);
    const { result } = renderHook(() => useAutosave(initial(), api));
    for (let i = 0; i < 21; i++) {
      type(result, `metin ${i}`);
      await tick(500);
    }
    expect(saveDraft).toHaveBeenCalled();
  });

  it('keeps the text on this device when saving fails, and retries', async () => {
    let fail = true;
    const { api, saveDraft } = fakeApi((d) => (fail ? Promise.reject(new ApiFailure('network', 'yok')) : ok(d)));
    const { result } = renderHook(() => useAutosave(initial(), api));
    type(result, 'Çevrimdışı yazı');
    expect(readBackup(result.current.draft.key, localStorage)?.tr.title).toBe('Çevrimdışı yazı');
    await tick(2000);
    expect(result.current.status).toBe('cihazda');
    expect(readBackup(result.current.draft.key, localStorage)?.tr.title).toBe('Çevrimdışı yazı');
    fail = false;
    await tick(15000);
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('kaydedildi');
    expect(readBackup(result.current.draft.key, localStorage)).toBeNull();
  });

  it('a conflict stops saving and offers both copies', async () => {
    const theirs = { ...initial(), rev: 5, tr: { ...initial().tr, title: 'Telefondaki' } };
    const { api, saveDraft } = fakeApi(() => Promise.reject(new ApiFailure('conflict', 'çakışma', theirs)));
    const { result } = renderHook(() => useAutosave(initial(), api));
    type(result, 'Bilgisayardaki');
    await tick(2000);
    expect(result.current.status).toBe('çakışma');
    expect(result.current.conflict?.tr.title).toBe('Telefondaki');
    await tick(30000);
    expect(saveDraft).toHaveBeenCalledOnce();
    act(() => result.current.keepTheirs());
    expect(result.current.draft.tr.title).toBe('Telefondaki');
    expect(result.current.status).toBe('kaydedildi');
  });

  it('keepMine overwrites on top of the other copy', async () => {
    const theirs = { ...initial(), rev: 5 };
    let first = true;
    const { api, saveDraft } = fakeApi((d) => {
      if (first) {
        first = false;
        return Promise.reject(new ApiFailure('conflict', 'çakışma', theirs));
      }
      return ok(d);
    });
    const { result } = renderHook(() => useAutosave(initial(), api));
    type(result, 'Benimki');
    await tick(2000);
    await act(async () => void (await result.current.keepMine()));
    expect(saveDraft.mock.calls[1][0]).toMatchObject({ rev: 5, tr: { title: 'Benimki' } });
    expect(result.current.draft.rev).toBe(6);
    expect(result.current.status).toBe('kaydedildi');
  });

  it('saveNow saves pending edits immediately', async () => {
    const { api, saveDraft } = fakeApi(ok);
    const { result } = renderHook(() => useAutosave(initial(), api));
    type(result, 'Hemen');
    let saved = false;
    await act(async () => void (saved = await result.current.saveNow()));
    expect(saved).toBe(true);
    expect(saveDraft).toHaveBeenCalledOnce();
  });

  it('a slow server and continuous typing never make this device conflict with itself (review C1)', async () => {
    let stored = 0;
    const sent: number[] = [];
    const saveDraft = vi.fn(
      (d: Draft) =>
        new Promise<{ rev: number; updatedAt: string }>((res, rej) => {
          sent.push(d.rev);
          setTimeout(() => {
            if (d.rev !== stored) rej(new ApiFailure('conflict', 'c', { ...d, rev: stored }));
            else {
              stored = d.rev + 1;
              res({ rev: stored, updatedAt: 'x' });
            }
          }, 2500);
        }),
    );
    const api = { saveDraft } as unknown as Api;
    const start = initial();
    const { result } = renderHook(() => useAutosave(start, api));
    for (let i = 0; i < 80; i++) {
      type(result, `m${i}`);
      await tick(250);
    }
    await tick(20000);
    expect(result.current.status).toBe('kaydedildi');
    // Saves run one at a time: every revision is sent once, in order.
    expect(sent).toEqual(sent.map((_, i) => i));
    expect(saveDraft.mock.calls.at(-1)![0].tr.title).toBe('m79');
  });

  it('a successful save on unmount clears the device copy (review I2)', async () => {
    const { api } = fakeApi(ok);
    const start = initial();
    const { result, unmount } = renderHook(() => useAutosave(start, api));
    type(result, 'Kapatmadan önce');
    unmount();
    await tick(0);
    expect(readBackup(start.key, localStorage)).toBeNull();
  });

  it('a draft published or deleted on another device stops saving and can be kept as a new draft (review I3)', async () => {
    let gone = true;
    const { api, saveDraft } = fakeApi((d) => (gone ? Promise.reject(new ApiFailure('conflict', 'yok')) : ok(d)));
    const start = { ...initial(), rev: 4, published: true };
    const { result } = renderHook(() => useAutosave(start, api));
    type(result, 'Laptopta yazmaya devam');
    await tick(2000);
    expect(result.current.status).toBe('silinmiş');
    await tick(30000);
    expect(saveDraft).toHaveBeenCalledOnce();
    gone = false;
    let newKey = '';
    await act(async () => void (newKey = await result.current.keepAsNew()));
    expect(newKey).not.toBe(start.key);
    expect(saveDraft.mock.calls[1][0]).toMatchObject({ key: newKey, rev: 0, published: false, base: null, tr: { title: 'Laptopta yazmaya devam' } });
    expect(result.current.status).toBe('kaydedildi');
  });
});

describe('old drafts without the new fields', () => {
  it('a device copy and a conflict draft are normalized', async () => {
    const old = JSON.parse(JSON.stringify(initial()));
    delete old.tr.subtitle; delete old.tr.references; delete old.en.subtitle; delete old.en.references;
    localStorage.setItem(`kt-draft-${old.key}`, JSON.stringify(old));
    const b = readBackup(old.key, localStorage)!;
    expect(b.tr.subtitle).toBe('');
    expect(b.en.references).toEqual([]);

    const { api } = fakeApi(() => Promise.reject(new ApiFailure('conflict', 'x', old)));
    const { result } = renderHook(() => useAutosave(initial(), api));
    type(result, 'B');
    await tick(2500);
    expect(result.current.conflict?.tr.subtitle).toBe('');
    expect(result.current.conflict?.en.references).toEqual([]);
  });
});
