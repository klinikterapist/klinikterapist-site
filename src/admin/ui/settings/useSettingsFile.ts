/**
 * One settings file: load it, edit it, validate with the build's own schema, and commit it
 * (together with any images staged by the screen) in one commit.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiFailure, type CommitDelete, type CommitWrite } from '../../api/types';
import { usePanel } from '../context';
import { useDeploy } from '../DeployStatus';

export type Issues = Record<string, string>;
export type Message = { tone: 'success' | 'error'; text: string } | null;

/** `profile.json geçersiz — a.b: mesaj; c: mesaj` → { 'a.b': 'mesaj', c: 'mesaj' } */
export function issuesFrom(e: unknown): Issues {
  const text = e instanceof Error ? e.message : String(e);
  const tail = text.split(' — ').slice(1).join(' — ');
  const out: Issues = {};
  for (const part of tail.split('; ')) {
    const i = part.indexOf(': ');
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 2);
  }
  if (!Object.keys(out).length) out['(root)'] = text;
  return out;
}

export type Staging = {
  write: (path: string, base64: string) => void;
  unstage: (path: string) => void;
  del: (path: string) => void;
  /** base64 of a staged image, for previews */
  data: (path: string) => string | undefined;
};

export type ExtraChanges = { writes: CommitWrite[]; deletes: CommitDelete[] };

/** `a.b` in an object, for saving one part of a file. */
const getAt = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o);
function setAt<T>(o: T, path: string, v: unknown): T {
  const [k, ...rest] = path.split('.');
  const base = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
  const next = { ...base };
  if (rest.length) next[k] = setAt(base[k], rest.join('.'), v);
  else if (v === undefined) delete next[k];
  else next[k] = v;
  return next as T;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function useSettingsFile<T>(path: string, parse: (raw: unknown) => T, title: string) {
  const { api } = usePanel();
  const deploy = useDeploy();
  const [value, setValueState] = useState<T | null>(null);
  const [sha, setSha] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<Issues>({});
  const [message, setMessage] = useState<Message>(null);
  /** The file as last read, and which part the last save was for (`savePart`). */
  const [saved, setSaved] = useState<T | null>(null);
  const [messageFor, setMessageFor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const writes = useRef(new Map<string, string>());
  const deletes = useRef(new Set<string>());
  const [, bump] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoadError(null);
    api
      .read([path])
      .then(({ files }) => {
        if (!alive) return;
        const v = parse(JSON.parse(files[0].content));
        setValueState(v);
        setSaved(v);
        setSha(files[0].sha);
      })
      .catch((e) => alive && setLoadError(e instanceof ApiFailure ? e.message : 'Ayarlar yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, path, attempt]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setValue = useCallback((fn: (v: T) => T) => {
    setValueState((v) => (v === null ? v : fn(v)));
    setDirty(true);
    setMessage(null);
  }, []);

  const staging: Staging = {
    write: (p, base64) => {
      writes.current.set(p, base64);
      deletes.current.delete(p);
      bump((n) => n + 1);
    },
    unstage: (p) => {
      writes.current.delete(p);
      bump((n) => n + 1);
    },
    del: (p) => {
      if (writes.current.has(p)) writes.current.delete(p);
      else deletes.current.add(p);
    },
    data: (p) => writes.current.get(p),
  };

  /** `build` lets a screen produce its own changeset (categories); default: this file only. */
  /**
   * Saves `candidate`. With `part` only those paths of the screen change (the rest of the file stays as
   * last read) and other unsaved edits stay on the screen.
   */
  const run = useCallback(
    async (candidate: T, build?: (parsed: T, sha: string) => Promise<ExtraChanges> | ExtraChanges, part?: { paths: string[]; id: string }) => {
      setMessageFor(part?.id ?? null);
      let parsed: T;
      try {
        parsed = parse(candidate);
      } catch (e) {
        setIssues(issuesFrom(e));
        setMessage({ tone: 'error', text: 'Kaydedilmedi. İşaretli alanları düzeltin.' });
        return;
      }
      setIssues({});
      setSaving(true);
      setMessage(null);
      try {
        const own = build
          ? await build(parsed, sha)
          : { writes: [{ path, content: `${JSON.stringify(parsed, null, 2)}\n`, encoding: 'utf8' as const, expectSha: sha }], deletes: [] };
        const staged = writes.current.size + deletes.current.size > 0;
        const tree = staged ? new Map((await api.tree()).files.map((f) => [f.path, f.sha])) : new Map<string, string>();
        const all: ExtraChanges = {
          writes: [...own.writes, ...[...writes.current].map(([p, base64]) => ({ path: p, content: base64, encoding: 'base64' as const, expectSha: tree.get(p) ?? null }))],
          deletes: [...own.deletes, ...[...deletes.current].filter((p) => tree.has(p)).map((p) => ({ path: p, expectSha: tree.get(p)! }))],
        };
        const { commitSha } = await api.commit({ message: `Site ayarları: ${title}`, ...all });
        writes.current.clear();
        deletes.current.clear();
        const { files } = await api.read([path]);
        const fresh = parse(JSON.parse(files[0].content));
        setSaved(fresh);
        setSha(files[0].sha);
        if (part) {
          setValueState((v) => {
            const next = v === null ? fresh : part.paths.reduce((acc, k) => setAt(acc, k, getAt(fresh, k)), v);
            setDirty(!same(next, fresh));
            return next;
          });
        } else {
          setValueState(fresh);
          setDirty(false);
        }
        deploy.track(commitSha);
        setMessage({ tone: 'success', text: 'Kaydedildi. Site 1–3 dakika içinde güncellenir.' });
      } catch (e) {
        if (e instanceof ApiFailure && e.code === 'conflict') {
          setMessage({ tone: 'error', text: 'Bu ayar başka bir yerde değişmiş. Sayfayı yenileyip tekrar deneyin.' });
        } else {
          setMessage({ tone: 'error', text: e instanceof Error && e.message ? e.message : 'Kaydedilemedi. Tekrar deneyin.' });
        }
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, deploy, path, sha, title],
  );

  const save = useCallback(
    async (build?: (parsed: T, sha: string) => Promise<ExtraChanges> | ExtraChanges) => {
      if (value !== null) await run(value, build);
    },
    [run, value],
  );

  /** Saves only these paths (`a.b`), for screens with a Kaydet per part (Randevu Ayarları, 2026-10-23). */
  const savePart = useCallback(
    async (id: string, paths: string[]) => {
      if (value === null || saved === null) return;
      await run(
        paths.reduce((acc, k) => setAt(acc, k, getAt(value, k)), saved),
        undefined,
        { paths, id },
      );
    },
    [run, saved, value],
  );

  /** Whether any of these paths differs from the file as last read. */
  const partDirty = (paths: string[]) => value !== null && saved !== null && paths.some((k) => !same(getAt(value, k), getAt(saved, k)));

  return { value, setValue, sha, loadError, retry: () => setAttempt((a) => a + 1), dirty, saving, issues, message, messageFor, save, savePart, partDirty, staging };
}

export type SettingsFile<T> = ReturnType<typeof useSettingsFile<T>>;
