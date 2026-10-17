// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PostsList } from '../../../src/admin/ui/PostsList';
import { Panel } from '../../../src/admin/ui/context';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';
import { readBackup } from '../../../src/admin/ui/editor/useAutosave';

afterEach(() => {
  cleanup();
  localStorage.clear();
  location.hash = '';
});

const post = (slug: string, title: string, category: string) =>
  `---\ntitle: "${title}"\ndescription: "D"\nslug: "${slug}"\nfocusKeyword: "k"\ncategory: "${category}"\npublishedAt: 2026-03-10\n---\n\nMetin.\n`;

function setup() {
  const api = createMockApi({
    seed: {
      'src/content/posts/kaygi/tr.md': post('kaygi', 'Kaygı ile yaşamak', 'terapi'),
      'src/content/posts/kaygi/en.md': post('anxiety', 'Living with anxiety', 'terapi'),
      'src/content/posts/uyku/tr.md': post('uyku', 'İyi bir uyku', 'yasam'),
      'src/content/posts/uyku/en.md': post('sleep', 'A good sleep', 'yasam'),
      'src/data/categories.json':
        '[{"id":"terapi","slug":{"tr":"terapi","en":"therapy"},"label":{"tr":"Terapi","en":"Therapy"}},{"id":"yasam","slug":{"tr":"yasam","en":"life"},"label":{"tr":"Yaşam","en":"Life"}}]\n',
    },
  });
  render(
    <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' }, store: createSessionStore(localStorage) }}>
      <PostsList />
    </Panel.Provider>,
  );
  return api;
}

describe('PostsList', () => {
  it('lists live posts with their status, and filters by Turkish-aware search and category', async () => {
    setup();
    expect(await screen.findByText('Kaygı ile yaşamak')).toBeTruthy();
    expect(screen.getAllByText('Yayında')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Ara'), { target: { value: 'İYİ' } });
    expect(screen.queryByText('Kaygı ile yaşamak')).toBeNull();
    expect(screen.getByText('İyi bir uyku')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Ara'), { target: { value: 'anxiety' } });
    expect(screen.getByText('Kaygı ile yaşamak')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Ara'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'yasam' } });
    expect(screen.queryByText('Kaygı ile yaşamak')).toBeNull();
  });

  it('"Yeni yazı" opens a new draft kept on this device', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: 'Yeni yazı' }));
    const key = location.hash.replace('#/yazi/', '');
    expect(key).toMatch(/^taslak-/);
    expect(readBackup(key, localStorage)?.rev).toBe(0);
  });
});
