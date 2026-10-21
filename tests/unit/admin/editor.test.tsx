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
    expect((await screen.findByRole('link', { name: 'Yazılara dön' })).getAttribute('href')).toBe('#/yazilar');
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

  it('Yayınla with missing fields opens the Kontrol listesi panel', async () => {
    localStorage.setItem('panel.rail', 'closed');
    setup({ ...base(), tr: filled('Kaygı', 'kaygi') }); // the English side is empty
    const publish = await screen.findByRole('button', { name: 'Yayınla' });
    expect((publish as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('region', { name: 'Kontrol listesi' })).toBeNull();
    fireEvent.click(publish);
    expect(screen.queryByRole('dialog', { name: 'Yayınlansın mı?' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Kontrol listesi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kontrol listesi' }).getAttribute('aria-pressed')).toBe('true');
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
    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(within(screen.getByRole('list', { name: 'Yayın kontrol listesi' })).getByRole('button', { name: /İngilizce: Yazı metni boş/ })).toBeTruthy();
  });

  it('clicking a checklist item switches language and opens the right panel', async () => {
    localStorage.setItem('panel.rail', 'checklist');
    setup({ ...base(), tr: filled('Kaygı', 'kaygi') });
    const list = await screen.findByRole('list', { name: 'Yayın kontrol listesi' });
    fireEvent.click(within(list).getByRole('button', { name: /İngilizce: Meta açıklama/ }));
    expect(screen.getByRole('button', { name: /English Page/ }).getAttribute('aria-pressed')).toBe('true');
    const meta = screen.getByRole('region', { name: 'Meta' });
    expect(screen.queryByRole('region', { name: 'Kontrol listesi' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(within(meta).getByLabelText('Meta açıklama')));
    expect(document.activeElement!.tagName).toBe('TEXTAREA');
  });

  it('the rail has Ayarlar, SEO, Meta and Kontrol listesi in that order', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    const rail = await screen.findByRole('navigation', { name: 'Yazı panelleri' });
    expect(within(rail).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Ayarlar', 'SEO', 'Meta', 'Kontrol listesi']);
  });

  it('the missing dot sits on Kontrol listesi, not on Ayarlar', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi') }); // the English side is empty
    const check = await screen.findByRole('button', { name: 'Kontrol listesi' });
    expect(check.querySelector('.rail-dot')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ayarlar' }).querySelector('.rail-dot')).toBeNull();
  });

  it('a blocked Yayınla while another panel is open switches to the checklist, one panel only', async () => {
    localStorage.setItem('panel.rail', 'meta');
    setup({ ...base(), tr: filled('Kaygı', 'kaygi') });
    expect(await screen.findByRole('region', { name: 'Meta' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yayınla' }));
    expect(screen.queryByRole('region', { name: 'Meta' })).toBeNull();
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Kontrol listesi']);
    expect(localStorage.getItem('panel.rail')).toBe('checklist');
  });

  it('the Meta share preview shows the site name of the page language, read from seo.json', async () => {
    const seo = '{"siteName":{"tr":"Psikolog Osman Güneş Özkurt","en":"Psychologist Osman Güneş Özkurt"},"defaultDescription":{"tr":"a","en":"b"},"ogImage":"/og.png"}';
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') }, { 'src/data/seo.json': seo });
    fireEvent.click(await screen.findByRole('button', { name: 'Meta' }));
    const meta = screen.getByRole('region', { name: 'Meta' });
    await waitFor(() => expect(meta.querySelector('.social-name')?.textContent).toBe('Psikolog Osman Güneş Özkurt'));
    fireEvent.click(screen.getByRole('button', { name: /English Page/ }));
    await waitFor(() => expect(meta.querySelector('.social-name')?.textContent).toBe('Psychologist Osman Güneş Özkurt'));
  });

  it('the cover alt field is in Ayarlar right after the cover controls, and not in Meta', async () => {
    localStorage.setItem('panel.rail', 'settings');
    setup({ ...base(), cover: 'cover.jpg', tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    const settings = await screen.findByRole('region', { name: 'Ayarlar' });
    const alt = within(settings).getByLabelText('Kapak görselinin alt metni (Türkçe)');
    const remove = within(settings).getByRole('button', { name: 'Kapağı kaldır' });
    expect(remove.compareDocumentPosition(alt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(settings).getByRole('button', { name: 'Kapak görselinin alt metni (Türkçe) hakkında bilgi' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Meta' }));
    expect(screen.queryByLabelText(/Kapak görselinin alt metni/)).toBeNull();
  });

  it('the cover shows under the subtitle', async () => {
    setup({ ...base(), cover: 'cover.jpg', tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    const subtitle = await screen.findByLabelText('Alt başlık (Türkçe)');
    const cover = document.querySelector('figure.ed-cover')!;
    const body = document.querySelector('.ProseMirror')!;
    expect(cover).toBeTruthy();
    expect(subtitle.compareDocumentPosition(cover) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cover.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(cover as HTMLElement).getByRole('button', { name: 'Kapağı ayarla' })).toBeTruthy();
    expect(within(cover as HTMLElement).getByRole('button', { name: 'Değiştir' })).toBeTruthy();
  });

  it('without a cover there is an "Kapak görseli ekle" drop zone', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    await screen.findByLabelText('Alt başlık (Türkçe)');
    expect(document.querySelector('figure.ed-cover')).toBeNull();
    expect(document.querySelector('button.ed-cover-empty')?.textContent).toContain('Kapak görseli ekle');
  });

  it('"Kaldır" on the cover block clears the cover and its crop', async () => {
    const initial = { ...base(), cover: 'cover.webp', coverOriginal: 'cover-orig.webp', coverCrop: { x: 0, y: 10, w: 100, h: 56.25 }, tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') };
    setup(initial);
    await screen.findByLabelText('Alt başlık (Türkçe)');
    fireEvent.click(within(document.querySelector('figure.ed-cover') as HTMLElement).getByRole('button', { name: 'Kaldır' }));
    expect(document.querySelector('figure.ed-cover')).toBeNull();
    const saved = JSON.parse(localStorage.getItem(`kt-draft-${initial.key}`) ?? 'null');
    expect(saved).toMatchObject({ cover: null, coverOriginal: null, coverCrop: null });
  });

  it('Ayarlar has an "Öne çıkan yazı" toggle that sets featured', async () => {
    localStorage.setItem('panel.rail', 'settings');
    const initial = { ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') };
    const api = setup(initial);
    const settings = await screen.findByRole('region', { name: 'Ayarlar' });
    const toggle = within(settings).getByLabelText('Öne çıkan yazı') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
    await waitFor(() => expect([...api.state.drafts.values()].some((d) => d.featured === true)).toBe(true), { timeout: 4000 });
  });

  it('the checklist item for the cover alt text opens Ayarlar and focuses the field', async () => {
    localStorage.setItem('panel.rail', 'checklist');
    setup({ ...base(), cover: 'cover.jpg', tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    const list = await screen.findByRole('list', { name: 'Yayın kontrol listesi' });
    fireEvent.click(within(list).getByRole('button', { name: /Türkçe: Kapak görselinin alt metni/ }));
    const settings = screen.getByRole('region', { name: 'Ayarlar' });
    await waitFor(() => expect(document.activeElement).toBe(within(settings).getByLabelText('Kapak görselinin alt metni (Türkçe)')));
  });

  it('removing the cover hides the alt field and its checklist item', async () => {
    localStorage.setItem('panel.rail', 'settings');
    const initial = { ...base(), cover: 'cover.jpg', tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') };
    const draftKey = initial.key;
    setup(initial);
    const settings = await screen.findByRole('region', { name: 'Ayarlar' });
    fireEvent.change(within(settings).getByLabelText('Kapak görselinin alt metni (Türkçe)'), { target: { value: 'Bir fincan çay' } });
    fireEvent.click(within(settings).getByRole('button', { name: 'Kapağı kaldır' }));
    expect(screen.queryByLabelText(/Kapak görselinin alt metni/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Kontrol listesi' }));
    const list = screen.getByRole('list', { name: 'Yayın kontrol listesi' });
    expect(within(list).queryByRole('button', { name: /Kapak görselinin alt metni/ })).toBeNull();
    // the typed alt text is kept in the draft (this device's copy), only the field is hidden
    const saved = JSON.parse(localStorage.getItem(`kt-draft-${draftKey}`) ?? 'null');
    expect(saved.cover).toBeNull();
    expect(saved.tr.coverAlt).toBe('Bir fincan çay');
  });

  it('the Kontrol listesi heading has a help tip', async () => {
    localStorage.setItem('panel.rail', 'checklist');
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    const panel = await screen.findByRole('region', { name: 'Kontrol listesi' });
    expect(within(panel).getByRole('button', { name: 'Yayın kontrol listesi hakkında bilgi' })).toBeTruthy();
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
      'Geri al', 'Yinele', 'Paragraf türü', 'Kalın', 'İtalik', 'Üstü çizili', 'Vurgula', 'Alıntı', 'Madde listesi', 'Numaralı liste',
      'Bağlantı', 'Görsel', 'YouTube', 'Referans ekle', 'Daha fazla',
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
      fireEvent.click(await screen.findByRole('button', { name: 'Kontrol listesi' }));
      const sheet = screen.getByRole('dialog', { name: 'Kontrol listesi' });
      const list = within(sheet).getByRole('list', { name: 'Yayın kontrol listesi' });
      fireEvent.click(within(list).getByRole('button', { name: /Türkçe: Başlık/ }));
      expect(screen.queryByRole('dialog', { name: 'Kontrol listesi' })).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Başlık (Türkçe)')));
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: orig, configurable: true });
    }
  });

  it('on a narrow screen a blocked Yayınla opens the Kontrol listesi sheet', async () => {
    const orig = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    try {
      setup({ ...base(), tr: filled('Kaygı', 'kaygi') }); // the English side is empty
      fireEvent.click(await screen.findByRole('button', { name: 'Yayınla' }));
      expect(screen.queryByRole('dialog', { name: 'Yayınlansın mı?' })).toBeNull();
      const sheet = screen.getByRole('dialog', { name: 'Kontrol listesi' });
      expect(screen.queryByRole('region', { name: 'Kontrol listesi' })).toBeNull();
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

  it('the SEO panel heading, the focus keyword and the Meta fields have help tips', async () => {
    setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    fireEvent.click(await screen.findByRole('button', { name: 'SEO' }));
    const seo = screen.getByRole('region', { name: 'SEO' });
    expect(within(seo).getByRole('button', { name: 'SEO hakkında bilgi' })).toBeTruthy();
    fireEvent.click(within(seo).getByRole('button', { name: 'Odak kelime hakkında bilgi' }));
    expect(within(seo).getByRole('region', { name: 'Odak kelime hakkında' }).textContent).toContain('ilk paragraf');
    fireEvent.click(screen.getByRole('button', { name: 'Meta' }));
    const meta = screen.getByRole('region', { name: 'Meta' });
    for (const n of ['SEO başlığı (isteğe bağlı)', 'Meta açıklama', 'URL kısa adı']) {
      expect(within(meta).getByRole('button', { name: `${n} hakkında bilgi` })).toBeTruthy();
    }
  });

  it('a help tip inside the mobile Meta sheet opens without closing the sheet or touching history', async () => {
    const orig = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    try {
      setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
      fireEvent.click(await screen.findByRole('button', { name: 'Meta' }));
      const sheet = screen.getByRole('dialog', { name: 'Meta' });
      const entries = history.length;
      const tip = within(sheet).getByRole('button', { name: 'Meta açıklama hakkında bilgi' });
      fireEvent.click(tip);
      expect(tip.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('dialog', { name: 'Meta' })).toBeTruthy();
      expect(history.length).toBe(entries);
      fireEvent.keyDown(tip, { key: 'Escape' });
      expect(tip.getAttribute('aria-expanded')).toBe('false');
      expect(screen.getByRole('dialog', { name: 'Meta' })).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: orig, configurable: true });
    }
  });

  it('Önizle shows the selected language full screen, never saves or publishes, and ← Düzenlemeye dön closes it', async () => {
    const api = setup({ ...base(), tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety') });
    window.location.hash = '#/yazi/' + base().key;
    const hash = window.location.hash;
    await screen.findByRole('button', { name: 'Yayınla' });
    fireEvent.click(screen.getByRole('button', { name: /English Page/ }));
    const commits = api.state.commits.length;
    fireEvent.click(screen.getByRole('button', { name: 'Önizle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Önizleme' });
    await waitFor(() => expect(within(dialog).getByRole('heading', { level: 1, name: 'Anxiety' })).toBeTruthy());
    expect(within(dialog).getByText('Metin.')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Kapat' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: '← Düzenlemeye dön' }));
    expect(screen.queryByRole('dialog', { name: 'Önizleme' })).toBeNull();
    expect(window.location.hash).toBe(hash);
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

describe('toolbar tooltips', () => {
  it('name each tool with its keyboard shortcut', async () => {
    const { SHORTCUT } = await import('../../../src/admin/ui/editor/Toolbar');
    expect(SHORTCUT['Kalın'].aria).toMatch(/^(Control|Meta)\+B$/);
    expect(SHORTCUT['Yinele'].aria).toMatch(/\+Shift\+Z$/);
  });
});
