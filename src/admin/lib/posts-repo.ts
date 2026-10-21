/** Loading what is live in the repo, and turning it into editable drafts and list rows. */
import type { Api, Draft, DraftSummary, LangFields } from '../api/types';
import { parseCategories, parseRedirects, parseSeo, type Category, type Lang } from '../../lib/schemas';
import { parseCrop } from '../../lib/crop-area';
import { normalizeDraft } from './draft';
import { parsePost, type PostFrontmatter } from './frontmatter';
import { markdownToDoc } from './markdown';
import type { LivePost, RedirectsFile } from './publish';
import { readingTime } from '../../lib/readingTime';

export type LoadedPost = LivePost & { body: Record<Lang, string> };
export type SiteState = {
  posts: LoadedPost[];
  redirects: RedirectsFile;
  categories: { list: Category[]; sha: string };
  /** Site name per language from seo.json; null when that file is missing or unreadable. */
  siteName: Record<Lang, string> | null;
};

const POST_FILE = /^src\/content\/posts\/([a-z0-9-]+)\/(tr|en)\.md$/;

/**
 * The last loaded state, so returning to Home or Posts shows it at once (`onCached`) while a fresh
 * copy loads. Every call still fetches; the cached copy is only ever shown first.
 */
const lastState = new WeakMap<Api, SiteState>();

/** What is live: one `site.snapshot` call (the tree plus every post and data file, read at once). */
export async function loadSiteState(api: Api, opts: { onCached?: (s: SiteState) => void } = {}): Promise<SiteState> {
  const cached = lastState.get(api);
  if (cached && opts.onCached) opts.onCached(cached);
  const { files, contents } = await api.snapshot();
  const postPaths = files.filter((f) => POST_FILE.test(f.path)).map((f) => f.path);
  const byPath = new Map(contents.map((f) => [f.path, f]));

  const keys = [...new Set(postPaths.map((p) => p.match(POST_FILE)![1]))];
  const posts: LoadedPost[] = [];
  for (const key of keys) {
    const tr = byPath.get(`src/content/posts/${key}/tr.md`);
    const en = byPath.get(`src/content/posts/${key}/en.md`);
    if (!tr || !en) continue;
    const t = parsePost(tr.content);
    const e = parsePost(en.content);
    posts.push({
      key,
      tr: { fm: t.fm, sha: tr.sha },
      en: { fm: e.fm, sha: en.sha },
      body: { tr: t.body, en: e.body },
      files: files.filter((f) => f.path.startsWith(`src/content/posts/${key}/`)).map((f) => ({ path: f.path, sha: f.sha })),
    });
  }
  posts.sort((a, b) => b.tr.fm.publishedAt.localeCompare(a.tr.fm.publishedAt));

  const r = byPath.get('src/data/redirects.json');
  const c = byPath.get('src/data/categories.json');
  let siteName: SiteState['siteName'] = null;
  try {
    const seo = byPath.get('src/data/seo.json');
    if (seo) siteName = parseSeo(JSON.parse(seo.content)).siteName;
  } catch {
    siteName = null;
  }
  const state: SiteState = {
    posts,
    redirects: { list: r ? parseRedirects(JSON.parse(r.content)) : [], sha: r?.sha ?? '' },
    categories: { list: c ? parseCategories(JSON.parse(c.content)) : [], sha: c?.sha ?? '' },
    siteName,
  };
  lastState.set(api, state);
  return state;
}

/** The drafts list from the last visit to Home or Posts, per API client (shown with the cached state). */
const lastDrafts = new WeakMap<Api, DraftSummary[]>();

export async function loadDrafts(api: Api): Promise<DraftSummary[]> {
  const { drafts } = await api.listDrafts();
  lastDrafts.set(api, drafts);
  return drafts;
}

export const cachedDrafts = (api: Api): DraftSummary[] | null => lastDrafts.get(api) ?? null;

function langFields(fm: PostFrontmatter, body: string): LangFields {
  return {
    title: fm.title,
    subtitle: fm.subtitle ?? '',
    seoTitle: fm.seoTitle ?? '',
    slug: fm.slug,
    slugTouched: true,
    description: fm.description,
    focusKeyword: fm.focusKeyword,
    coverAlt: fm.coverAlt ?? '',
    doc: markdownToDoc(body),
    references: fm.references ?? [],
  };
}

export function liveToDraft(p: LoadedPost): Draft {
  return normalizeDraft({
    key: p.key,
    rev: 0,
    updatedAt: '',
    published: true,
    category: p.tr.fm.category,
    cover: p.tr.fm.cover ? p.tr.fm.cover.replace(/^\.\//, '') : null,
    coverOriginal: p.tr.fm.coverOriginal ? p.tr.fm.coverOriginal.replace(/^\.\//, '') : null,
    coverCrop: p.tr.fm.coverCrop ? parseCrop(p.tr.fm.coverCrop) : null,
    publishedAt: p.tr.fm.publishedAt,
    ...(p.tr.fm.featured ? { featured: true } : {}),
    base: { tr: p.tr.sha, en: p.en.sha },
    tr: langFields(p.tr.fm, p.body.tr),
    en: langFields(p.en.fm, p.body.en),
  });
}

const triggered = new WeakSet<Api>();

/** Asks the backend once per session for its hourly trigger, which publishes planned posts. Errors are ignored. */
export function ensureTriggersOnce(api: Api): void {
  if (triggered.has(api)) return;
  triggered.add(api);
  api.ensureTriggers().catch(() => triggered.delete(api));
}

export type PostStatus = 'taslak' | 'yayında' | 'yayında-değişiklik-var' | 'planlandı';
/** `live`: a version of the post is on the site; `scheduledAt`: when a planned draft goes live. */
export type PostRow = {
  key: string;
  title: string;
  titleEn: string;
  category: string;
  status: PostStatus;
  updatedAt: string;
  live: boolean;
  scheduledAt: string | null;
  /** The live post's date (Yayınlanma tarihi); null for a draft never published. */
  publishedAt?: string | null;
  /** Reading time of the live Turkish text, in minutes (as the site shows it); null when unknown. */
  minutes?: number | null;
  /** Repo path of the live post's cover, for the list's thumbnail; null without one. */
  coverPath?: string | null;
};

/** The live post's cover file in the repo (`src/content/posts/<key>/cover.webp`), or null. */
export function coverPathOf(p: LivePost): string | null {
  const name = p.tr.fm.cover?.replace(/^\.\//, '');
  return name ? `src/content/posts/${p.key}/${name}` : null;
}

const minutesOf = (p: LivePost) => ('body' in p ? readingTime((p as LoadedPost).body.tr) : null);

export const STATUS_LABEL: Record<PostStatus, string> = {
  taslak: 'Taslak',
  yayında: 'Yayında',
  'yayında-değişiklik-var': 'Yayında · kaydedilmemiş değişiklik',
  planlandı: 'Planlandı',
};

export function mergeList(live: LivePost[], drafts: DraftSummary[]): PostRow[] {
  const rows: PostRow[] = [];
  const draftByKey = new Map(drafts.map((d) => [d.key, d]));
  for (const d of drafts) {
    const lp = live.find((p) => p.key === d.key);
    const isLive = !!lp;
    rows.push({
      key: d.key,
      title: d.title.tr.trim() || d.title.en.trim() || 'Başlıksız taslak',
      titleEn: d.title.en,
      category: d.category,
      status: d.scheduledAt ? 'planlandı' : isLive ? 'yayında-değişiklik-var' : 'taslak',
      updatedAt: d.updatedAt,
      live: isLive,
      scheduledAt: d.scheduledAt ?? null,
      publishedAt: lp ? lp.tr.fm.publishedAt : null,
      minutes: lp ? minutesOf(lp) : null,
      coverPath: lp ? coverPathOf(lp) : null,
    });
  }
  for (const p of live) {
    if (draftByKey.has(p.key)) continue;
    rows.push({
      key: p.key,
      title: p.tr.fm.title,
      titleEn: p.en.fm.title,
      category: p.tr.fm.category,
      status: 'yayında',
      updatedAt: p.tr.fm.updatedAt ?? p.tr.fm.publishedAt,
      live: true,
      scheduledAt: null,
      publishedAt: p.tr.fm.publishedAt,
      minutes: minutesOf(p),
      coverPath: coverPathOf(p),
    });
  }
  return rows;
}
