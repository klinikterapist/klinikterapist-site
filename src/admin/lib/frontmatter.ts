/**
 * Post files (`src/content/posts/<key>/<lang>.md`): YAML frontmatter + Markdown body.
 * Values are written JSON-encoded (valid YAML) in a fixed key order, dates as bare `YYYY-MM-DD`.
 */
import { parse } from 'yaml';
import type { Reference } from '../../lib/apa/types';

export type PostFrontmatter = {
  title: string;
  subtitle?: string;
  seoTitle?: string;
  description: string;
  slug: string;
  focusKeyword: string;
  category: string;
  /** Relative image path, `./cover.webp`. */
  cover?: string;
  coverAlt?: string;
  /** `YYYY-MM-DD` */
  publishedAt: string;
  updatedAt?: string;
  references?: Reference[];
  featured?: boolean;
};

const ORDER = ['title', 'subtitle', 'seoTitle', 'description', 'slug', 'focusKeyword', 'category', 'cover', 'coverAlt', 'publishedAt', 'updatedAt', 'references', 'featured'] as const;
const DATES = new Set(['publishedAt', 'updatedAt']);

export function serializePost(fm: PostFrontmatter, body: string): string {
  const lines = ORDER.flatMap((k) => {
    const v = fm[k];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return [];
    return [`${k}: ${DATES.has(k) ? v : JSON.stringify(v)}`];
  });
  return `---\n${lines.join('\n')}\n---\n\n${body.replace(/^\n+/, '')}`;
}

const day = (v: unknown): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

export function parsePost(text: string): { fm: PostFrontmatter; body: string } {
  const normalized = text.replace(/\r\n/g, '\n');
  const m = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) throw new Error('Yazı dosyasının başında frontmatter (--- ile başlayan bölüm) yok.');
  const raw = (parse(m[1]) ?? {}) as Record<string, unknown>;
  const fm: PostFrontmatter = {
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    slug: String(raw.slug ?? ''),
    focusKeyword: String(raw.focusKeyword ?? ''),
    category: String(raw.category ?? ''),
    publishedAt: day(raw.publishedAt) ?? '',
  };
  if (raw.subtitle) fm.subtitle = String(raw.subtitle);
  if (raw.seoTitle) fm.seoTitle = String(raw.seoTitle);
  if (raw.cover) fm.cover = String(raw.cover);
  if (raw.coverAlt) fm.coverAlt = String(raw.coverAlt);
  const updated = day(raw.updatedAt);
  if (updated) fm.updatedAt = updated;
  if (raw.featured === true) fm.featured = true;
  if (Array.isArray(raw.references) && raw.references.length) fm.references = raw.references as Reference[];
  // Keep the object's key order equal to ORDER, so equal frontmatter compares equal.
  const ordered = Object.fromEntries(ORDER.filter((k) => fm[k] !== undefined).map((k) => [k, fm[k]])) as PostFrontmatter;
  return { fm: ordered, body: normalized.slice(m[0].length).replace(/^\n+/, '') };
}
