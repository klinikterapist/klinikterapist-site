/** Draft helpers: a new empty draft, what is still missing before publishing, the automatic slug. */
import type { JSONContent } from '@tiptap/core';
import type { Draft, LangFields } from '../api/types';
import type { Lang } from '../../lib/schemas';
import { slugError } from '../../lib/schemas';
import { slugify } from '../../lib/slug';
import { formatCrop, parseCrop } from '../../lib/crop-area';
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
  const crop = x.coverCrop && typeof x.coverCrop === 'object' ? parseCrop(formatCrop(x.coverCrop)) : null;
  return { ...x, coverOriginal: typeof x.coverOriginal === 'string' ? x.coverOriginal : null, coverCrop: crop, scheduledAt: typeof x.scheduledAt === 'string' ? x.scheduledAt : null, tr: normalizeLang(x.tr), en: normalizeLang(x.en) };
}

/** Local calendar day, `YYYY-MM-DD`. */
export function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Shown wherever a post is planned (the hourly backend run publishes it). */
export const PLAN_HINT = 'Planlanan saatten sonraki bir saat içinde yayınlanır.';

/**
 * The publish times the panel offers (owner's review 2026-10-20: a few good hours, not every minute).
 * Morning commute and start of work, late morning, lunch break, afternoon break, after work, evening.
 */
export const PLAN_TIMES = [
  { value: '08:00', label: '08.00 · sabah, işe giderken' },
  { value: '09:00', label: '09.00 · iş başında' },
  { value: '11:00', label: '11.00 · öğleden önce' },
  { value: '12:30', label: '12.30 · öğle arası' },
  { value: '15:00', label: '15.00 · ikindi molası' },
  { value: '18:00', label: '18.00 · iş çıkışı' },
  { value: '20:00', label: '20.00 · akşam' },
  { value: '21:00', label: '21.00 · akşam, en yoğun saat' },
] as const;

/** Turkey has used a fixed +03:00 (no daylight saving) since 2016. */
const ISTANBUL_OFFSET = '+03:00';
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** Istanbul wall time → instant: `('2026-10-24', '09:00')` → `'2026-10-24T09:00:00+03:00'`. */
export function istanbulIso(day: string, time: string): string {
  return `${day}T${time}:00${ISTANBUL_OFFSET}`;
}

export const isFuture = (iso: string, now: Date) => Date.parse(iso) > now.getTime();

/** An instant's Istanbul day and `HH:MM`. */
export function istanbulParts(iso: string): { day: string; time: string } {
  const t = new Date(Date.parse(iso) + 3 * 3600e3).toISOString();
  return { day: t.slice(0, 10), time: t.slice(11, 16) };
}

/** `'2026-10-24T09:00:00+03:00'` → `'24 Ekim 2026, 09.00'`. */
export function formatSchedule(iso: string): string {
  const { day, time } = istanbulParts(iso);
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS_TR[m - 1]} ${y}, ${time.replace(':', '.')}`;
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
    coverOriginal: null,
    coverCrop: null,
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
