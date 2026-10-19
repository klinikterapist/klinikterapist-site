/**
 * What to commit when the owner publishes, unpublishes or edits categories. Pure: the caller
 * loads the live state and sends the result to `site.commit`.
 */
import type { JSONContent } from '@tiptap/core';
import type { CommitDelete, CommitWrite, Draft } from '../api/types';
import { formatCrop } from '../../lib/crop-area';
import { parseCategories, postFrontmatterSchema, type Category, type Lang, type Redirect } from '../../lib/schemas';
import { categoryPath, pathFor, postPath } from '../../i18n/routes';
import { canPublish, describeMissing } from './draft';
import { serializePost, type PostFrontmatter } from './frontmatter';
import { docToMarkdown } from './markdown';
import { applyPathChanges, redirectsJson, type PathChange } from './redirects';

export class PublishError extends Error {
  constructor(
    message: string,
    /** `stale`: the live post changed since this draft was started from it. */
    readonly code?: 'stale',
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

export type LivePost = {
  key: string;
  tr: { fm: PostFrontmatter; sha: string };
  en: { fm: PostFrontmatter; sha: string };
  /** Every file in the post folder (Markdown and images). */
  files: { path: string; sha: string }[];
};

export type RedirectsFile = { list: Redirect[]; sha: string };
export type Changeset = { writes: CommitWrite[]; deletes: CommitDelete[]; notices: string[] };

const LANGS: Lang[] = ['tr', 'en'];
const LANG_NAME: Record<Lang, string> = { tr: 'Türkçe', en: 'İngilizce' };
const REDIRECTS_PATH = 'src/data/redirects.json';
const postDir = (key: string) => `src/content/posts/${key}/`;

function figureNames(doc: JSONContent, out: Set<string>): Set<string> {
  if (doc.type === 'figure') {
    const src = String(doc.attrs?.src ?? '');
    if (src.startsWith('./')) out.add(src.slice(2));
  }
  doc.content?.forEach((c) => figureNames(c, out));
  return out;
}

function uniqueKey(slug: string, taken: Set<string>): string {
  if (!taken.has(slug)) return slug;
  for (let i = 2; ; i++) if (!taken.has(`${slug}-${i}`)) return `${slug}-${i}`;
}

function redirectsWrite(before: RedirectsFile, changes: PathChange[], livePaths: Set<string>) {
  const { redirects, notices } = applyPathChanges(before.list, changes, livePaths);
  const changed = JSON.stringify(redirects) !== JSON.stringify(before.list);
  const write: CommitWrite | null = changed
    ? { path: REDIRECTS_PATH, content: redirectsJson(redirects), encoding: 'utf8', expectSha: before.sha }
    : null;
  return { write, notices };
}

export function buildPublishChangeset(input: {
  draft: Draft;
  live: LivePost | null;
  allLive: LivePost[];
  redirects: RedirectsFile;
  categories: Category[];
  /** Image name → data. `inRepo`: already committed in this post folder, unchanged. */
  images: Map<string, { base64: string; inRepo: boolean }>;
  /** `YYYY-MM-DD` */
  today: string;
}): Changeset & { key: string } {
  const { draft, live, allLive } = input;
  const check = canPublish(draft);
  if (!check.ok) throw new PublishError(`Yayınlamadan önce tamamlayın:\n${describeMissing(check).join('\n')}`);

  if (live && draft.base && (draft.base.tr !== live.tr.sha || draft.base.en !== live.en.sha)) {
    throw new PublishError('Bu yazının yayındaki sürümü siz düzenlerken başka bir cihazda güncellenmiş.', 'stale');
  }
  const key = live?.key ?? uniqueKey(draft.tr.slug, new Set(allLive.map((p) => p.key)));
  const others = allLive.filter((p) => p.key !== key);
  const schema = postFrontmatterSchema(input.categories.map((c) => c.id));
  const writes: CommitWrite[] = [];

  for (const lang of LANGS) {
    const f = draft[lang];
    const clash = others.find((p) => p[lang].fm.slug === f.slug);
    if (clash) {
      throw new PublishError(
        `"${clash[lang].fm.title}" yazısı ${LANG_NAME[lang]} "${f.slug}" adresini zaten kullanıyor; "${f.title}" için başka bir URL kısa adı seçin.`,
      );
    }
    const fm: PostFrontmatter = {
      title: f.title.trim(),
      ...(f.subtitle.trim() ? { subtitle: f.subtitle.trim() } : {}),
      ...(f.seoTitle.trim() ? { seoTitle: f.seoTitle.trim() } : {}),
      description: f.description.trim(),
      slug: f.slug,
      focusKeyword: f.focusKeyword.trim(),
      category: draft.category,
      ...(draft.cover ? { cover: `./${draft.cover}`, coverAlt: f.coverAlt.trim() } : {}),
      ...(draft.cover && draft.coverOriginal ? { coverOriginal: `./${draft.coverOriginal}` } : {}),
      ...(draft.cover && draft.coverCrop ? { coverCrop: formatCrop(draft.coverCrop) } : {}),
      publishedAt: draft.publishedAt,
      ...(live ? { updatedAt: input.today } : {}),
      ...(f.references.length ? { references: f.references } : {}),
      ...(draft.featured ? { featured: true } : {}),
    };
    const valid = schema.safeParse(fm);
    if (!valid.success) throw new PublishError(`${LANG_NAME[lang]}: ${valid.error.issues.map((i) => i.message).join('; ')}`);
    let body: string;
    try {
      body = docToMarkdown(f.doc, lang, f.references);
    } catch (e) {
      throw new PublishError(`${LANG_NAME[lang]}: ${(e as Error).message}`);
    }
    writes.push({
      path: `${postDir(key)}${lang}.md`,
      content: serializePost(fm, body),
      encoding: 'utf8',
      expectSha: live?.[lang].sha ?? null,
    });
  }

  // Images: upload new or replaced ones, delete the ones no longer used.
  const used = figureNames(draft.en.doc, figureNames(draft.tr.doc, new Set()));
  if (draft.cover) used.add(draft.cover);
  if (draft.cover && draft.coverOriginal) used.add(draft.coverOriginal);
  const repoFiles = new Map((live?.files ?? []).map((f) => [f.path, f.sha]));
  for (const name of used) {
    const img = input.images.get(name);
    const path = `${postDir(key)}${name}`;
    if (img?.inRepo && repoFiles.has(path)) continue;
    if (!img) throw new PublishError(`Görsel bulunamadı: ${name}. Görseli yeniden ekleyip tekrar deneyin.`);
    writes.push({ path, content: img.base64, encoding: 'base64', expectSha: repoFiles.get(path) ?? null });
  }
  const deletes: CommitDelete[] = (live?.files ?? [])
    .filter((f) => !f.path.endsWith('.md') && !used.has(f.path.slice(postDir(key).length)))
    .map((f) => ({ path: f.path, expectSha: f.sha }));

  const changes: PathChange[] = live
    ? LANGS.map((lang) => ({ from: postPath(live[lang].fm.slug, lang), to: postPath(draft[lang].slug, lang) }))
    : [];
  const newPaths = new Set(LANGS.map((lang) => postPath(draft[lang].slug, lang)));
  const r = redirectsWrite(input.redirects, changes, newPaths);
  if (r.write) writes.push(r.write);
  return { key, writes, deletes, notices: r.notices };
}

export function buildUnpublishChangeset(live: LivePost, redirects: RedirectsFile): Changeset {
  const changes = LANGS.map((lang) => ({ from: postPath(live[lang].fm.slug, lang), to: pathFor('blog', lang) }));
  const r = redirectsWrite(redirects, changes, new Set());
  return {
    writes: r.write ? [r.write] : [],
    deletes: live.files.map((f) => ({ path: f.path, expectSha: f.sha })),
    notices: r.notices,
  };
}

export function buildCategoryChangeset(input: {
  before: Category[];
  after: Category[];
  /** sha of categories.json */
  sha: string;
  /** Category ids used by a live post or a draft. */
  usedIds: Set<string>;
  redirects: RedirectsFile;
}): Changeset {
  const { before, after } = input;
  const afterIds = new Set(after.map((c) => c.id));
  const removed = before.filter((c) => !afterIds.has(c.id));
  if (removed.some((c) => input.usedIds.has(c.id))) {
    throw new PublishError('Bu kategoride yazı ya da taslak var; önce onları başka kategoriye taşıyın.');
  }
  let valid: Category[];
  try {
    valid = parseCategories(after);
  } catch (e) {
    throw new PublishError((e as Error).message);
  }
  const changes: PathChange[] = [];
  for (const old of before) {
    const now = valid.find((c) => c.id === old.id);
    for (const lang of LANGS) {
      // A removed category's page disappears: send its visitors to the blog.
      const to = now ? categoryPath(now, lang) : pathFor('blog', lang);
      changes.push({ from: categoryPath(old, lang), to });
    }
  }
  const livePaths = new Set(valid.flatMap((c) => LANGS.map((lang) => categoryPath(c, lang))));
  const r = redirectsWrite(input.redirects, changes, livePaths);
  const writes: CommitWrite[] = [
    { path: 'src/data/categories.json', content: `${JSON.stringify(valid, null, 2)}\n`, encoding: 'utf8', expectSha: input.sha },
  ];
  if (r.write) writes.push(r.write);
  return { writes, deletes: [], notices: r.notices };
}
