import { describe, it, expect } from 'vitest';
import { autoSlug, canPublish, describeMissing, missingFields, newDraft, normalizeDraft } from '../../../src/admin/lib/draft';
import type { Draft, LangFields } from '../../../src/admin/api/types';

const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metin.' }] }] };
const complete = (over: Partial<LangFields> = {}): LangFields => ({
  title: 'Başlık', subtitle: '', seoTitle: '', slug: 'baslik', slugTouched: false, description: 'Açıklama', focusKeyword: 'kelime', coverAlt: '', doc: body, references: [], ...over,
});
const draft = (over: Partial<Draft> = {}): Draft => ({
  ...newDraft(new Date('2026-10-17T10:00:00')),
  category: 'terapi',
  tr: complete(),
  en: complete({ title: 'Title', slug: 'title' }),
  ...over,
});

describe('newDraft', () => {
  it('has a valid, unique draft key and today as the date', () => {
    const a = newDraft(new Date('2026-10-17T10:00:00'));
    const b = newDraft(new Date('2026-10-17T10:00:00'));
    expect(a.key).toMatch(/^taslak-[a-z0-9]+$/);
    expect(a.key).not.toBe(b.key);
    expect(a.rev).toBe(0);
    expect(a.publishedAt).toBe('2026-10-17');
    expect(a.published).toBe(false);
  });
});

describe('completeness', () => {
  it('a complete draft can be published', () => {
    expect(canPublish(draft())).toEqual({ ok: true, missing: { tr: [], en: [], shared: [] } });
  });
  it('an empty EN body blocks publishing and is named', () => {
    const r = canPublish(draft({ en: complete({ slug: 'title', doc: { type: 'doc', content: [{ type: 'paragraph' }] } }) }));
    expect(r.ok).toBe(false);
    expect(r.missing.en).toEqual(['Yazı metni boş']);
    expect(describeMissing(r)).toContain('İngilizce: Yazı metni boş');
  });
  it('names every empty required field', () => {
    expect(missingFields(complete({ title: ' ', slug: '', description: '', focusKeyword: '' }), 'tr')).toEqual([
      'Başlık', 'URL kısa adı', 'Meta açıklama', 'Odak kelime',
    ]);
  });
  it('a reserved or malformed slug is listed', () => {
    expect(missingFields(complete({ slug: 'kategori' }), 'tr')[0]).toMatch(/kategori/);
    expect(missingFields(complete({ slug: 'Kötü Slug' }), 'tr')[0]).toMatch(/URL kısa adı/);
  });
  it('a cover needs alt text in both languages', () => {
    const r = canPublish(draft({ cover: 'cover.webp' }));
    expect(r.missing.tr).toEqual(['Kapak görselinin alt metni']);
    expect(r.missing.en).toEqual(['Kapak görselinin alt metni']);
  });
  it('a missing category is a shared problem', () => {
    expect(canPublish(draft({ category: '' })).missing.shared).toEqual(['Kategori']);
  });
});

describe('autoSlug', () => {
  it('follows the title with Turkish rules until edited by hand', () => {
    expect(autoSlug(complete({ title: 'Kaygı ile Yaşamak: Düşman mı?' }), 'tr')).toBe('kaygi-ile-yasamak-dusman-mi');
    expect(autoSlug(complete({ title: 'Yeni', slug: 'elle-yazdim', slugTouched: true }), 'tr')).toBe('elle-yazdim');
  });
  it('a title without Latin letters gives an empty slug, which is then reported missing', () => {
    const f = complete({ title: '🌿🌿' });
    const slug = autoSlug(f, 'tr');
    expect(slug).toBe('');
    expect(missingFields({ ...f, slug }, 'tr')).toContain('URL kısa adı');
  });
});

describe('normalizeDraft', () => {
  it('keeps a valid cover crop and drops a broken one', () => {
    const area = { x: 0, y: 21.88, w: 100, h: 56.25 };
    expect(normalizeDraft(draft({ cover: 'cover.webp', coverOriginal: 'cover-orig.webp', coverCrop: area })).coverCrop).toEqual(area);
    expect(normalizeDraft({ ...draft(), coverCrop: { x: 'a' } }).coverCrop).toBeNull();
  });

  it('fills subtitle and references that old drafts lack, and keeps existing ones', () => {
    const old = JSON.parse(JSON.stringify(draft()));
    delete old.tr.subtitle; delete old.tr.references; delete old.en.subtitle; delete old.en.references;
    const n = normalizeDraft(old);
    expect(n.tr.subtitle).toBe('');
    expect(n.en.references).toEqual([]);
    expect(n.tr.title).toBe('Başlık');
    expect(n.coverOriginal).toBeNull();
    expect(n.coverCrop).toBeNull();
    const kept = normalizeDraft(draft({ tr: complete({ subtitle: 'Alt' }) }));
    expect(kept.tr.subtitle).toBe('Alt');
  });
});
