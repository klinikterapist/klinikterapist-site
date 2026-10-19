/**
 * Drafts and draft images in the owner's Drive (spec §8.4): `Klinikterapist Panel/taslaklar/<key>.json`
 * and `Klinikterapist Panel/gorseller/<key>/<name>`. Nothing here touches GitHub.
 */
import type { Draft, DraftSummary, TrashItem, VersionSummary } from '../../src/admin/api/types';
import type { FolderLike, Gas } from './gas';
import { ApiError, badRequest } from './respond';

const KEY_RE = /^[a-z0-9-]{1,80}$/;
/** Snapshots are thinned to at least this far apart and kept this long (spec §5.5). */
const SNAPSHOT_GAP_MS = 10 * 60 * 1000;
const SNAPSHOT_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const VERSION_RE = /^(\d+)-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.json$/;
const NAME_RE = /^[a-z0-9-]+\.(webp|jpg)$/;

function key(value: unknown): string {
  if (typeof value !== 'string' || !KEY_RE.test(value)) throw badRequest('Geçersiz taslak adı.');
  return value;
}

function imageName(value: unknown): string {
  if (typeof value !== 'string' || !NAME_RE.test(value)) throw badRequest('Geçersiz görsel adı.');
  return value;
}

function sub(gas: Gas, name: string, create: true): FolderLike;
function sub(gas: Gas, name: string, create: false): FolderLike | null;
function sub(gas: Gas, name: string, create: boolean): FolderLike | null {
  const root = gas.drive.rootFolder();
  return root.findFolder(name) ?? (create ? root.createFolder(name) : null);
}

function imageFolder(gas: Gas, k: string, create: boolean): FolderLike | null {
  const images = create ? sub(gas, 'gorseller', true) : sub(gas, 'gorseller', false);
  if (!images) return null;
  return images.findFolder(k) ?? (create ? images.createFolder(k) : null);
}

function stored(gas: Gas, k: string): Draft | null {
  const file = sub(gas, 'taslaklar', false)?.findFile(`${k}.json`);
  return file ? (JSON.parse(file.read()) as Draft) : null;
}

function versionName(value: unknown): string {
  if (typeof value !== 'string' || !VERSION_RE.test(value)) throw badRequest('Geçersiz sürüm adı.');
  return value;
}

/** The time a snapshot was taken, read from its file name; null for a file that is not one. */
function snapshotTime(name: string): number | null {
  const m = VERSION_RE.exec(name);
  return m ? Date.UTC(+m[2], +m[3] - 1, +m[4], +m[5], +m[6], +m[7]) : null;
}

function versionFolder(gas: Gas, k: string, create: boolean): FolderLike | null {
  const root = create ? sub(gas, 'surumler', true) : sub(gas, 'surumler', false);
  if (!root) return null;
  return root.findFolder(k) ?? (create ? root.createFolder(k) : null);
}

/**
 * Stores `previous` as a snapshot unless one was taken less than 10 minutes ago (or `force`), and
 * trashes snapshots older than 30 days. Called inside the save lock, before the draft is overwritten.
 */
function snapshot(gas: Gas, k: string, previous: Draft, force: boolean): void {
  const now = gas.now();
  const existing = (versionFolder(gas, k, false)?.listFiles() ?? []).flatMap((f) => {
    const at = snapshotTime(f.getName());
    return at === null ? [] : [{ file: f, at }];
  });
  for (const e of existing) if (now - e.at > SNAPSHOT_KEEP_MS) e.file.trash();
  const newest = existing.reduce((max, e) => Math.max(max, e.at), -Infinity);
  if (!force && now - newest < SNAPSHOT_GAP_MS) return;
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const name = `${previous.rev}-${stamp}.json`;
  const folder = versionFolder(gas, k, true)!;
  const text = JSON.stringify(previous);
  const same = folder.findFile(name);
  if (same) same.write(text);
  else folder.createFile(name, text, 'json');
}

const notFound = () => new ApiError('not_found', 'Taslak bulunamadı. Silinmiş ya da yayınlanmış olabilir.');

export function getDraft(gas: Gas, p: { key?: unknown }): { draft: Draft } {
  const d = stored(gas, key(p.key));
  if (!d) throw notFound();
  return { draft: d };
}

function checkDraft(value: unknown): Draft {
  const d = value as Draft;
  if (!d || typeof d !== 'object' || typeof d.rev !== 'number' || !d.tr || !d.en || typeof d.publishedAt !== 'string') throw badRequest();
  key(d.key);
  return d;
}

export function saveDraft(gas: Gas, p: { draft?: unknown; snapshot?: unknown }): { rev: number; updatedAt: string } {
  const draft = checkDraft(p.draft);
  return gas.withLock(() => {
    const current = stored(gas, draft.key);
    if (current ? current.rev !== draft.rev : draft.rev !== 0) {
      throw new ApiError('conflict', 'Bu taslak başka bir cihazda daha yeni kaydedilmiş.', current ? { current } : undefined);
    }
    if (current) snapshot(gas, draft.key, current, p.snapshot === true);
    const next: Draft = { ...draft, rev: draft.rev + 1, updatedAt: new Date(gas.now()).toISOString() };
    const folder = sub(gas, 'taslaklar', true);
    const file = folder.findFile(`${draft.key}.json`);
    const text = JSON.stringify(next);
    if (file) file.write(text);
    else folder.createFile(`${draft.key}.json`, text, 'json');
    changeList(gas, (list) => [...list.filter((d) => d.key !== next.key), summary(next)]);
    return { rev: next.rev, updatedAt: next.updatedAt };
  });
}

const MAX_VERSIONS = 50;

/** Names only: never opens a snapshot, so the cost stays flat however many exist. */
export function listVersions(gas: Gas, p: { key?: unknown }): { versions: VersionSummary[] } {
  const folder = versionFolder(gas, key(p.key), false);
  const versions = (folder?.listFiles() ?? [])
    .flatMap((f) => {
      const name = f.getName();
      const at = snapshotTime(name);
      return at === null ? [] : [{ name, at }];
    })
    .sort((a, b) => b.at - a.at || b.name.localeCompare(a.name))
    .slice(0, MAX_VERSIONS)
    .map(({ name, at }): VersionSummary => ({ name, rev: Number(/^(\d+)-/.exec(name)![1]), savedAt: new Date(at).toISOString() }));
  return { versions };
}

export function getVersion(gas: Gas, p: { key?: unknown; name?: unknown }): { draft: Draft } {
  const k = key(p.key);
  const name = versionName(p.name);
  const file = versionFolder(gas, k, false)?.findFile(name);
  if (!file) throw new ApiError('not_found', 'Bu sürüm bulunamadı. 30 günden eski sürümler silinir.');
  try {
    return { draft: JSON.parse(file.read()) as Draft };
  } catch {
    throw new ApiError('not_found', 'Bu sürüm okunamadı.');
  }
}

const summary = (d: Draft): DraftSummary => ({
  key: d.key,
  rev: d.rev,
  updatedAt: d.updatedAt,
  published: d.published,
  category: d.category,
  title: { tr: d.tr.title, en: d.en.title },
});

/**
 * The drafts list is kept in the script cache, so opening the panel does not read every draft file
 * from Drive. Every change below (save, delete, restore) updates or drops it inside its lock.
 */
const LIST_CACHE = 'drafts.list';
const LIST_TTL = 6 * 60 * 60;

function cachedList(gas: Gas): DraftSummary[] | null {
  const raw = gas.cache.get(LIST_CACHE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraftSummary[];
  } catch {
    return null;
  }
}

function changeList(gas: Gas, change: (list: DraftSummary[]) => DraftSummary[]): void {
  const list = cachedList(gas);
  if (list) gas.cache.put(LIST_CACHE, JSON.stringify(change(list)), LIST_TTL);
}

const sorted = (list: DraftSummary[]) => [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export function listDrafts(gas: Gas): { drafts: DraftSummary[] } {
  const cached = cachedList(gas);
  if (cached) return { drafts: sorted(cached) };
  const folder = sub(gas, 'taslaklar', false);
  const drafts = sorted(
    (folder?.listFiles() ?? []).filter((f) => f.getName().endsWith('.json')).map((f) => summary(JSON.parse(f.read()) as Draft)),
  );
  gas.cache.put(LIST_CACHE, JSON.stringify(drafts), LIST_TTL);
  return { drafts };
}

/** Deleted drafts wait here for 30 days (owner's request 2026-10-19), then go for good. */
const TRASH = 'cop-kutusu';
const TRASH_KEEP_MS = 30 * 24 * 60 * 60 * 1000;
type TrashFile = { deletedAt: string; draft: Draft };

/** Drops the draft's images and snapshots too (Drive trash, which Google empties on its own). */
function removeForGood(gas: Gas, k: string): void {
  sub(gas, TRASH, false)?.findFile(`${k}.json`)?.trash();
  imageFolder(gas, k, false)?.trash();
  versionFolder(gas, k, false)?.trash();
}

/**
 * Deletes a draft. With `trash` (the owner's "Taslağı sil") it goes to the panel's trash for 30
 * days, images and snapshots kept; without it (after publishing, or when edits to a live post are
 * dropped automatically) it is removed right away, as before.
 */
export function deleteDraft(gas: Gas, p: { key?: unknown; trash?: unknown }): Record<string, never> {
  const k = key(p.key);
  gas.withLock(() => {
    const file = sub(gas, 'taslaklar', false)?.findFile(`${k}.json`);
    if (p.trash === true && file) {
      const item: TrashFile = { deletedAt: new Date(gas.now()).toISOString(), draft: JSON.parse(file.read()) as Draft };
      const bin = sub(gas, TRASH, true);
      const old = bin.findFile(`${k}.json`);
      if (old) old.write(JSON.stringify(item));
      else bin.createFile(`${k}.json`, JSON.stringify(item), 'json');
      file.trash();
    } else {
      file?.trash();
      imageFolder(gas, k, false)?.trash();
      versionFolder(gas, k, false)?.trash();
    }
    changeList(gas, (list) => list.filter((d) => d.key !== k));
  });
  return {};
}

/** The trash, newest first; anything older than 30 days is removed for good on the way. */
export function listTrash(gas: Gas): { items: TrashItem[] } {
  return gas.withLock(() => {
    const now = gas.now();
    const items: TrashItem[] = [];
    for (const f of sub(gas, TRASH, false)?.listFiles() ?? []) {
      let t: TrashFile;
      try {
        t = JSON.parse(f.read()) as TrashFile;
      } catch {
        continue;
      }
      const purgeAt = Date.parse(t.deletedAt) + TRASH_KEEP_MS;
      if (now >= purgeAt) {
        removeForGood(gas, t.draft.key);
        continue;
      }
      items.push({ ...summary(t.draft), deletedAt: t.deletedAt, purgeAt: new Date(purgeAt).toISOString() });
    }
    items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    return { items };
  });
}

export function restoreTrash(gas: Gas, p: { key?: unknown }): { draft: DraftSummary } {
  const k = key(p.key);
  return gas.withLock(() => {
    const file = sub(gas, TRASH, false)?.findFile(`${k}.json`);
    if (!file) throw new ApiError('not_found', 'Bu yazı çöp kutusunda bulunamadı. 30 günü geçtiği için silinmiş olabilir.');
    const drafts = sub(gas, 'taslaklar', true);
    if (drafts.findFile(`${k}.json`)) {
      throw new ApiError('conflict', 'Aynı yazının açık bir taslağı var. Önce o taslağı silin ya da yayınlayın.');
    }
    const t = JSON.parse(file.read()) as TrashFile;
    drafts.createFile(`${k}.json`, JSON.stringify(t.draft), 'json');
    file.trash();
    changeList(gas, (list) => [...list.filter((d) => d.key !== k), summary(t.draft)]);
    return { draft: summary(t.draft) };
  });
}

export function purgeTrash(gas: Gas, p: { key?: unknown }): Record<string, never> {
  const k = key(p.key);
  gas.withLock(() => {
    if (!sub(gas, TRASH, false)?.findFile(`${k}.json`)) {
      throw new ApiError('not_found', 'Bu yazı çöp kutusunda bulunamadı.');
    }
    removeForGood(gas, k);
  });
  return {};
}

export function putImage(gas: Gas, p: { key?: unknown; name?: unknown; base64?: unknown }): Record<string, never> {
  const k = key(p.key);
  const name = imageName(p.name);
  if (typeof p.base64 !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(p.base64)) throw badRequest('Görsel okunamadı.');
  const base64 = p.base64;
  gas.withLock(() => {
    const folder = imageFolder(gas, k, true)!;
    folder.findFile(name)?.trash();
    folder.createFile(name, base64, 'image');
  });
  return {};
}

export function getImage(gas: Gas, p: { key?: unknown; name?: unknown }): { base64: string } {
  const file = imageFolder(gas, key(p.key), false)?.findFile(imageName(p.name));
  if (!file) throw new ApiError('not_found', 'Görsel bulunamadı.');
  return { base64: file.read() };
}
