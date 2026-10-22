// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TrashPage, daysLeft } from '../../../src/admin/ui/TrashPage';
import { Panel } from '../../../src/admin/ui/context';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const DAY = 24 * 60 * 60 * 1000;
const draft = (key: string, title: string) =>
  ({
    key,
    rev: 0,
    published: false,
    category: 'terapi',
    cover: null,
    publishedAt: '2026-10-01',
    tr: { title, seoTitle: '', description: '', slug: '', focusKeyword: '', coverAlt: '', body: '' },
    en: { title: '', seoTitle: '', description: '', slug: '', focusKeyword: '', coverAlt: '', body: '' },
  }) as never;

function show(api: ReturnType<typeof createMockApi>) {
  render(
    <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x' }, store: createSessionStore(localStorage) }}>
      <TrashPage />
    </Panel.Provider>,
  );
}

describe('TrashPage', () => {
  it('lists a deleted draft with the days left, and "Geri al" puts it back in the drafts', async () => {
    const api = createMockApi({ seed: {} });
    await api.saveDraft(draft('bag', 'Bağlanma'));
    await api.deleteDraft('bag', { trash: true });
    show(api);
    expect(await screen.findByText('Bağlanma')).toBeTruthy();
    expect(screen.getByText('30 gün sonra kalıcı olarak silinecek')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Geri al' }));
    expect(await screen.findByText(/taslaklara geri alındı/)).toBeTruthy();
    expect((await api.listDrafts()).drafts.map((d) => d.key)).toEqual(['bag']);
    expect((await api.listTrash()).items).toEqual([]);
  });

  it('"Kalıcı sil" asks first, then removes it', async () => {
    const api = createMockApi({ seed: {} });
    await api.saveDraft(draft('bag', 'Bağlanma'));
    await api.deleteDraft('bag', { trash: true });
    show(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Kalıcı sil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Evet, kalıcı sil' }));
    expect(await screen.findByText(/kalıcı olarak silindi/)).toBeTruthy();
    expect((await api.listTrash()).items).toEqual([]);
  });

  it('shows an empty trash', async () => {
    show(createMockApi({ seed: {} }));
    expect(await screen.findByText('Çöp kutusu boş.')).toBeTruthy();
  });

  it('counts the days left, rounding up, never below zero', () => {
    const now = Date.UTC(2026, 9, 19);
    expect(daysLeft({ purgeAt: new Date(now + 30 * DAY).toISOString() }, now)).toBe(30);
    expect(daysLeft({ purgeAt: new Date(now + DAY / 2).toISOString() }, now)).toBe(1);
    expect(daysLeft({ purgeAt: new Date(now - DAY).toISOString() }, now)).toBe(0);
  });
});
