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

    fireEvent.click(screen.getByRole('tab', { name: /İngilizce/ }));
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
});
