// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Home } from '../../../src/admin/ui/Home';
import { Panel } from '../../../src/admin/ui/context';
import { DeployProvider } from '../../../src/admin/ui/DeployStatus';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const post = (slug: string, title: string) =>
  `---\ntitle: "${title}"\ndescription: "D"\nslug: "${slug}"\nfocusKeyword: "k"\ncategory: "terapi"\npublishedAt: 2026-03-10\n---\n\nMetin.\n`;

describe('Home', () => {
  it('shows the four cards with the live post and the draft', async () => {
    const api = createMockApi({
      seed: {
        'src/content/posts/kaygi/tr.md': post('kaygi', 'Kaygı ile yaşamak'),
        'src/content/posts/kaygi/en.md': post('anxiety', 'Living with anxiety'),
        'src/data/categories.json': '[{"id":"terapi","slug":{"tr":"terapi","en":"therapy"},"label":{"tr":"Terapi","en":"Therapy"}}]\n',
      },
    });
    await api.saveDraft({
      key: 'bag',
      rev: 0,
      published: false,
      category: 'terapi',
      cover: null,
      publishedAt: '2026-10-01',
      tr: { title: 'Bağlanma', seoTitle: '', description: '', slug: '', focusKeyword: '', coverAlt: '', body: '' },
      en: { title: '', seoTitle: '', description: '', slug: '', focusKeyword: '', coverAlt: '', body: '' },
    } as never);
    render(
      <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'a@b.c' }, store: createSessionStore(localStorage) }}>
        <DeployProvider api={api}>
          <Home />
        </DeployProvider>
      </Panel.Provider>,
    );
    expect(await screen.findByText('Kaygı ile yaşamak')).toBeTruthy();
    expect(screen.getByText('Son yayınlanan')).toBeTruthy();
    expect(screen.getAllByText('Bağlanma').length).toBeGreaterThan(0);
    expect(screen.getByText(/İngilizcesi yok/)).toBeTruthy();
    expect(screen.getByText('Bu ay')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tümü' }).getAttribute('href')).toBe('#/yazilar/taslaklar');
  });

  it('has no "Yeni yazı" button (the sidebar has it)', async () => {
    const api = createMockApi();
    render(
      <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'a@b.c' }, store: createSessionStore(localStorage) }}>
        <DeployProvider api={api}>
          <Home />
        </DeployProvider>
      </Panel.Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Ana sayfa' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Yeni yazı' })).toBeNull();
  });
});
