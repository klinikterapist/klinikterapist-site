/**
 * The publish checklist in the Ayarlar panel (spec §5.4.1): everything a post needs before it can be
 * published (the same rules as `canPublish`, plus registered references) and what is recommended.
 * Each item names the language and the panel field it is about, so clicking it can go there.
 */
import type { JSONContent } from '@tiptap/core';
import type { Draft, LangFields } from '../api/types';
import type { Lang } from '../../lib/schemas';
import { slugError } from '../../lib/schemas';
import { UnknownReferenceError } from '../../lib/citations';
import { hasText, LANG_LABEL } from './draft';
import { docToMarkdown } from './markdown';

export type RailPanel = 'settings' | 'seo' | 'meta';

export type ChecklistItem = { id: string; label: string; done: boolean; required: boolean; lang: Lang | null; panel: RailPanel; field: string };

/** Fields that live in the writing area rather than in a rail panel. */
export const EDITOR_FIELDS = new Set(['title', 'subtitle', 'body', 'references']);

const LANGS: Lang[] = ['tr', 'en'];

/** False when a citation in the text points to a reference that is not in this language's list. */
function referencesKnown(f: LangFields, lang: Lang): boolean {
  try {
    docToMarkdown(f.doc, lang, f.references);
    return true;
  } catch (e) {
    if (e instanceof UnknownReferenceError) return false;
    throw e;
  }
}

function figuresHaveAlt(node: JSONContent): boolean {
  if (node.type === 'figure' && !String(node.attrs?.alt ?? '').trim()) return false;
  return (node.content ?? []).every(figuresHaveAlt);
}

/** Required items first (with the labels `describeMissing` uses when they are missing), then recommended ones. */
export function publishChecklist(d: Draft, seoScore: Record<Lang, number>): ChecklistItem[] {
  const hasCover = !!d.cover;
  const required: ChecklistItem[] = [
    { id: 'category', label: 'Kategori', done: !!d.category, required: true, lang: null, panel: 'settings', field: 'category' },
  ];
  for (const lang of LANGS) {
    const f = d[lang];
    const item = (field: string, label: string, done: boolean, panel: RailPanel): ChecklistItem => ({
      id: `${lang}-${field}`, label: `${LANG_LABEL[lang]}: ${label}`, done, required: true, lang, panel, field,
    });
    const slugProblem = f.slug ? slugError(f.slug, lang) : null;
    const body = hasText(f.doc);
    required.push(
      item('title', 'Başlık', !!f.title.trim(), 'settings'),
      item('slug', slugProblem ?? 'URL kısa adı', !!f.slug && !slugProblem, 'meta'),
      item('description', 'Meta açıklama', !!f.description.trim(), 'meta'),
      item('focusKeyword', 'Odak kelime', !!f.focusKeyword.trim(), 'seo'),
      item('body', body ? 'Yazı metni' : 'Yazı metni boş', body, 'settings'),
    );
    if (hasCover) required.push(item('coverAlt', 'Kapak görselinin alt metni', !!f.coverAlt.trim(), 'meta'));
    required.push(item('references', 'atıfların referansları kayıtlı', referencesKnown(f, lang), 'settings'));
  }

  const perLang = (key: string, label: string, field: string, panel: RailPanel, done: (f: LangFields, lang: Lang) => boolean): ChecklistItem[] =>
    LANGS.map((lang) => ({ id: `${lang}-${key}`, label: `${LANG_LABEL[lang]}: ${label}`, done: done(d[lang], lang), required: false, lang, panel, field }));
  const recommended: ChecklistItem[] = [
    { id: 'cover', label: 'Kapak görseli eklendi', done: hasCover, required: false, lang: null, panel: 'settings', field: 'cover' },
    ...perLang('subtitle', 'alt başlık var', 'subtitle', 'settings', (f) => !!f.subtitle.trim()),
    ...perLang('figureAlt', 'görsellerin alt metni var', 'body', 'settings', (f) => figuresHaveAlt(f.doc)),
    ...perLang('seoScore', 'SEO puanı 80 ve üzeri', 'seoScore', 'seo', (_f, lang) => seoScore[lang] >= 80),
    ...perLang('descriptionLength', 'meta açıklama 120–158 karakter', 'description', 'meta', (f) => {
      const n = f.description.trim().length;
      return n >= 120 && n <= 158;
    }),
  ];

  // Missing required items come in describeMissing's order: shared, then Türkçe, then İngilizce.
  return [...required, ...recommended];
}
