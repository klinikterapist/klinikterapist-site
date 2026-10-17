/** Loading what is live in the repo, and turning it into editable drafts and list rows. */
import type { Api, Draft, DraftSummary, LangFields } from '../api/types';
import { parseCategories, parseRedirects, type Category, type Lang } from '../../lib/schemas';
import { normalizeDraft } from './draft';
import { parsePost, type PostFrontmatter } from './frontmatter';
import { markdownToDoc } from './markdown';
import type { LivePost, RedirectsFile } from './publish';

export type LoadedPost = LivePost & { body: Record<Lang, string> };
export type SiteState = {
  posts: LoadedPost[];
  redirects: RedirectsFile;
  categories: { list: Category[]; sha: string };
};

const POST_FILE = /^src\/content\/posts\/([a-z0-9-]+)\/(tr|en)\.md$/;

export async function loadSiteState(api: Api): Promise<SiteState> {
  const { files } = await api.tree();
  const postPaths = files.filter((f) => POST_FILE.test(f.path)).map((f) => f.path);
  const wanted = [...postPaths, 'src/data/redirects.json', 'src/data/categories.json'].filter((p) => files.some((f) => f.path === p));
  const read = wanted.length ? (await api.read(wanted)).files : [];
  const byPath = new Map(read.map((f) => [f.path, f]));

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
  return {
    posts,
    redirects: { list: r ? parseRedirects(JSON.parse(r.content)) : [], sha: r?.sha ?? '' },
    categories: { list: c ? parseCategories(JSON.parse(c.content)) : [], sha: c?.sha ?? '' },
  };
}

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
    publishedAt: p.tr.fm.publishedAt,
    base: { tr: p.tr.sha, en: p.en.sha },
    tr: langFields(p.tr.fm, p.body.tr),
    en: langFields(p.en.fm, p.body.en),
  });
}

export type PostStatus = 'taslak' | 'yayında' | 'yayında-değişiklik-var';
export type PostRow = { key: string; title: string; titleEn: string; category: string; status: PostStatus; updatedAt: string };

export const STATUS_LABEL: Record<PostStatus, string> = {
  taslak: 'Taslak',
  yayında: 'Yayında',
  'yayında-değişiklik-var': 'Yayında · kaydedilmemiş değişiklik',
};

export function mergeList(live: LivePost[], drafts: DraftSummary[]): PostRow[] {
  const rows: PostRow[] = [];
  const draftByKey = new Map(drafts.map((d) => [d.key, d]));
  for (const d of drafts) {
    const isLive = live.some((p) => p.key === d.key);
    rows.push({
      key: d.key,
      title: d.title.tr.trim() || d.title.en.trim() || 'Başlıksız taslak',
      titleEn: d.title.en,
      category: d.category,
      status: isLive ? 'yayında-değişiklik-var' : 'taslak',
      updatedAt: d.updatedAt,
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
    });
  }
  return rows;
}
