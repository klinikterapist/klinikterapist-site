// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { foldTr, blogFilterScript } from '../../src/lib/search';

describe('foldTr', () => {
  it('folds Turkish capitals and diacritics the same way', () => {
    expect(foldTr('İLİŞKİ')).toBe(foldTr('ilişki'));
    expect(foldTr('Kaygı')).toContain('kaygi');
    expect(foldTr('KAYGI')).toBe(foldTr('kaygı'));
    expect(foldTr('Çocuk Gelişimi Öğrenme Şüphe')).toBe('cocuk gelisimi ogrenme suphe');
  });

  it('folds English text too (the dotless i maps back to i)', () => {
    expect(foldTr('INSIGHT')).toBe('insight');
    expect(foldTr('Mental Health')).toBe('mental health');
  });
});

describe('blog filter script', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-blog data-filterable>
        <form data-blog-search><input type="search" /></form>
        <nav><a href="/blog/" data-cat="" aria-current="page">Tümü</a><a href="/blog/kategori/k/" data-cat="kaygi">Kaygı</a></nav>
        <div data-hide-on-filter>tiles</div>
        <ul>
          <li data-post data-cat="kaygi" data-search="Gece uyanmaları Kaygı">a</li>
          <li data-post data-cat="iliski" data-search="Yakınlıktan neden korkarız İlişkiler">b</li>
        </ul>
        <p data-no-results hidden>yok</p>
      </div>`;
    // The script is serialised into the page; run the same text here.
    new Function(blogFilterScript())();
  });

  const shown = () => [...document.querySelectorAll<HTMLElement>('[data-post]')].filter((e) => !e.hidden).map((e) => e.textContent);
  const type = (v: string) => {
    const input = document.querySelector('input')!;
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('filters by title and category text, ignoring case and Turkish diacritics', () => {
    type('GECE');
    expect(shown()).toEqual(['a']);
    type('iliskiler');
    expect(shown()).toEqual(['b']);
    expect(document.querySelector<HTMLElement>('[data-hide-on-filter]')!.hidden).toBe(true);
    type('');
    expect(shown()).toEqual(['a', 'b']);
    expect(document.querySelector<HTMLElement>('[data-hide-on-filter]')!.hidden).toBe(false);
  });

  it('shows the no-results note when nothing matches', () => {
    type('zzz');
    expect(shown()).toEqual([]);
    expect(document.querySelector<HTMLElement>('[data-no-results]')!.hidden).toBe(false);
  });

  it('category chips filter in place and mark the current chip', () => {
    const chip = document.querySelector<HTMLAnchorElement>('a[data-cat="kaygi"]')!;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    chip.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(shown()).toEqual(['a']);
    expect(chip.getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('a[data-cat=""]')!.hasAttribute('aria-current')).toBe(false);
    document.querySelector<HTMLAnchorElement>('a[data-cat=""]')!.click();
    expect(shown()).toEqual(['a', 'b']);
  });

  it('a clear-filter link (the Popular chip) clears search and topic before it jumps', () => {
    const pop = document.createElement('a');
    pop.href = '#popular';
    pop.setAttribute('data-clear-filter', '');
    document.querySelector('nav')!.append(pop);
    type('gece');
    pop.click();
    expect(document.querySelector('input')!.value).toBe('');
    expect(shown()).toEqual(['a', 'b']);
    expect(document.querySelector<HTMLElement>('[data-hide-on-filter]')!.hidden).toBe(false);
  });
});
