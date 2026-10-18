// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SeoPanel } from '../../../src/admin/ui/editor/SeoPanel';
import { MetaPanel } from '../../../src/admin/ui/editor/MetaPanel';
import { ImageStore } from '../../../src/admin/ui/editor/images';
import { createMockApi } from '../../../src/admin/api/mock';
import { newDraft } from '../../../src/admin/lib/draft';
import type { Draft, LangFields } from '../../../src/admin/api/types';

afterEach(cleanup);

const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Habits shape the day.' }] }] };
const fields = (over: Partial<LangFields>): LangFields => ({
  title: '', seoTitle: '', slug: '', slugTouched: false, description: '', focusKeyword: '', coverAlt: '', doc: body, ...over,
});
const longDesc = 'Kaygı herkesin yaşadığı bir duygudur. '.repeat(6).trim();
const draft = (): Draft => ({
  ...newDraft(new Date('2026-10-17T10:00:00')),
  tr: fields({ title: 'Günlük hayatta küçük adımlar', slug: 'kucuk-adimlar', focusKeyword: 'kaygı', description: longDesc }),
  en: fields({ title: 'Habits that help', slug: 'habits', focusKeyword: 'habit', description: 'Short.' }),
});
const images = new ImageStore(createMockApi({ seed: {} }), 'k', new Map());

describe('SeoPanel', () => {
  it('shows a red light when the keyword is missing from the title, for the active language', () => {
    const { rerender } = render(<SeoPanel lang="tr" draft={draft()} otherKeywords={[]} onLang={() => {}} delayMs={0} />);
    const item = screen.getByText('Odak kelime başlıkta').closest('li')!;
    expect(within(item).getByText('Sorun')).toBeTruthy();
    expect(screen.getByRole('meter', { name: /SEO puanı/ })).toBeTruthy();

    rerender(<SeoPanel lang="en" draft={draft()} otherKeywords={[]} onLang={() => {}} delayMs={0} />);
    const en = screen.getByText('Odak kelime başlıkta').closest('li')!;
    expect(within(en).getByText('İyi')).toBeTruthy();
  });

  it('holds the focus keyword field of the active language, but not the Google preview', () => {
    const changes: unknown[] = [];
    render(<SeoPanel lang="en" draft={draft()} otherKeywords={[]} onLang={(p) => changes.push(p)} delayMs={0} />);
    const keyword = screen.getByLabelText('Odak kelime') as HTMLInputElement;
    expect(keyword.value).toBe('habit');
    expect(keyword.getAttribute('data-field')).toBe('focusKeyword');
    fireEvent.change(keyword, { target: { value: 'habits' } });
    expect(changes).toEqual([{ focusKeyword: 'habits' }]);
    expect(screen.queryByRole('region', { name: 'Google önizlemesi' })).toBeNull();
  });
});

describe('MetaPanel', () => {
  it('the search preview cuts a long description with an ellipsis and switches to mobile', () => {
    render(<MetaPanel lang="tr" draft={draft()} images={images} onLang={() => {}} />);
    const preview = screen.getByRole('region', { name: 'Google önizlemesi' });
    const desc = within(preview).getByText(/^Kaygı herkesin/);
    expect(desc.textContent!.endsWith('…')).toBe(true);
    expect(desc.textContent!.length).toBeLessThanOrEqual(159);
    expect(within(preview).getByText(/klinikterapist\.com › blog › kucuk-adimlar/)).toBeTruthy();
    fireEvent.click(within(preview).getByRole('button', { name: 'Mobil' }));
    expect(within(preview).getByText(/^Kaygı herkesin/).textContent!.length).toBeLessThanOrEqual(121);
    expect(screen.getByRole('region', { name: 'Paylaşım önizlemesi' })).toBeTruthy();
  });

  it('holds the URL slug, SEO title, description and (with a cover) the cover alt text, each with its data-field', () => {
    const { rerender } = render(<MetaPanel lang="tr" draft={draft()} images={images} onLang={() => {}} />);
    const fieldsOf = () => Array.from(document.querySelectorAll('[data-field]')).map((el) => el.getAttribute('data-field'));
    expect(fieldsOf()).toEqual(['slug', 'seoTitle', 'description']);
    rerender(<MetaPanel lang="tr" draft={{ ...draft(), cover: 'cover.jpg' }} images={images} onLang={() => {}} />);
    expect(fieldsOf()).toEqual(['slug', 'seoTitle', 'description', 'coverAlt']);
  });
});
