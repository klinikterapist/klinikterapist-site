// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PostsList } from '../../../src/admin/ui/PostsList';
import { Panel } from '../../../src/admin/ui/context';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';
import { newDraft } from '../../../src/admin/lib/draft';
import { readBackup } from '../../../src/admin/ui/editor/useAutosave';

afterEach(() => {
  cleanup();
  localStorage.clear();
  location.hash = '';
});

const post = (slug: string, title: string, category: string, date = '2026-03-10') =>
  `---\ntitle: "${title}"\ndescription: "D"\nslug: "${slug}"\nfocusKeyword: "k"\ncategory: "${category}"\npublishedAt: ${date}\n---\n\nMetin.\n`;

function setup(tab: 'live' | 'drafts' = 'live', withDrafts = false) {
  const api = createMockApi({
    seed: {
      'src/content/posts/kaygi/tr.md': post('kaygi', 'Kaygı ile yaşamak', 'terapi'),
      'src/content/posts/kaygi/en.md': post('anxiety', 'Living with anxiety', 'terapi'),
      'src/content/posts/uyku/tr.md': post('uyku', 'İyi bir uyku', 'yasam', '2026-04-10'),
      'src/content/posts/uyku/en.md': post('sleep', 'A good sleep', 'yasam', '2026-04-10'),
      'src/data/categories.json':
        '[{"id":"terapi","slug":{"tr":"terapi","en":"therapy"},"label":{"tr":"Terapi","en":"Therapy"}},{"id":"yasam","slug":{"tr":"yasam","en":"life"},"label":{"tr":"Yaşam","en":"Life"}}]\n',
    },
  });
  if (withDrafts) {
    const fresh = newDraft(new Date('2026-05-01'));
    void api.saveDraft({ ...fresh, key: 'taslak-1', tr: { ...fresh.tr, title: 'Yeni taslak' } });
    void api.saveDraft({ ...fresh, key: 'kaygi', published: true, tr: { ...fresh.tr, title: 'Kaygı ile yaşamak' } });
  }
  render(
    <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' }, store: createSessionStore(localStorage) }}>
      <PostsList tab={tab} />
    </Panel.Provider>,
  );
  return api;
}

describe('PostsList', () => {
  it('lists live posts with their status, and filters by Turkish-aware search and category', async () => {
    setup();
    expect(await screen.findByText('Kaygı ile yaşamak')).toBeTruthy();
    // Two status badges, and the count above the tabs.
    expect(screen.getAllByText('Yayında', { selector: '.badge' })).toHaveLength(2);
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

  it('shows tab counts and lists a live post with unsaved changes in both tabs', async () => {
    setup('live', true);
    expect(await screen.findByText('İyi bir uyku')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Yayında 2' }).getAttribute('href')).toBe('#/yazilar');
    expect(screen.getByRole('link', { name: 'Taslaklar 2' }).getAttribute('href')).toBe('#/yazilar/taslaklar');
    expect(screen.getByText('Kaygı ile yaşamak')).toBeTruthy();
    expect(screen.queryByText('Yeni taslak')).toBeNull();
  });

  it('"Taslaklar" hides plain live rows', async () => {
    setup('drafts', true);
    expect(await screen.findByText('Yeni taslak')).toBeTruthy();
    expect(screen.getByText('Kaygı ile yaşamak')).toBeTruthy();
    expect(screen.queryByText('İyi bir uyku')).toBeNull();
  });

  it('sorts by updatedAt, newest first by default', async () => {
    setup();
    await screen.findByText('İyi bir uyku');
    const titles = () => screen.getAllByRole('link').filter((a) => a.classList.contains('post-row')).map((a) => a.querySelector('.post-row-title')!.textContent);
    expect(titles()).toEqual(['İyi bir uyku', 'Kaygı ile yaşamak']);
    fireEvent.change(screen.getByLabelText('Sırala'), { target: { value: 'oldest' } });
    expect(titles()).toEqual(['Kaygı ile yaşamak', 'İyi bir uyku']);
  });
});
