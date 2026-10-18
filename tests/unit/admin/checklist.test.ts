import { describe, it, expect } from 'vitest';
import { publishChecklist } from '../../../src/admin/lib/checklist';
import { canPublish, describeMissing, newDraft } from '../../../src/admin/lib/draft';
import type { Draft, LangFields } from '../../../src/admin/api/types';

const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metin.' }] }] };
const filled = (title: string, slug: string): LangFields => ({
  title, subtitle: '', seoTitle: '', slug, slugTouched: false, description: 'Açıklama', focusKeyword: 'kelime', coverAlt: '', doc: body, references: [],
});
const empty = () => newDraft(new Date('2026-10-17T10:00:00'));
const complete = (): Draft => ({ ...empty(), category: 'terapi', tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
const scores = { tr: 90, en: 90 };
const open = (d: Draft, s = scores) => publishChecklist(d, s).filter((i) => !i.done);

describe('publishChecklist', () => {
  it('required items match canPublish', () => {
    const d = empty();
    const items = publishChecklist(d, { tr: 0, en: 0 });
    const missing = items.filter((i) => i.required && !i.done);
    expect(missing.length).toBe(describeMissing(canPublish(d)).length);
    expect(missing.map((i) => i.label)).toEqual(describeMissing(canPublish(d)));
  });

  it('a complete draft has every required item done; recommended ones stay open without a cover', () => {
    const items = publishChecklist(complete(), scores);
    expect(items.filter((i) => i.required && !i.done)).toEqual([]);
    expect(open(complete()).map((i) => i.label)).toEqual([
      'Kapak görseli eklendi',
      'Türkçe: alt başlık var',
      'İngilizce: alt başlık var',
      'Türkçe: meta açıklama 120–158 karakter',
      'İngilizce: meta açıklama 120–158 karakter',
    ]);
    expect(open(complete()).every((i) => !i.required)).toBe(true);
  });

  it('coverAlt is required per language only when a cover is set', () => {
    expect(publishChecklist(complete(), scores).some((i) => i.field === 'coverAlt')).toBe(false);
    const d = { ...complete(), cover: 'cover.jpg', tr: { ...complete().tr, coverAlt: 'Bir fincan çay' } };
    const alt = publishChecklist(d, scores).filter((i) => i.field === 'coverAlt');
    expect(alt.map((i) => [i.label, i.done, i.required])).toEqual([
      ['Türkçe: Kapak görselinin alt metni', true, true],
      ['İngilizce: Kapak görselinin alt metni', false, true],
    ]);
  });

  it('each item names the panel that holds its field', () => {
    const items = publishChecklist(empty(), { tr: 0, en: 0 });
    const panels = (field: string) => [...new Set(items.filter((i) => i.field === field).map((i) => i.panel))];
    expect(panels('description')).toEqual(['meta']);
    expect(panels('focusKeyword')).toEqual(['seo']);
    expect(panels('category')).toEqual(['settings']);
    expect(panels('slug')).toEqual(['meta']);
  });

  it('a citation without its reference is a required item, pointing to its language', () => {
    const cited = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metin ' }, { type: 'citation', attrs: { items: [{ id: 'ray2004' }], narrative: false } }] }] };
    const d = { ...complete(), en: { ...complete().en, doc: cited } };
    const item = publishChecklist(d, scores).find((i) => i.id === 'en-references')!;
    expect(item).toMatchObject({ label: 'İngilizce: atıfların referansları kayıtlı', done: false, required: true, lang: 'en', panel: 'settings', field: 'references' });
    expect(publishChecklist(d, scores).find((i) => i.id === 'tr-references')!.done).toBe(true);
  });

  it('recommends alt text for body images, an SEO score of 80 and a 120–158 character description', () => {
    const fig = { type: 'doc', content: [...body.content, { type: 'figure', attrs: { src: './a.jpg', alt: ' ', caption: '' } }] };
    const d = { ...complete(), tr: { ...complete().tr, doc: fig, description: 'a'.repeat(130) } };
    const labels = open(d, { tr: 79, en: 80 }).map((i) => i.label);
    expect(labels).toContain('Türkçe: görsellerin alt metni var');
    expect(labels).not.toContain('İngilizce: görsellerin alt metni var');
    expect(labels).toContain('Türkçe: SEO puanı 80 ve üzeri');
    expect(labels).not.toContain('İngilizce: SEO puanı 80 ve üzeri');
    expect(labels).not.toContain('Türkçe: meta açıklama 120–158 karakter');
  });
});
