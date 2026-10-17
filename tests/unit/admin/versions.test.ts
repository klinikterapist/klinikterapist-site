import { describe, it, expect } from 'vitest';
import { relativeLabel, restoreLang } from '../../../src/admin/lib/versions';
import type { Draft, LangFields } from '../../../src/admin/api/types';

const lang = (t: string): LangFields => ({
  title: t, subtitle: `${t}-alt`, seoTitle: `${t}-seo`, slug: `${t}-slug`, slugTouched: true, description: `${t}-d`, focusKeyword: `${t}-k`, coverAlt: `${t}-c`,
  doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] },
  references: [{ id: t, type: 'journal' } as never],
});
const draft = (rev: number, tr: string, en: string, extra: Partial<Draft> = {}): Draft => ({
  key: 'k', rev, updatedAt: 'u', published: true, category: 'terapi', cover: 'cover.webp', publishedAt: '2026-10-01', tr: lang(tr), en: lang(en), ...extra,
});

describe('restoreLang', () => {
  it('changes only title, subtitle, doc and references of the chosen language', () => {
    const current = draft(7, 'yeni', 'new');
    const version = draft(3, 'eski', 'old', { category: 'x', cover: null, publishedAt: '2020-01-01' });
    const out = restoreLang(current, version, 'tr');
    expect(out.rev).toBe(7);
    expect(out.en).toEqual(current.en);
    expect(out.category).toBe('terapi');
    expect(out.cover).toBe('cover.webp');
    expect(out.publishedAt).toBe('2026-10-01');
    expect(out.tr).toEqual({ ...current.tr, title: 'eski', subtitle: 'eski-alt', doc: version.tr.doc, references: version.tr.references });
    expect(out.tr.slug).toBe('yeni-slug');
  });
});

describe('relativeLabel', () => {
  const now = new Date(2026, 9, 17, 16, 0);
  it('today, yesterday and older dates', () => {
    expect(relativeLabel(new Date(2026, 9, 17, 14, 32).toISOString(), now)).toBe('Bugün 14.32');
    expect(relativeLabel(new Date(2026, 9, 16, 21, 5).toISOString(), now)).toBe('Dün 21.05');
    expect(relativeLabel(new Date(2026, 9, 12, 9, 10).toISOString(), now)).toBe('12 Ekim 09.10');
  });
});
