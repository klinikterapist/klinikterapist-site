// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SettingsPage } from '../../../src/admin/ui/settings/SettingsPage';
import { Panel } from '../../../src/admin/ui/context';
import { DeployProvider } from '../../../src/admin/ui/DeployStatus';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';
import { parseProfile } from '../../../src/lib/schemas';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function setup(screenId: string, tweak: (api: ReturnType<typeof createMockApi>) => void = () => {}) {
  const api = createMockApi();
  tweak(api);
  render(
    <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' }, store: createSessionStore(localStorage) }}>
      <DeployProvider api={api}>
        <SettingsPage screen={screenId} />
      </DeployProvider>
    </Panel.Provider>,
  );
  return api;
}

const json = (api: ReturnType<typeof createMockApi>, path: string) => JSON.parse(api.state.files.get(path)!.content);
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

describe('settings screens: Plan E fields', () => {
  it('Profil: Ana sayfa görünümü offers both styles and saves heroStyle', async () => {
    const api = setup('profil');
    const select = (await screen.findByLabelText('Ana sayfa görünümü')) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(['Arka planda fotoğraf', 'Yuvarlak fotoğraf']);
    expect(select.value).toBe('background');
    fireEvent.change(select, { target: { value: 'round' } });
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    expect(json(api, 'src/data/profile.json').heroStyle).toBe('round');
  });

  it('Profil: Mesleki üyelikler lists TPD and a number can be added', async () => {
    const api = setup('profil');
    expect(await screen.findByDisplayValue('Türk Psikologlar Derneği')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Üye numarası (isteğe bağlı)'), { target: { value: '1234' } });
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    expect(json(api, 'src/data/profile.json').memberships[0].number).toBe('1234');
  });

  it('Sık sorulan sorular: lists five questions; add, reorder and delete', async () => {
    const api = setup('sss');
    expect(await screen.findByRole('heading', { name: 'Sık sorulan sorular' })).toBeTruthy();
    expect(screen.getByText('Ana sayfada ve Sık sorulanlar sayfasında görünen sorular.')).toBeTruthy();
    expect(screen.getAllByLabelText('Soru (Türkçe)')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Soru ekle' }));
    expect(screen.getAllByLabelText('Soru (Türkçe)')).toHaveLength(6);
    fireEvent.change(screen.getAllByLabelText('Soru (Türkçe)')[5], { target: { value: 'Yeni soru?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Yeni soru?: yukarı taşı' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sil: İlk görüşme nasıl geçer?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    const saved = json(api, 'src/data/faq.json') as { id: string; q: { tr: string } }[];
    expect(saved.map((f) => f.q.tr)).toEqual([
      'Ücret ne kadar, nasıl ödenir?', 'Online görüşme nasıl yapılır?', 'Konuştuklarım gizli kalır mı?', 'Yeni soru?', 'Randevuyu iptal edebilir miyim?',
    ]);
    expect(new Set(saved.map((f) => f.id)).size).toBe(5);
  });

  it('Sosyal ve linkler: Not is shown and saved', async () => {
    const api = setup('linkler');
    const notes = await screen.findAllByLabelText('Not (Türkçe)');
    expect(notes).toHaveLength(8);
    expect((notes[2] as HTMLInputElement).value).toBe('İngilizce');
    fireEvent.change(notes[0], { target: { value: 'Günlük paylaşımlar' } });
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    expect(json(api, 'src/data/links.json')[0].note.tr).toBe('Günlük paylaşımlar');
  });

  it('Site ana sayfası: Süreç adımları allows at most three', async () => {
    // The site ships with three sample steps; start from none so the add button's limit is exercised.
    const api = setup('ana-sayfa', (a) => {
      const f = a.state.files.get('src/data/home.json')!;
      a.state.files.set('src/data/home.json', { ...f, content: JSON.stringify({ ...JSON.parse(f.content), process: [] }) });
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Adım ekle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adım ekle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Adım ekle' }));
    expect(screen.queryByRole('button', { name: 'Adım ekle' })).toBeNull();
    expect(screen.getAllByLabelText('Adım başlığı (Türkçe)')).toHaveLength(3);
    fireEvent.change(screen.getAllByLabelText('Adım başlığı (Türkçe)')[0], { target: { value: 'Tanışma' } });
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    expect(json(api, 'src/data/home.json').process).toHaveLength(3);
  });
});

describe('settings screens', () => {
  it('Sosyal ve linkler: the header has an icon and a one-line intro', async () => {
    setup('linkler');
    const head = (await screen.findByRole('heading', { name: 'Sosyal ve linkler' })).closest('.screen-head')!;
    expect(head.querySelector('svg')).toBeTruthy();
    expect(screen.getByText('Sitede görünen sosyal hesaplarınız.')).toBeTruthy();
  });

  it('Sosyal ve linkler: the chosen icon is shown next to the Simge select and follows it', async () => {
    setup('linkler');
    const select = (await screen.findAllByLabelText('Simge'))[0] as HTMLSelectElement;
    const preview = () => select.closest('.icon-pick')!.querySelector('svg.icon-preview')!;
    expect(preview()).toBeTruthy();
    expect(preview().getAttribute('aria-hidden')).toBe('true');
    const before = preview().innerHTML;
    const other = [...select.options].find((o) => o.value !== select.value)!.value;
    fireEvent.change(select, { target: { value: other } });
    expect(preview().getAttribute('data-icon')).toBe(other);
    expect(preview().innerHTML).not.toBe(before);
  });

  it('Profil: the intro mentions the author box', async () => {
    setup('profil');
    expect(await screen.findByText('Adınız, unvanınız ve fotoğrafınız; ana sayfada ve yazıların altındaki yazar kutusunda görünür.')).toBeTruthy();
  });

  it('İletişim: an invalid e-mail is shown under the field and nothing is committed', async () => {
    const api = setup('iletisim');
    const email = await screen.findByLabelText('E-posta adresi');
    fireEvent.change(email, { target: { value: 'yok' } });
    save();
    await waitFor(() => expect(email.getAttribute('aria-invalid')).toBe('true'));
    const errorId = email.getAttribute('aria-describedby')!.split(' ').find((id) => id.endsWith('-err'))!;
    expect(document.getElementById(errorId)?.textContent).toMatch(/geçerli bir e-posta adresi yazın/);
    expect(api.state.commits).toHaveLength(0);
  });

  it('Profil: saving commits exactly profile.json with the sha it was read at', async () => {
    const api = setup('profil');
    const sha = api.state.files.get('src/data/profile.json')!.sha;
    fireEvent.change(await screen.findByLabelText('Ad soyad'), { target: { value: 'Osman G. Özkurt' } });
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    const c = api.state.commits[0];
    expect(c.writes.map((w) => w.path)).toEqual(['src/data/profile.json']);
    expect(c.writes[0].expectSha).toBe(sha);
    expect(c.writes[0].content.endsWith('\n')).toBe(true);
    expect(parseProfile(JSON.parse(c.writes[0].content)).name).toBe('Osman G. Özkurt');
    expect(await screen.findByText(/Kaydedildi/)).toBeTruthy();
  });

  it('Kaynaklar: keeps the { myNote, items } shape and only one featured resource', async () => {
    const api = setup('kaynaklar');
    const items = json(api, 'src/data/resources.json').items;
    const second = await screen.findByRole('radio', { name: `Öne çıkan: ${items[1].title}` });
    fireEvent.click(second);
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    const saved = json(api, 'src/data/resources.json');
    expect(Object.keys(saved).sort()).toEqual(['items', 'myNote']);
    expect(saved.items.map((i: { featured: boolean }) => i.featured)).toEqual(items.map((_: unknown, i: number) => i === 1));
  });

  it('Hakkımda: a timeline period switched to "TR/EN ayrı" is saved as { tr, en }', async () => {
    const api = setup('hakkimda');
    const modes = await screen.findAllByLabelText('Dönem biçimi');
    fireEvent.change(modes[0], { target: { value: 'localized' } });
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    const period = json(api, 'src/data/about.json').timeline[0].period;
    expect(typeof period).toBe('object');
    expect(Object.keys(period).sort()).toEqual(['en', 'tr']);
  });

  it('Kategoriler: a category in use cannot be deleted', async () => {
    setup('kategoriler');
    const row = (await screen.findByDisplayValue('Yaşam')).closest('li')!;
    // Usage is checked after the list shows; wait for it before looking at the buttons.
    expect(await within(row).findByText(/Kullanımda/)).toBeTruthy();
    expect((within(row).getByRole('button', { name: /Sil/ }) as HTMLButtonElement).disabled).toBe(true);
    const unused = screen.getByDisplayValue('Araştırma').closest('li')!;
    expect((within(unused).getByRole('button', { name: /Sil/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Kategoriler: when usage cannot be checked, nothing can be deleted (review I5)', async () => {
    setup('kategoriler', (api) => {
      api.listDrafts = () => Promise.reject(new Error('ağ yok'));
    });
    const unused = (await screen.findByDisplayValue('Araştırma')).closest('li')!;
    await waitFor(() => expect(within(unused).getByText(/Kontrol edilemedi/)).toBeTruthy());
    expect((within(unused).getByRole('button', { name: /Sil/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('an unknown screen says so', async () => {
    setup('yok-boyle');
    expect(await screen.findByText(/Bu ayar ekranı bulunamadı/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Yazılara dön' }).getAttribute('href')).toBe('#/yazilar');
  });
});
