// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EditorPage } from '../../../src/admin/ui/editor/EditorPage';
import { Panel } from '../../../src/admin/ui/context';
import { DeployProvider } from '../../../src/admin/ui/DeployStatus';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';
import { newDraft } from '../../../src/admin/lib/draft';
import type { Draft, LangFields } from '../../../src/admin/api/types';

beforeAll(() => {
  // ProseMirror measures layout; jsdom has none.
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {} });
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metin.' }] }] };
const filled = (title: string, slug: string): LangFields => ({
  title, subtitle: '', seoTitle: '', slug, slugTouched: false, description: 'Açıklama', focusKeyword: 'kelime', coverAlt: '', doc: body, references: [],
});

const livePost = (slug: string, title: string) =>
  `---\ntitle: "${title}"\ndescription: "D"\nslug: "${slug}"\nfocusKeyword: "k"\ncategory: "terapi"\npublishedAt: 2026-03-10\n---\n\nMetin.\n`;

function setup(draft: Draft, extra: Record<string, string> = {}) {
  const api = createMockApi({
    seed: {
      'src/data/categories.json': '[{"id":"terapi","slug":{"tr":"terapi","en":"therapy"},"label":{"tr":"Terapi","en":"Therapy"}}]\n',
      'src/data/redirects.json': '[]\n',
      ...extra,
    },
  });
  api.state.drafts.set(draft.key, { ...draft, rev: 1 });
  const config = { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' };
  render(
    <Panel.Provider value={{ api, config, store: createSessionStore(localStorage) }}>
      <DeployProvider api={api}>
        <EditorPage postKey={draft.key} />
      </DeployProvider>
    </Panel.Provider>,
  );
  return api;
}

const base = () => ({ ...newDraft(new Date('2026-10-17T10:00:00')), category: 'terapi' });

describe('EditorPage', () => {
  it('the back links go to the posts list, not to Ana sayfa', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    expect((await screen.findByRole('link', { name: '← Yazılar' })).getAttribute('href')).toBe('#/yazilar');
  });

  it('a post that cannot be found links back to the posts list', async () => {
    const api = createMockApi({ seed: { 'src/data/categories.json': '[]\n', 'src/data/redirects.json': '[]\n' } });
    const config = { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' };
    render(
      <Panel.Provider value={{ api, config, store: createSessionStore(localStorage) }}>
        <DeployProvider api={api}>
          <EditorPage postKey="yok" />
        </DeployProvider>
      </Panel.Provider>,
    );
    expect((await screen.findByRole('link', { name: '← Yazılara dön' })).getAttribute('href')).toBe('#/yazilar');
  });

  it('after publishing, "Yazılara dön" opens the posts list', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    fireEvent.click(await screen.findByRole('button', { name: 'Yayınla' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Evet, yayınla' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yazılara dön' }));
    expect(window.location.hash).toBe('#/yazilar');
  });

  it('Yayınla with missing fields opens Ayarlar and the checklist', async () => {
    localStorage.setItem('panel.rail', 'closed');
    setup({ ...base(), tr: filled('Kaygı', 'kaygi') }); // the English side is empty
    const publish = await screen.findByRole('button', { name: 'Yayınla' });
    expect((publish as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('region', { name: 'Ayarlar' })).toBeNull();
    fireEvent.click(publish);
    expect(screen.queryByRole('dialog', { name: 'Yayınlansın mı?' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Ayarlar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ayarlar' }).getAttribute('aria-pressed')).toBe('true');
    const list = screen.getByRole('list', { name: 'Yayın kontrol listesi' });
    const item = within(list).getByRole('button', { name: /İngilizce: Meta açıklama/ });
    expect(item.closest('li')!.getAttribute('data-done')).toBe('false');
    expect(item.textContent).toContain('eksik');

    fireEvent.click(screen.getByRole('button', { name: /English Page/ }));
    fireEvent.change(screen.getByLabelText('Başlık (İngilizce)'), { target: { value: 'Living with anxiety' } });
    fireEvent.click(screen.getByRole('button', { name: 'Meta' }));
    fireEvent.change(screen.getByLabelText('Meta açıklama'), { target: { value: 'Açıklama' } });
    fireEvent.click(screen.getByRole('button', { name: 'SEO' }));
    fireEvent.change(screen.getByLabelText('Odak kelime'), { target: { value: 'anxiety' } });
    // A body text is still missing in English.
    fireEvent.click(screen.getByRole('button', { name: 'Yayınla' }));
    expect(screen.queryByRole('dialog', { name: 'Yayınlansın mı?' })).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Yayın kontrol listesi' })).getByRole('button', { name: /İngilizce: Yazı metni boş/ })).toBeTruthy();
  });

  it('clicking a checklist item switches language and opens the right panel', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi') });
    const list = await screen.findByRole('list', { name: 'Yayın kontrol listesi' });
    fireEvent.click(within(list).getByRole('button', { name: /İngilizce: Meta açıklama/ }));
    expect(screen.getByRole('button', { name: /English Page/ }).getAttribute('aria-pressed')).toBe('true');
    const meta = screen.getByRole('region', { name: 'Meta' });
    expect(screen.queryByRole('region', { name: 'Ayarlar' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(within(meta).getByLabelText('Meta açıklama')));
    expect(document.activeElement!.tagName).toBe('TEXTAREA');
  });

  it('the URL slug follows the title until it is edited by hand', async () => {
    setup({ ...base(), tr: filled('', ''), en: filled('Title', 'title') });
    const title = await screen.findByLabelText('Başlık (Türkçe)');
    fireEvent.change(title, { target: { value: 'Kaygı ile Yaşamak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Meta' }));
    const slug = screen.getByLabelText('URL kısa adı') as HTMLInputElement;
    expect(slug.value).toBe('kaygi-ile-yasamak');
    fireEvent.change(slug, { target: { value: 'kaygi' } });
    fireEvent.change(title, { target: { value: 'Kaygı ile Yaşamak Üzerine' } });
    expect((screen.getByLabelText('URL kısa adı') as HTMLInputElement).value).toBe('kaygi');
  });

  it('publishing commits both language files and removes the draft', async () => {
    const api = setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    fireEvent.click(await screen.findByRole('button', { name: 'Yayınla' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Evet, yayınla' }));
    await screen.findByText(/Yazı yayınlandı/);
    const commit = api.state.commits.at(-1)!;
    expect(commit.writes.map((w) => w.path).sort()).toEqual(['src/content/posts/kaygi/en.md', 'src/content/posts/kaygi/tr.md']);
    expect(api.state.drafts.size).toBe(0);
  });

  it('publishing over a version changed on another device asks first (review I1)', async () => {
    const api = setup(
      { ...base(), key: 'kaygi', published: true, base: { tr: 'eski', en: 'eski' }, tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') },
      { 'src/content/posts/kaygi/tr.md': livePost('kaygi', 'Kaygı (telefonda)'), 'src/content/posts/kaygi/en.md': livePost('anxiety', 'Anxiety') },
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Değişiklikleri yayınla' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Evet, yayınla' }));
    expect(await screen.findByText(/başka bir cihazda güncellenmiş/)).toBeTruthy();
    expect(api.state.commits).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Yine de yayınla/ }));
    await screen.findByText(/Yazı yayınlandı/);
    expect(api.state.commits).toHaveLength(1);
  });

  it('an older copy on this device is offered with a warning, not as a plain restore (review I2)', async () => {
    const d = { ...base(), tr: filled('Telefondaki yeni', 'kaygi'), en: filled('Anxiety', 'anxiety') };
    localStorage.setItem(`kt-draft-${d.key}`, JSON.stringify({ ...d, rev: 0, tr: { ...d.tr, title: 'Laptoptaki eski' } }));
    setup(d);
    expect(await screen.findByText(/diğer cihazda daha yeni bir sürüm/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bu cihazdakini kaydet/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Geri yükle' })).toBeNull();
  });

  it('shows the toolbar controls in order', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    const bar = await screen.findByRole('toolbar', { name: 'Biçimlendirme' });
    const names = Array.from(bar.querySelectorAll('button, select'))
      .map((el) => el.getAttribute('aria-label') ?? el.textContent);
    expect(names).toEqual([
      'Geri al', 'Yinele', 'Paragraf türü', 'Kalın', 'İtalik', 'Üstü çizili', 'Vurgula', 'Bağlantı', 'Görsel', 'YouTube',
      'Alıntı', 'Madde listesi', 'Numaralı liste', 'Referans ekle', 'Daha fazla',
    ]);
    const select = within(bar).getByRole('combobox', { name: 'Paragraf türü' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Paragraf', 'Alt başlık', 'Küçük alt başlık']);
    expect((within(bar).getByRole('button', { name: 'Referans ekle' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(within(bar).getByRole('button', { name: 'Daha fazla' }));
    expect(screen.getByRole('menuitem', { name: 'Vurgu kutusu' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Ayraç' })).toBeTruthy();
  });

  it('Kalın toggles with a selection', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    const bar = await screen.findByRole('toolbar', { name: 'Biçimlendirme' });
    const ed = (await screen.findByLabelText('Yazı metni (Türkçe)')) as HTMLElement;
    const p = ed.querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(p.firstChild!);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    const bold = within(bar).getByRole('button', { name: 'Kalın' });
    fireEvent.click(bold);
    await waitFor(() => expect(within(bar).getByRole('button', { name: 'Kalın' }).getAttribute('aria-pressed')).toBe('true'));
  });

  it('language buttons show completeness and switch the editor', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('', '') });
    const group = await screen.findByRole('group', { name: 'Dil' });
    expect(within(group).getByRole('button', { name: /Türkçe Sayfa/ }).textContent).toContain('✓');
    expect(within(group).getByRole('button', { name: /English Page/ }).textContent).toContain('⚠');
    fireEvent.click(within(group).getByRole('button', { name: /English Page/ }));
    expect(await screen.findByLabelText('Başlık (İngilizce)')).toBeTruthy();
  });

  it('language buttons are named "Türkçe Sayfa" and "English Page" and show a flag', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    const tr = await screen.findByRole('button', { name: /Türkçe Sayfa/ });
    expect(tr.querySelector('svg')).toBeTruthy();
    expect(tr.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: /English Page/ }).querySelector('svg')).toBeTruthy();
  });

  it('Yayınla sits in the top bar next to Önizle', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    const publish = await screen.findByRole('button', { name: 'Yayınla' });
    const preview = screen.getByRole('button', { name: 'Önizle' });
    const actions = document.querySelector('.editor-top-actions')!;
    expect(actions.contains(publish)).toBe(true);
    expect(actions.contains(preview)).toBe(true);
    expect(preview.compareDocumentPosition(publish) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(publish.className).toContain('k-btn-primary');
    expect(screen.queryByRole('button', { name: /Yazı ayarlarını/ })).toBeNull();
  });

  it('the rail opens one panel at a time and remembers it', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    fireEvent.click(await screen.findByRole('button', { name: 'SEO' }));
    expect(screen.getByRole('region', { name: 'SEO' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'SEO' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'SEO' }).getAttribute('title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Meta' }));
    expect(screen.queryByRole('region', { name: 'SEO' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Meta' })).toBeTruthy();
    expect(localStorage.getItem('panel.rail')).toBe('meta');
    fireEvent.click(screen.getByRole('button', { name: 'Meta' }));
    expect(screen.queryByRole('region', { name: 'Meta' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Ayarlar' })).toBeNull();
    expect(localStorage.getItem('panel.rail')).toBe('closed');
  });

  it('the ⋯ menu holds Taslağı sil', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    fireEvent.click(await screen.findByRole('button', { name: 'Diğer işlemler' }));
    expect(screen.queryByRole('menuitem', { name: 'Yayından kaldır' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Taslağı sil' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Taslak silinsin mi?' })).toBeTruthy();
  });

  it('the footer shows word count and reading time', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    expect(await screen.findByText('1 kelime · 1 dk okuma')).toBeTruthy();
  });

  it('the Daha fazla menu closes with Escape and on an outside click', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    const trigger = await screen.findByRole('button', { name: 'Daha fazla' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('on a narrow screen the rail starts closed and opens its panel as a bottom sheet that back closes', async () => {
    const orig = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    try {
      localStorage.setItem('panel.rail', 'seo');
      setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
      const seo = await screen.findByRole('button', { name: 'SEO' });
      expect(seo.getAttribute('aria-pressed')).toBe('false');
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(seo);
      const sheet = screen.getByRole('dialog', { name: 'SEO' });
      expect(screen.queryByRole('region', { name: 'SEO' })).toBeNull();
      expect(within(sheet).getByRole('meter', { name: /SEO puanı/ })).toBeTruthy();
      const popped = new Promise((r) => window.addEventListener('popstate', r, { once: true }));
      history.back();
      await popped;
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'SEO' })).toBeNull());
      expect(screen.getByText('Yazıyı düzenle')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Ayarlar' })).getByRole('button', { name: 'Kapat' }));
      expect(screen.queryByRole('dialog', { name: 'Ayarlar' })).toBeNull();
      cleanup();
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
      localStorage.setItem('panel.rail', 'closed');
      setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
      expect((await screen.findByRole('button', { name: 'Ayarlar' })).getAttribute('aria-pressed')).toBe('false');
      expect(screen.queryByRole('region', { name: 'Ayarlar' })).toBeNull();
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: orig, configurable: true });
    }
  });

  it('on a narrow screen a checklist item for a writing-area field closes the sheet and focuses the field', async () => {
    const orig = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    try {
      setup({ ...base(), tr: filled('', 'kaygi'), en: filled('Anxiety', 'anxiety') });
      fireEvent.click(await screen.findByRole('button', { name: 'Ayarlar' }));
      const sheet = screen.getByRole('dialog', { name: 'Ayarlar' });
      const list = within(sheet).getByRole('list', { name: 'Yayın kontrol listesi' });
      fireEvent.click(within(list).getByRole('button', { name: /Türkçe: Başlık/ }));
      expect(screen.queryByRole('dialog', { name: 'Ayarlar' })).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Başlık (Türkçe)')));
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: orig, configurable: true });
    }
  });

  it('on a narrow screen a blocked Yayınla opens the Ayarlar sheet with the checklist', async () => {
    const orig = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    try {
      setup({ ...base(), tr: filled('Kaygı', 'kaygi') }); // the English side is empty
      fireEvent.click(await screen.findByRole('button', { name: 'Yayınla' }));
      expect(screen.queryByRole('dialog', { name: 'Yayınlansın mı?' })).toBeNull();
      const sheet = screen.getByRole('dialog', { name: 'Ayarlar' });
      expect(screen.queryByRole('region', { name: 'Ayarlar' })).toBeNull();
      const list = within(sheet).getByRole('list', { name: 'Yayın kontrol listesi' });
      expect(within(list).getByRole('button', { name: /İngilizce: Meta açıklama/ }).textContent).toContain('eksik');
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: orig, configurable: true });
    }
  });

  it('a panel open on a wide screen closes, without becoming a sheet, when the window turns narrow', async () => {
    const orig = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    try {
      localStorage.setItem('panel.rail', 'settings');
      setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
      expect(await screen.findByRole('region', { name: 'Ayarlar' })).toBeTruthy();
      const entries = history.length;
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByRole('region', { name: 'Ayarlar' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Ayarlar' }).getAttribute('aria-pressed')).toBe('false');
      expect(localStorage.getItem('panel.rail')).toBe('settings');
      expect(history.length).toBe(entries);
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: orig, configurable: true });
    }
  });

  it('Önizle shows the selected language full screen, never saves or publishes, and Kapat closes it', async () => {
    const api = setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    await screen.findByRole('button', { name: 'Yayınla' });
    fireEvent.click(screen.getByRole('button', { name: /English Page/ }));
    const commits = api.state.commits.length;
    fireEvent.click(screen.getByRole('button', { name: 'Önizle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Önizleme' });
    await waitFor(() => expect(within(dialog).getByRole('heading', { level: 1, name: 'Anxiety' })).toBeTruthy());
    expect(within(dialog).getByText('Metin.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByRole('dialog', { name: 'Önizleme' })).toBeNull();
    expect(api.state.commits.length).toBe(commits);
  });

  it('back while previewing closes the preview and stays on the post', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    window.location.hash = '#/yazi/' + base().key;
    const hash = window.location.hash;
    await screen.findByRole('button', { name: 'Yayınla' });
    fireEvent.click(screen.getByRole('button', { name: 'Önizle' }));
    await screen.findByRole('dialog', { name: 'Önizleme' });
    const popped = new Promise((r) => window.addEventListener('popstate', r, { once: true }));
    history.back();
    await popped;
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Önizleme' })).toBeNull());
    expect(window.location.hash).toBe(hash);
    expect(screen.getByText('Yazıyı düzenle')).toBeTruthy();
  });

  it('back with the ⋯ menu open closes the menu and stays on the post', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    window.location.hash = '#/yazi/' + base().key;
    const hash = window.location.hash;
    fireEvent.click(await screen.findByRole('button', { name: 'Diğer işlemler' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    const popped = new Promise((r) => window.addEventListener('popstate', r, { once: true }));
    history.back();
    await popped;
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(window.location.hash).toBe(hash);
    expect(screen.getByText('Yazıyı düzenle')).toBeTruthy();
  });

  it('back with "Yayınlansın mı?" open closes it and stays on the post', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    window.location.hash = '#/yazi/' + base().key;
    const hash = window.location.hash;
    fireEvent.click(await screen.findByRole('button', { name: 'Yayınla' }));
    expect(screen.getByRole('dialog', { name: 'Yayınlansın mı?' })).toBeTruthy();
    const popped = new Promise((r) => window.addEventListener('popstate', r, { once: true }));
    history.back();
    await popped;
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Yayınlansın mı?' })).toBeNull());
    expect(window.location.hash).toBe(hash);
    expect(screen.getByText('Yazıyı düzenle')).toBeTruthy();
  });

  it('a confirm opened from the ⋯ menu stays open and leaves no stray history entry when Vazgeç closes it', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    await screen.findByRole('button', { name: 'Diğer işlemler' });
    const entries = history.length;
    const state = history.state;
    fireEvent.click(screen.getByRole('button', { name: 'Diğer işlemler' }));
    const menuGone = new Promise((r) => window.addEventListener('popstate', r, { once: true }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Taslağı sil' }));
    await menuGone; // the menu's own entry goes; the confirm must stay open
    await new Promise((r) => setTimeout(r, 30));
    const dialog = screen.getByRole('dialog', { name: 'Taslak silinsin mi?' });
    expect(history.state?.layer).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }));
    await waitFor(() => expect(history.state).toEqual(state));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(history.length).toBeGreaterThanOrEqual(entries);
  });

  it('a language button shows ⚠ while a citation there has no registered reference', async () => {
    const cited = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metin ' }, { type: 'citation', attrs: { items: [{ id: 'yok2020' }], narrative: false } }] }] };
    setup({ ...base(), tr: { ...filled('Kaygı', 'kaygi'), doc: cited }, en: filled('Anxiety', 'anxiety') });
    const tr = await screen.findByRole('button', { name: /Türkçe Sayfa/ });
    expect(tr.textContent).toContain('⚠');
    expect(tr.textContent).toContain('eksik');
    const en = screen.getByRole('button', { name: /English Page/ });
    expect(en.textContent).toContain('✓');
  });

  it('the editor shows the Kaynakça of the cited references under the text', async () => {
    const ref = { id: 'ray2004', type: 'article' as const, authors: [{ family: 'Ray', given: 'Oakley' }], year: 2004, title: 'Why we need positive psychology' };
    const unused = { id: 'lee2010', type: 'book' as const, authors: [{ family: 'Lee', given: 'Ann' }], year: 2010, title: 'Uncited book', publisher: 'P' };
    const cited = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metin ' }, { type: 'citation', attrs: { items: [{ id: 'ray2004' }], narrative: false } }] }] };
    setup({ ...base(), tr: { ...filled('Kaygı', 'kaygi'), doc: cited, references: [ref, unused] }, en: filled('Anxiety', 'anxiety') });
    const section = await waitFor(() => {
      const el = document.querySelector('.editor-references .references');
      if (!el) throw new Error('no references yet');
      return el as HTMLElement;
    });
    expect(within(section).getByRole('heading', { name: 'Kaynakça' })).toBeTruthy();
    expect(section.textContent).toContain('Why we need positive psychology');
    expect(section.textContent).not.toContain('Uncited book');
    fireEvent.click(screen.getByRole('button', { name: /English Page/ }));
    expect(document.querySelector('.editor-references')).toBeNull();
  });
});
