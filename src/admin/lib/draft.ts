/** Draft helpers: a new empty draft, what is still missing before publishing, the automatic slug. */
import type { JSONContent } from '@tiptap/core';
import type { Draft, LangFields } from '../api/types';
import type { Lang } from '../../lib/schemas';
import { slugError } from '../../lib/schemas';
import { slugify } from '../../lib/slug';
import { sanitizeCiteItems } from '../../lib/citations';
import type { CiteItem } from '../../lib/apa';

export type { Draft, LangFields };

export const LANG_LABEL: Record<Lang, string> = { tr: 'Türkçe', en: 'İngilizce' };

export const emptyDoc = (): JSONContent => ({ type: 'doc', content: [{ type: 'paragraph' }] });

const emptyLang = (): LangFields => ({
  title: '', subtitle: '', seoTitle: '', slug: '', slugTouched: false, description: '', focusKeyword: '', coverAlt: '', doc: emptyDoc(), references: [],
});

/** Shown in place of a stored citation that has no usable reference id. */
export const INVALID_CITATION = '[geçersiz atıf]';

/** Drafts from Drive are not shape-checked: keep each citation's valid items; one with none becomes text. */
function repairCitations(node: JSONContent): JSONContent {
  if (node?.type === 'citation') {
    const raw: unknown = node.attrs?.items;
    const items: CiteItem[] = [];
    for (const item of Array.isArray(raw) ? raw : []) {
      try {
        items.push(...sanitizeCiteItems([item as CiteItem]));
      } catch {
        /* invalid id: leave the item out */
      }
    }
    if (!items.length) return { type: 'text', text: INVALID_CITATION };
    return { ...node, attrs: { items, narrative: node.attrs?.narrative === true } };
  }
  return Array.isArray(node?.content) ? { ...node, content: node.content.map(repairCitations) } : node;
}

const normalizeLang = (v: unknown): LangFields => {
  const f = (v && typeof v === 'object' ? v : {}) as Partial<LangFields>;
  const base = { ...emptyLang(), ...f };
  return {
    ...base,
    subtitle: f.subtitle ?? '',
    references: Array.isArray(f.references) ? f.references : [],
    doc: base.doc && typeof base.doc === 'object' ? repairCitations(base.doc) : emptyDoc(),
  };
};

/** Fill the fields older drafts lack. Apply on every path a draft enters the editor. */
export function normalizeDraft(d: unknown): Draft {
  const x = d as Draft;
  return { ...x, tr: normalizeLang(x.tr), en: normalizeLang(x.en) };
}

/** Local calendar day, `YYYY-MM-DD`. */
export function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newDraft(now: Date): Draft {
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return {
    key: `taslak-${now.getTime().toString(36)}${random}`,
    rev: 0,
    updatedAt: '',
    published: false,
    category: '',
    cover: null,
    publishedAt: isoDay(now),
    tr: emptyLang(),
    en: emptyLang(),
  };
}

export function hasText(doc: JSONContent): boolean {
  if (doc.type === 'text') return !!doc.text?.trim();
  return (doc.content ?? []).some(hasText);
}

/** Turkish labels of what this language still needs; empty when it is ready. */
export function missingFields(f: LangFields, lang: Lang, hasCover = false): string[] {
  const out: string[] = [];
  if (!f.title.trim()) out.push('Başlık');
  if (!f.slug) out.push('URL kısa adı');
  else {
    const err = slugError(f.slug, lang);
    if (err) out.push(err);
  }
  if (!f.description.trim()) out.push('Meta açıklama');
  if (!f.focusKeyword.trim()) out.push('Odak kelime');
  if (!hasText(f.doc)) out.push('Yazı metni boş');
  if (hasCover && !f.coverAlt.trim()) out.push('Kapak görselinin alt metni');
  return out;
}

export type PublishCheck = { ok: boolean; missing: { tr: string[]; en: string[]; shared: string[] } };

export function canPublish(d: Draft): PublishCheck {
  const missing = {
    tr: missingFields(d.tr, 'tr', !!d.cover),
    en: missingFields(d.en, 'en', !!d.cover),
    shared: d.category ? [] : ['Kategori'],
  };
  return { ok: !missing.tr.length && !missing.en.length && !missing.shared.length, missing };
}

/** One line per problem: `İngilizce: Yazı metni boş`. */
export function describeMissing(r: PublishCheck): string[] {
  return [
    ...r.missing.shared,
    ...r.missing.tr.map((m) => `${LANG_LABEL.tr}: ${m}`),
    ...r.missing.en.map((m) => `${LANG_LABEL.en}: ${m}`),
  ];
}

export function autoSlug(f: LangFields, lang: Lang): string {
  return f.slugTouched ? f.slug : slugify(f.title, lang);
}
