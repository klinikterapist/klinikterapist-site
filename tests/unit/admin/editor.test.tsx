// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  title, seoTitle: '', slug, slugTouched: false, description: 'Açıklama', focusKeyword: 'kelime', coverAlt: '', doc: body,
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
  it('publishing stays off until both languages are complete, and says what is missing', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('', '') });
    const publish = await screen.findByRole('button', { name: 'Yayınla' });
    expect((publish as HTMLButtonElement).disabled).toBe(true);
    const missing = screen.getByRole('list', { name: 'Eksikler' });
    expect(within(missing).getByText('İngilizce: Başlık')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^EN/ }));
    fireEvent.change(screen.getByLabelText('Başlık (İngilizce)'), { target: { value: 'Living with anxiety' } });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Yayınla' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('the URL slug follows the title until it is edited by hand', async () => {
    setup({ ...base(), tr: filled('', ''), en: filled('Title', 'title') });
    const title = await screen.findByLabelText('Başlık (Türkçe)');
    fireEvent.change(title, { target: { value: 'Kaygı ile Yaşamak' } });
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
    expect(within(group).getByRole('button', { name: /^TR/ }).textContent).toContain('✓');
    expect(within(group).getByRole('button', { name: /^EN/ }).textContent).toContain('⚠');
    fireEvent.click(within(group).getByRole('button', { name: /^EN/ }));
    expect(await screen.findByLabelText('Başlık (İngilizce)')).toBeTruthy();
  });

  it('the settings column can be hidden and the choice is remembered', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    fireEvent.click(await screen.findByRole('button', { name: 'Yazı ayarlarını gizle' }));
    expect(screen.queryByRole('button', { name: 'Yayınla' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Yazı ayarlarını göster' })).toBeTruthy();
    expect(localStorage.getItem('panel.side')).toBe('closed');
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

  it('on a narrow screen the settings column starts hidden, and a stored closed state stays hidden', async () => {
    const orig = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    try {
      setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
      expect(await screen.findByRole('button', { name: 'Yazı ayarlarını göster' })).toBeTruthy();
      cleanup();
      Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
      localStorage.setItem('panel.side', 'closed');
      setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
      expect(await screen.findByRole('button', { name: 'Yazı ayarlarını göster' })).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: orig, configurable: true });
    }
  });

  it('Önizle shows the selected language full screen, never saves or publishes, and Kapat closes it', async () => {
    const api = setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    await screen.findByRole('button', { name: 'Yayınla' });
    fireEvent.click(screen.getByRole('button', { name: /^EN/ }));
    const commits = api.state.commits.length;
    fireEvent.click(screen.getByRole('button', { name: 'Önizle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Önizleme' });
    await waitFor(() => expect(within(dialog).getByRole('heading', { level: 1, name: 'Anxiety' })).toBeTruthy());
    expect(within(dialog).getByText('Metin.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByRole('dialog', { name: 'Önizleme' })).toBeNull();
    expect(api.state.commits.length).toBe(commits);
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
    fireEvent.click(screen.getByRole('button', { name: /^EN/ }));
    expect(document.querySelector('.editor-references')).toBeNull();
  });
});
