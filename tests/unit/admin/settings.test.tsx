// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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

/**
 * The panel is seeded from the fixtures (tests/fixtures/data and /content), never from the owner's real
 * src/data: deploy.yml runs this suite before every deploy, so a test on the real values would block the
 * live site after an ordinary panel edit.
 */
function fixtureSeed(): Record<string, string> {
  const seed: Record<string, string> = {};
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, `${prefix}/${name}`);
      else if (/\.(json|md)$/.test(name)) seed[`${prefix}/${name}`] = readFileSync(full, 'utf8');
    }
  };
  walk('tests/fixtures/data', 'src/data');
  walk('tests/fixtures/content', 'src/content/posts');
  return seed;
}

function setup(screenId: string, tweak: (api: ReturnType<typeof createMockApi>) => void = () => {}) {
  const api = createMockApi({ seed: fixtureSeed() });
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

/** Profile fields the tests depend on are seeded here, so the owner's real profile.json can change freely. */
function seedProfile(a: ReturnType<typeof createMockApi>, patch: Record<string, unknown>) {
  const f = a.state.files.get('src/data/profile.json')!;
  a.state.files.set('src/data/profile.json', { ...f, content: JSON.stringify({ ...JSON.parse(f.content), ...patch }) });
}

describe('settings screens: Plan E fields', () => {
  it('Profil: Ana sayfa görünümü offers both styles and saves heroStyle', async () => {
    const api = setup('profil', (a) => seedProfile(a, { heroStyle: 'background' }));
    const select = (await screen.findByLabelText('Ana sayfa görünümü')) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(['Arka planda fotoğraf', 'Yuvarlak fotoğraf']);
    expect(select.value).toBe('background');
    fireEvent.change(select, { target: { value: 'round' } });
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    expect(json(api, 'src/data/profile.json').heroStyle).toBe('round');
  });

  it('Profil: Mesleki üyelikler lists TPD and a number can be added', async () => {
    const api = setup('profil', (a) => seedProfile(a, { memberships: [{ org: { tr: 'Örnek Dernek', en: 'Example Association' } }] }));
    expect(await screen.findByDisplayValue('Örnek Dernek')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Üye numarası (isteğe bağlı)'), { target: { value: '1234' } });
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    expect(json(api, 'src/data/profile.json').memberships[0].number).toBe('1234');
  });

  it('Sık sorulan sorular: lists five questions; add, reorder and delete', async () => {
    // A fixed FAQ, so the test does not depend on the owner's real questions.
    const q = (id: string, tr: string) => ({ id, q: { tr, en: tr }, a: { tr: '', en: '' } });
    const faq = [q('ilk-gorusme', 'İlk görüşme nasıl geçer?'), q('ucret', 'Ücret ne kadar, nasıl ödenir?'), q('online-gorusme', 'Online görüşme nasıl yapılır?'), q('gizlilik', 'Konuştuklarım gizli kalır mı?'), q('iptal', 'Randevuyu iptal edebilir miyim?')];
    const api = setup('sss', (a) => {
      const f = a.state.files.get('src/data/faq.json')!;
      a.state.files.set('src/data/faq.json', { ...f, content: JSON.stringify(faq) });
    });
    expect(await screen.findByRole('heading', { name: 'Sık Sorulan Sorular' })).toBeTruthy();
    // The rows appear after the file loads; under load that can lag behind the heading.
    await screen.findByRole('button', { name: /İlk görüşme nasıl geçer\?/ });
    expect(document.querySelectorAll('.row-list-row')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Soru ekle' }));
    let dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Soru (Türkçe)'), { target: { value: 'Yeni soru?' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yukarı taşı' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tamam' }));
    expect(document.querySelectorAll('.row-list-row')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: /İlk görüşme nasıl geçer\?/ }));
    dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Sil/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Evet, sil' }));
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    const saved = json(api, 'src/data/faq.json') as { id: string; q: { tr: string } }[];
    expect(saved.map((f) => f.q.tr)).toEqual([
      'Ücret ne kadar, nasıl ödenir?', 'Online görüşme nasıl yapılır?', 'Konuştuklarım gizli kalır mı?', 'Yeni soru?', 'Randevuyu iptal edebilir miyim?',
    ]);
    expect(new Set(saved.map((f) => f.id)).size).toBe(5);
  });

  it('Sık sorulan sorular: a question added on the Randevu tab shows on the booking page only', async () => {
    const api = setup('sss');
    fireEvent.click(await screen.findByRole('button', { name: /^Randevu sayfası/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Soru ekle' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Soru (Türkçe)'), { target: { value: 'Seans kaç dakika?' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tamam' }));
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    const saved = json(api, 'src/data/faq.json') as { q: { tr: string }; pages?: string[] }[];
    expect(saved.find((f) => f.q.tr === 'Seans kaç dakika?')!.pages).toEqual(['booking']);
  });

  it('Sosyal ve linkler: Not is shown and saved', async () => {
    const api = setup('linkler');
    const rows = await screen.findAllByRole('button', { name: /Medium|Instagram/ });
    expect(document.querySelectorAll('.row-list-row')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /^Medium/ }));
    expect((within(screen.getByRole('dialog')).getByLabelText('Not (Türkçe)') as HTMLInputElement).value).toBe('İngilizce');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tamam' }));
    fireEvent.click(rows.find((r) => /^Instagram/.test(r.textContent ?? ''))!);
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Not (Türkçe)'), { target: { value: 'Günlük paylaşımlar' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tamam' }));
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
    for (const title of ['Tanışma', 'Değerlendirme', 'Süreç']) {
      fireEvent.click(await screen.findByRole('button', { name: 'Adım ekle' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Adım başlığı (Türkçe)'), { target: { value: title } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Tamam' }));
    }
    expect(screen.queryByRole('button', { name: 'Adım ekle' })).toBeNull();
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    expect(json(api, 'src/data/home.json').process).toHaveLength(3);
  });
});

describe('settings screens', () => {
  it('Sosyal ve linkler: the header has an icon and a one-line intro', async () => {
    setup('linkler');
    const head = (await screen.findByRole('heading', { name: 'Sosyal Bağlantılar' })).closest('.screen-head')!;
    expect(head.querySelector('svg')).toBeTruthy();
    expect(screen.getByText('Sitede görünen sosyal hesaplarınız.')).toBeTruthy();
  });

  it('Sosyal ve linkler: the chosen icon is shown next to the Simge select and follows it', async () => {
    setup('linkler');
    fireEvent.click((await screen.findAllByRole('button', { name: /^Instagram/ }))[0]);
    const select = within(screen.getByRole('dialog')).getByLabelText('Simge') as HTMLSelectElement;
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
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${items[1].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }));
    fireEvent.click(within(screen.getByRole('dialog')).getByLabelText(/Öne çıkan kaynak/));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tamam' }));
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    const saved = json(api, 'src/data/resources.json');
    expect(Object.keys(saved).sort()).toEqual(['items', 'myNote']);
    expect(saved.items.map((i: { featured: boolean }) => i.featured)).toEqual(items.map((_: unknown, i: number) => i === 1));
  });

  it('Hakkımda: a timeline period switched to "TR/EN ayrı" is saved as { tr, en }', async () => {
    const api = setup('hakkimda');
    const first = json(api, 'src/data/about.json').timeline[0].title.tr as string;
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Dönem biçimi'), { target: { value: 'localized' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tamam' }));
    save();
    await waitFor(() => expect(api.state.commits).toHaveLength(1));
    const period = json(api, 'src/data/about.json').timeline[0].period;
    expect(typeof period).toBe('object');
    expect(Object.keys(period).sort()).toEqual(['en', 'tr']);
  });

  it('Kategoriler: a category in use cannot be deleted', async () => {
    setup('kategoriler');
    const card = await screen.findByRole('button', { name: /^Yaşam/ });
    // Usage is checked after the list shows; wait for it before opening the card.
    expect(await within(card).findByText(/kullanımda/)).toBeTruthy();
    fireEvent.click(card);
    expect((within(screen.getByRole('dialog')).getByRole('button', { name: /Sil/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Tamam' }));
    fireEvent.click(screen.getByRole('button', { name: /^Araştırma/ }));
    expect((within(screen.getByRole('dialog')).getByRole('button', { name: /Sil/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Kategoriler: when usage cannot be checked, nothing can be deleted (review I5)', async () => {
    setup('kategoriler', (api) => {
      api.listDrafts = () => Promise.reject(new Error('ağ yok'));
    });
    const unused = await screen.findByRole('button', { name: /^Araştırma/ });
    await waitFor(() => expect(within(unused).getByText(/Kontrol edilemedi/)).toBeTruthy());
    fireEvent.click(unused);
    expect((within(screen.getByRole('dialog')).getByRole('button', { name: /Sil/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('an unknown screen says so', async () => {
    setup('yok-boyle');
    expect(await screen.findByText(/Bu ayar ekranı bulunamadı/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Yazılara dön' }).getAttribute('href')).toBe('#/yazilar');
  });
});
