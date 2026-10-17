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

function setup(screenId: string) {
  const api = createMockApi();
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

describe('settings screens', () => {
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
    expect((within(row).getByRole('button', { name: /Sil/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(row).getByText(/Kullanımda/)).toBeTruthy();
    const unused = screen.getByDisplayValue('Araştırma').closest('li')!;
    expect((within(unused).getByRole('button', { name: /Sil/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('an unknown screen says so', async () => {
    setup('yok-boyle');
    expect(await screen.findByText(/Bu ayar ekranı bulunamadı/)).toBeTruthy();
  });
});
