import type { Reference } from './apa/types';
import type { Lang } from './settings';
import { RESERVED_SLUGS } from './schemas';
import { readingTime } from './readingTime';
import { validateCitations } from './citations';

export type PostData = {
  title: string;
  subtitle?: string;
  seoTitle?: string;
  description: string;
  slug: string;
  focusKeyword: string;
  category: string;
  cover?: unknown;
  coverAlt?: string;
  publishedAt: Date;
  updatedAt?: Date;
  references?: Reference[];
  featured?: boolean;
};

/** Minimal shape of an `astro:content` entry that the helpers need. */
export type RawPost = { id: string; body?: string; data: PostData; [k: string]: unknown };

export type PostEntry = RawPost & { key: string; lang: Lang; readingMinutes: number };

const LANGS: Lang[] = ['tr', 'en'];

export function validatePostPairs(ids: string[]): void {
  const byKey = new Map<string, Set<string>>();
  for (const id of ids) {
    const slash = id.lastIndexOf('/');
    const key = id.slice(0, slash);
    const lang = id.slice(slash + 1);
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key)!.add(lang);
  }
  for (const [key, langs] of byKey) {
    for (const lang of LANGS) {
      if (!langs.has(lang)) {
        throw new Error(`Yazı "${key}" için ${lang}.md eksik — her yazı iki dilde olmalı.`);
      }
    }
  }
}

/**
 * Two posts with the same slug in one language would share a URL: Astro only warns and drops
 * one of them. Fail the build instead, naming both post folders.
 */
export function validateUniqueSlugs(entries: { id: string; data: { slug: string } }[]): void {
  const seen = new Map<string, string>();
  for (const { id, data } of entries) {
    const slash = id.lastIndexOf('/');
    const key = id.slice(0, slash);
    const lang = id.slice(slash + 1);
    const k = `${lang}:${data.slug}`;
    const other = seen.get(k);
    if (other !== undefined) {
      throw new Error(
        `"${other}" ve "${key}" yazıları aynı ${lang} slug değerini kullanıyor: "${data.slug}" — her yazının adresi o dilde benzersiz olmalı.`,
      );
    }
    seen.set(k, key);
  }
}

/** A slug equal to the category base path (`kategori` / `category`) would shadow the category pages. */
export function validateReservedSlugs(entries: { id: string; data: { slug: string } }[]): void {
  for (const { id, data } of entries) {
    const slash = id.lastIndexOf('/');
    const key = id.slice(0, slash);
    const lang = id.slice(slash + 1) as Lang;
    if (RESERVED_SLUGS[lang]?.includes(data.slug)) {
      throw new Error(`"${key}" yazısının ${lang} slug değeri "${data.slug}" kategori sayfalarına ayrılmış — başka bir adres seçin.`);
    }
  }
}

export function toPostEntry(entry: RawPost): PostEntry {
  const slash = entry.id.lastIndexOf('/');
  return {
    ...entry,
    key: entry.id.slice(0, slash),
    lang: entry.id.slice(slash + 1) as Lang,
    readingMinutes: readingTime(entry.body ?? ''),
  };
}

export function sortNewestFirst(posts: PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

export function pickRelated(post: PostEntry, all: PostEntry[], n = 3): PostEntry[] {
  const others = sortNewestFirst(all.filter((p) => p.key !== post.key));
  const same = others.filter((p) => p.data.category === post.data.category);
  const rest = others.filter((p) => p.data.category !== post.data.category);
  return [...same, ...rest].slice(0, n);
}

async function loadAll(): Promise<PostEntry[]> {
  // Imported lazily so the pure helpers above stay usable outside an Astro build (Vitest).
  // Not memoized: in `astro dev` a module-level cache would keep serving edited posts stale.
  const { getCollection } = await import('astro:content');
  const entries = (await getCollection('posts')) as unknown as RawPost[];
  validatePostPairs(entries.map((e) => e.id));
  validateUniqueSlugs(entries);
  validateReservedSlugs(entries);
  for (const e of entries) validateCitations(e.body ?? '', e.data.references ?? [], `${e.id}.md`);
  return entries.map(toPostEntry);
}

export async function getPosts(lang: Lang): Promise<PostEntry[]> {
  const all = await loadAll();
  return sortNewestFirst(all.filter((p) => p.lang === lang));
}

export async function getTranslation(post: PostEntry): Promise<PostEntry> {
  const other: Lang = post.lang === 'tr' ? 'en' : 'tr';
  const found = (await loadAll()).find((p) => p.key === post.key && p.lang === other);
  if (!found) throw new Error(`Yazı "${post.key}" için ${other}.md eksik — her yazı iki dilde olmalı.`);
  return found;
}

export async function getRelated(post: PostEntry, n = 3): Promise<PostEntry[]> {
  return pickRelated(post, await getPosts(post.lang), n);
}
