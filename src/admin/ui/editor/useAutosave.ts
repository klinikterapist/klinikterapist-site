/**
 * Owns the draft being edited. Every edit is copied to this device at once (localStorage) and
 * saved to Drive 2 s after typing stops (at the latest every 10 s). A failed save keeps the local
 * copy and retries; a revision conflict stops and lets the owner choose.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiFailure, type Api, type Draft } from '../../api/types';
import { newDraft } from '../../lib/draft';

export type AutosaveStatus = 'kaydedildi' | 'kaydediliyor' | 'cihazda' | 'çakışma' | 'silinmiş';

const backupKey = (key: string) => `kt-draft-${key}`;

export function readBackup(key: string, storage: Storage): Draft | null {
  try {
    return JSON.parse(storage.getItem(backupKey(key)) ?? 'null') as Draft | null;
  } catch {
    return null;
  }
}

export function clearBackup(key: string, storage: Storage): void {
  try {
    storage.removeItem(backupKey(key));
  } catch {
    // ignore
  }
}

export function writeBackup(d: Draft, storage: Storage): void {
  try {
    storage.setItem(backupKey(d.key), JSON.stringify(d));
  } catch {
    // Storage full or blocked: Drive saves still run.
  }
}

export function useAutosave(
  initial: Draft,
  api: Api,
  opts: { debounceMs?: number; maxWaitMs?: number; retryMs?: number; storage?: Storage } = {},
) {
  const { debounceMs = 2000, maxWaitMs = 10000, retryMs = 15000 } = opts;
  const storage = opts.storage ?? window.localStorage;
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<AutosaveStatus>('kaydedildi');
  const [conflict, setConflict] = useState<Draft | null>(null);

  const latest = useRef(initial);
  const seq = useRef(0);
  const savedSeq = useRef(0);
  const firstPendingAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const blocked = useRef(false);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const save = useCallback(async (): Promise<boolean> => {
    clearTimer();
    if (blocked.current) return false;
    // One save at a time: every caller waits its turn, then sends the newest text with the
    // revision the previous save returned (parallel saves would conflict with each other).
    while (inFlight.current) {
      await inFlight.current;
      if (blocked.current) return false;
      if (seq.current === savedSeq.current) return true;
    }
    const sentSeq = seq.current;
    firstPendingAt.current = null;
    const run = (async () => {
      setStatus('kaydediliyor');
      try {
        const { rev, updatedAt } = await api.saveDraft(latest.current);
        latest.current = { ...latest.current, rev, updatedAt };
        setDraft(latest.current);
        savedSeq.current = sentSeq;
        if (seq.current === sentSeq) {
          firstPendingAt.current = null;
          clearBackup(latest.current.key, storage);
          setStatus('kaydedildi');
        } else {
          writeBackup(latest.current, storage);
          schedule();
        }
        return true;
      } catch (e) {
        if (e instanceof ApiFailure && e.code === 'conflict' && e.current) {
          blocked.current = true;
          setConflict(e.current as Draft);
          setStatus('çakışma');
          return false;
        }
        if (e instanceof ApiFailure && e.code === 'conflict') {
          // No stored copy any more: published or deleted on another device.
          blocked.current = true;
          setStatus('silinmiş');
          return false;
        }
        setStatus('cihazda');
        clearTimer();
        timer.current = setTimeout(() => void save(), retryMs);
        return false;
      }
    })();
    inFlight.current = run;
    try {
      return await run;
    } finally {
      inFlight.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, retryMs, storage]);

  const schedule = useCallback(() => {
    clearTimer();
    const now = Date.now();
    firstPendingAt.current ??= now;
    const wait = Math.max(0, Math.min(debounceMs, firstPendingAt.current + maxWaitMs - now));
    timer.current = setTimeout(() => void save(), wait);
  }, [debounceMs, maxWaitMs, save]);

  const update = useCallback(
    (fn: (d: Draft) => Draft) => {
      const next = fn(latest.current);
      latest.current = next;
      seq.current++;
      setDraft(next);
      writeBackup(next, storage);
      if (!blocked.current) {
        if (status !== 'cihazda') setStatus('kaydediliyor');
        schedule();
      }
    },
    [schedule, status, storage],
  );

  const keepTheirs = useCallback(() => {
    const theirs = conflict;
    if (!theirs) return;
    blocked.current = false;
    latest.current = theirs;
    savedSeq.current = seq.current;
    setDraft(theirs);
    setConflict(null);
    clearBackup(theirs.key, storage);
    setStatus('kaydedildi');
  }, [conflict, storage]);

  const keepMine = useCallback(async () => {
    if (!conflict) return true;
    blocked.current = false;
    latest.current = { ...latest.current, rev: conflict.rev };
    setConflict(null);
    return save();
  }, [conflict, save]);

  /** After "silinmiş": keep this device's text as a brand-new draft; returns its key. */
  const keepAsNew = useCallback(async () => {
    const old = latest.current;
    const fresh = newDraft(new Date());
    latest.current = { ...old, key: fresh.key, rev: 0, published: false, base: null };
    seq.current++;
    setDraft(latest.current);
    clearBackup(old.key, storage);
    writeBackup(latest.current, storage);
    blocked.current = false;
    await save();
    return fresh.key;
  }, [save, storage]);

  /** Replace the whole draft (e.g. restoring a device copy) and save it. */
  const replace = useCallback(
    (d: Draft) => {
      update(() => d);
    },
    [update],
  );

  // Leave nothing behind: save on unmount, warn before closing the tab with unsaved text.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (seq.current !== savedSeq.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      clearTimer();
      if (seq.current !== savedSeq.current && !blocked.current) {
        const last = latest.current;
        void api.saveDraft(last).then(
          () => clearBackup(last.key, storage),
          () => {},
        );
      }
    };
  }, [api, storage]);

  /** After publishing or deleting: no more saves, and no device copy left behind. */
  const stop = useCallback(() => {
    blocked.current = true;
    clearTimer();
    savedSeq.current = seq.current;
    clearBackup(latest.current.key, storage);
  }, [storage]);

  return { draft, update, status, conflict, saveNow: save, keepTheirs, keepMine, keepAsNew, replace, stop };
}
