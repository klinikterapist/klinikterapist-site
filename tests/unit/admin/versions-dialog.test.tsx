// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EditorPage } from '../../../src/admin/ui/editor/EditorPage';
import { VersionsDialog } from '../../../src/admin/ui/editor/VersionsDialog';
import { Panel } from '../../../src/admin/ui/context';
import { DeployProvider } from '../../../src/admin/ui/DeployStatus';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';
import { ApiFailure, type Api, type Draft, type LangFields } from '../../../src/admin/api/types';

beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {} });
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const para = (t: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
const lang = (title: string, text: string): LangFields => ({
  title, subtitle: '', seoTitle: '', slug: 's', slugTouched: false, description: 'D', focusKeyword: 'k', coverAlt: '', doc: para(text), references: [],
});
const draft = (rev: number, tr: string, en: string): Draft => ({
  key: 'k1', rev, updatedAt: '2026-10-17T10:00:00.000Z', published: false, category: 'terapi', cover: null, publishedAt: '2026-10-17', tr: lang(tr, `${tr} metni`), en: lang(en, `${en} metni`),
});

const NOW = new Date(2026, 9, 17, 16, 0);
const iso = (d: number, h: number, m: number) => new Date(2026, 9, d, h, m).toISOString();

function fakeApi(over: Partial<Api>): Api {
  return over as Api;
}

describe('VersionsDialog', () => {
  const versions = [
    { name: 'b.json', rev: 5, savedAt: iso(17, 14, 32) },
    { name: 'a.json', rev: 3, savedAt: iso(16, 21, 5) },
  ];
  const old = draft(3, 'Eski başlık', 'Old title');
  const api = (extra: Partial<Api> = {}) =>
    fakeApi({ listVersions: async () => ({ versions }), getVersion: async () => ({ draft: old }), ...extra });
  const open = (a: Api, onRestore = vi.fn()) => {
    render(<VersionsDialog api={a} draftKey="k1" lang="tr" now={NOW} onRestore={onRestore} onClose={() => {}} />);
    return onRestore;
  };

  it('lists the versions with date labels', async () => {
    open(api());
    expect(await screen.findByRole('button', { name: /Bugün 14\.32/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Dün 21\.05/ })).toBeTruthy();
  });

  it('shows the chosen version read-only, in the editing language, and hands it back for restoring', async () => {
    const onRestore = open(api());
    fireEvent.click(await screen.findByRole('button', { name: /Dün 21\.05/ }));
    expect(await screen.findByText('Eski başlık metni')).toBeTruthy();
    expect(screen.queryByText('Old title metni')).toBeNull();
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bu sürüme dön' }));
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect((onRestore.mock.calls[0][0] as Draft).tr.title).toBe('Eski başlık');
  });

  it('says so when there are no earlier versions', async () => {
    open(api({ listVersions: async () => ({ versions: [] }) }));
    expect(await screen.findByText('Henüz kayıtlı bir önceki sürüm yok.')).toBeTruthy();
  });

  it('asks for an Apps Script update when the backend does not know the action', async () => {
    open(api({ listVersions: async () => { throw new ApiFailure('bad_request', 'Bilinmeyen işlem: drafts.versions'); } }));
    expect(await screen.findByText("Sürüm geçmişi için Apps Script'in güncellenmesi gerekiyor.")).toBeTruthy();
  });

  it('shows the backend message when a version cannot be read', async () => {
    open(api({ getVersion: async () => { throw new ApiFailure('not_found', 'Bu sürüm okunamadı.'); } }));
    fireEvent.click(await screen.findByRole('button', { name: /Dün 21\.05/ }));
    expect(await screen.findByText('Bu sürüm okunamadı.')).toBeTruthy();
  });
});

describe('EditorPage version history', () => {
  it('restoring saves with snapshot: true and the editor shows the restored text', async () => {
    const mock = createMockApi({
      seed: { 'src/data/categories.json': '[{"id":"terapi","slug":{"tr":"terapi","en":"therapy"},"label":{"tr":"Terapi","en":"Therapy"}}]\n', 'src/data/redirects.json': '[]\n' },
    });
    mock.state.drafts.set('k1', { ...draft(1, 'Eski başlık', 'Old'), rev: 1 });
    const first = await mock.saveDraft({ ...draft(1, 'Eski başlık', 'Old') }, { snapshot: true });
    await mock.saveDraft({ ...draft(first.rev, 'Yeni başlık', 'Old') });
    const saveDraft = vi.spyOn(mock, 'saveDraft');
    const config = { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' };
    render(
      <Panel.Provider value={{ api: mock, config, store: createSessionStore(localStorage) }}>
        <DeployProvider api={mock}>
          <EditorPage postKey="k1" />
        </DeployProvider>
      </Panel.Provider>,
    );
    expect(await screen.findByDisplayValue('Yeni başlık')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sürüm geçmişi' }));
    const dlg = await screen.findByRole('dialog', { name: 'Sürüm geçmişi' });
    const items = await within(dlg).findAllByRole('button', { name: /sürüm \d+/ });
    fireEvent.click(items[0]);
    fireEvent.click(await within(dlg).findByRole('button', { name: 'Bu sürüme dön' }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    const [sent, opts] = saveDraft.mock.calls.at(-1)!;
    expect(opts).toEqual({ snapshot: true });
    expect(sent.tr.title).toBe('Eski başlık');
    expect(await screen.findByDisplayValue('Eski başlık')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Sürüm geçmişi' })).toBeNull();
    expect((await mock.getDraft('k1')).draft.tr.title).toBe('Eski başlık');
  });
});
