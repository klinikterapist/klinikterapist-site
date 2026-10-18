import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { renderPreviewHtml } from '../../../src/admin/lib/preview';
import { newDraft } from '../../../src/admin/lib/draft';
import type { Draft, LangFields } from '../../../src/admin/api/types';
import type { Reference } from '../../../src/lib/apa';

const ray: Reference = { id: 'ray2004', type: 'article', authors: [{ family: 'Ray', given: 'Oakley' }], year: 2004, title: 'Why we need positive psychology', container: 'American Psychologist', volume: '59', pages: '29–34' };
const other: Reference = { id: 'lee2010', type: 'book', authors: [{ family: 'Lee', given: 'Ann' }], year: 2010, title: 'Uncited book', publisher: 'Pub' };

const t = (text: string): JSONContent => ({ type: 'text', text });
const p = (...c: JSONContent[]): JSONContent => ({ type: 'paragraph', content: c });
const fields = (over: Partial<LangFields>): LangFields => ({
  title: 'Başlık', subtitle: '', seoTitle: '', slug: 'b', slugTouched: false, description: 'Açıklama', focusKeyword: '', coverAlt: '', references: [], doc: { type: 'doc', content: [] }, ...over,
});
const draftOf = (tr: Partial<LangFields>, cover: string | null = null): Draft => ({ ...newDraft(new Date('2026-10-17T10:00:00')), cover, tr: fields(tr), en: fields({ title: 'Title' }) });
const doc = (...c: JSONContent[]): JSONContent => ({ type: 'doc', content: c });
const urls = (n: string) => (n === 'a.webp' ? 'blob:x/a' : null);

describe('renderPreviewHtml', () => {
  it('shows the title and the subtitle, falling back to the description', () => {
    expect(renderPreviewHtml(draftOf({ subtitle: 'Alt başlık' }), 'tr', urls)).toMatch(/<h1>Başlık<\/h1>\s*<p class="standfirst">Alt başlık<\/p>/);
    expect(renderPreviewHtml(draftOf({}), 'tr', urls)).toContain('<p class="standfirst">Açıklama</p>');
  });

  it('shows the site byline (author, date, reading time), the share row and Randevu Al', () => {
    const html = renderPreviewHtml(draftOf({}), 'tr', urls);
    expect(html).toContain('Osman Güneş Özkurt');
    expect(html).toContain('dk okuma');
    expect(html).toContain('Bağlantıyı kopyala');
    expect(html).toContain('Randevu Al');
  });

  it('shows the selected language', () => {
    expect(renderPreviewHtml(draftOf({}), 'en', urls)).toContain('<h1>Title</h1>');
  });

  it('turns a lone image into a figure with a caption, using imageUrl', () => {
    const d = draftOf({ doc: doc({ type: 'figure', attrs: { src: './a.webp', alt: 'Bir şey', caption: 'Alt yazı' } }) });
    const html = renderPreviewHtml(d, 'tr', urls);
    expect(html).toContain('<figure><img src="blob:x/a" alt="Bir şey"><figcaption>Alt yazı</figcaption></figure>');
  });

  it('shows the cover with its alt text', () => {
    const html = renderPreviewHtml(draftOf({ coverAlt: 'Kapak' }, 'a.webp'), 'tr', urls);
    expect(html).toMatch(/<img[^>]*src="blob:x\/a"[^>]*alt="Kapak"|<img[^>]*alt="Kapak"[^>]*src="blob:x\/a"/);
  });

  it('renders a callout as aside.callout', () => {
    const html = renderPreviewHtml(draftOf({ doc: doc({ type: 'callout', content: [p(t('Not'))] }) }), 'tr', urls);
    expect(html).toContain('<aside class="callout">');
    expect(html).toContain('<p>Not</p>');
  });

  it('keeps citations and lists only the cited references', () => {
    const cite: JSONContent = { type: 'citation', attrs: { items: [{ id: 'ray2004' }], narrative: false } };
    const html = renderPreviewHtml(draftOf({ references: [ray, other], doc: doc(p(t('Metin '), cite)) }), 'tr', urls);
    expect(html).toContain('<cite data-refs="ray2004">(Ray, 2004)</cite>');
    expect(html).toContain('class="references');
    expect(html).toMatch(/<details class="pv-acc">/);
    expect(html).toContain('Kaynakça');
    expect(html).toContain('Why we need positive psychology');
    expect(html).not.toContain('Uncited book');
  });

  it('has no references section when nothing is cited', () => {
    expect(renderPreviewHtml(draftOf({ references: [ray], doc: doc(p(t('Metin'))) }), 'tr', urls)).not.toContain('references');
  });

  it('escapes raw HTML typed as text', () => {
    const html = renderPreviewHtml(draftOf({ title: '<b>x</b>', doc: doc(p(t('<script>alert(1)</script>'))) }), 'tr', urls);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>x');
  });

  it('shows the same YouTube placeholder link as the site', () => {
    const html = renderPreviewHtml(draftOf({ doc: doc({ type: 'youtube', attrs: { id: 'dQw4w9WgXcQ' } }) }), 'tr', urls);
    expect(html).toContain('<div class="youtube" data-id="dQw4w9WgXcQ"><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">');
  });

  it('only links to safe addresses', () => {
    const link = (href: string): JSONContent => ({ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href } }] });
    const html = renderPreviewHtml(draftOf({ doc: doc(p(link('javascript:alert(1)'), link('https://a.co/'))) }), 'tr', urls);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<a href="https://a.co/">x</a>');
  });

  it('says in Turkish when a cited reference is missing, instead of throwing', () => {
    const cite: JSONContent = { type: 'citation', attrs: { items: [{ id: 'yok' }], narrative: false } };
    const html = renderPreviewHtml(draftOf({ doc: doc(p(cite)) }), 'tr', urls);
    expect(html).toContain('preview-error');
    expect(html).toMatch(/referans/i);
  });
});

describe('renderPreviewHtml: missing image', () => {
  it('shows a notice instead of a broken figure', () => {
    const d = draftOf({ doc: doc({ type: 'figure', attrs: { src: './yok.webp', alt: 'A', caption: 'Yazı' } }) });
    const html = renderPreviewHtml(d, 'tr', urls);
    expect(html).toContain('preview-missing');
    expect(html).not.toContain('<img');
    expect(html).toContain('<figcaption>Yazı</figcaption>');
  });
});
