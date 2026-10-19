/**
 * Publishing one draft, end to end: load what is live, gather the images, build the changeset,
 * commit it and delete the Drive draft. The panel's Yayınla and the backend's hourly scheduled
 * publish both run this, so the two can never drift apart.
 */
import type { Api, Draft } from '../api/types';
import { ImageStore } from '../ui/editor/images';
import { frameAttrsOf } from '../../lib/figure-frame';
import { isoDay } from './draft';
import { loadSiteState, type LoadedPost } from './posts-repo';
import { buildPublishChangeset } from './publish';

export type PublishApi = Pick<Api, 'snapshot' | 'read' | 'commit' | 'getImage' | 'putImage' | 'deleteDraft'>;

type Node = { type?: string; attrs?: Record<string, unknown>; content?: unknown[] };

/** Every image the draft uses: figures and their originals, the cover and its original. */
export function draftImageNames(d: Draft): Set<string> {
  const out = new Set<string>();
  const walk = (n: Node) => {
    if (n.type === 'figure' && typeof n.attrs?.src === 'string' && n.attrs.src.replace(/^\.\//, '')) out.add(n.attrs.src.replace(/^\.\//, ''));
    const orig = n.type === 'figure' ? frameAttrsOf(n.attrs).orig : null;
    if (orig) out.add(orig);
    (n.content as Node[] | undefined)?.forEach(walk);
  };
  walk(d.tr.doc as Node);
  walk(d.en.doc as Node);
  if (d.cover) out.add(d.cover);
  if (d.cover && d.coverOriginal) out.add(d.coverOriginal);
  return out;
}

/** Image name → repo path of a live post's committed images. */
export function repoImagesOf(live: Pick<LoadedPost, 'key' | 'files'> | null): Map<string, string> {
  const dir = live ? `src/content/posts/${live.key}/` : '';
  return new Map((live?.files ?? []).filter((f) => !f.path.endsWith('.md')).map((f) => [f.path.slice(dir.length), f.path]));
}

export async function publishDraft(
  api: PublishApi,
  draft: Draft,
  opts: {
    now: Date;
    /** "Yine de yayınla": replace the version published elsewhere. */
    force?: boolean;
    images?: Pick<ImageStore, 'forPublish'>;
    /** Right after the commit, before the Drive draft is deleted (the panel stops autosaving here). */
    onCommitted?: () => void;
  },
): Promise<{ commitSha: string; key: string; notices: string[]; wasLive: boolean }> {
  const site = await loadSiteState(api as Api);
  const live = site.posts.find((p) => p.key === draft.key) ?? null;
  const images = opts.images ?? new ImageStore(api as Api, draft.key, repoImagesOf(live));
  const imgs = await images.forPublish(draftImageNames(draft));
  const toPublish = opts.force && live ? { ...draft, base: { tr: live.tr.sha, en: live.en.sha } } : draft;
  const cs = buildPublishChangeset({
    draft: toPublish,
    live,
    allLive: site.posts,
    redirects: site.redirects,
    categories: site.categories.list,
    images: imgs,
    today: isoDay(opts.now),
  });
  const { commitSha } = await api.commit({
    message: `${live ? 'Yazı güncellendi' : 'Yazı yayınlandı'}: ${draft.tr.title}`,
    writes: cs.writes,
    deletes: cs.deletes,
  });
  opts.onCommitted?.();
  await api.deleteDraft(draft.key).catch(() => {});
  return { commitSha, key: cs.key, notices: cs.notices, wasLive: !!live };
}
