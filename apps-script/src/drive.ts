/**
 * Drafts and draft images in the owner's Drive (spec §8.4): `Klinikterapist Panel/taslaklar/<key>.json`
 * and `Klinikterapist Panel/gorseller/<key>/<name>`. Nothing here touches GitHub.
 */
import type { Draft, DraftSummary, VersionSummary } from '../../src/admin/api/types';
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

export function listDrafts(gas: Gas): { drafts: DraftSummary[] } {
  const folder = sub(gas, 'taslaklar', false);
  const drafts = (folder?.listFiles() ?? [])
    .filter((f) => f.getName().endsWith('.json'))
    .map((f): DraftSummary => {
      const d = JSON.parse(f.read()) as Draft;
      return { key: d.key, rev: d.rev, updatedAt: d.updatedAt, published: d.published, category: d.category, title: { tr: d.tr.title, en: d.en.title } };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { drafts };
}

/** Moves the draft and its images to Drive trash (recoverable for 30 days). */
export function deleteDraft(gas: Gas, p: { key?: unknown }): Record<string, never> {
  const k = key(p.key);
  gas.withLock(() => {
    sub(gas, 'taslaklar', false)?.findFile(`${k}.json`)?.trash();
    imageFolder(gas, k, false)?.trash();
    versionFolder(gas, k, false)?.trash();
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
