// @vitest-environment jsdom
import { afterEach, beforeAll, describe, it, expect } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EditorPage } from '../../../src/admin/ui/editor/EditorPage';
import { PostsList } from '../../../src/admin/ui/PostsList';
import { Panel, parseRoute } from '../../../src/admin/ui/context';
import { DeployProvider } from '../../../src/admin/ui/DeployStatus';
import { createMockApi } from '../../../src/admin/api/mock';
import { createSessionStore } from '../../../src/admin/api/session';
import { formatSchedule, isFuture, isoDay, istanbulIso, istanbulParts, newDraft } from '../../../src/admin/lib/draft';
import { mergeList, STATUS_LABEL } from '../../../src/admin/lib/posts-repo';
import { dashboard } from '../../../src/admin/lib/dashboard';
import { publishLabel } from '../../../src/admin/ui/editor/EditorTopBar';
import type { Draft, DraftSummary, LangFields } from '../../../src/admin/api/types';

beforeAll(() => {
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {} });
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  location.hash = '';
});

describe('schedule helpers', () => {
  it('Istanbul wall time ⇄ instant', () => {
    expect(istanbulIso('2026-10-24', '09:00')).toBe('2026-10-24T09:00:00+03:00');
    expect(istanbulParts('2026-10-24T06:00:00.000Z')).toEqual({ day: '2026-10-24', time: '09:00' });
    expect(formatSchedule('2026-10-24T09:00:00+03:00')).toBe('24 Ekim 2026, 09.00');
    expect(isFuture('2026-10-24T09:00:00+03:00', new Date('2026-10-24T05:59:00Z'))).toBe(true);
    expect(isFuture('2026-10-24T09:00:00+03:00', new Date('2026-10-24T06:00:00Z'))).toBe(false);
    expect(publishLabel({ published: true }, true)).toBe('Planla');
    expect(publishLabel({ published: true })).toBe('Değişiklikleri yayınla');
  });
  it('#/yazilar/planlanan opens the planned tab', () => {
    expect(parseRoute('#/yazilar/planlanan')).toEqual({ name: 'posts', tab: 'planned' });
  });
  it('a planned draft gets the "Planlandı" status; the dashboard lists planned posts by time and the failing ones', () => {
    const s = (key: string, scheduledAt: string | null, scheduleError: string | null = null): DraftSummary => ({
      key, rev: 1, updatedAt: '2026-10-17T10:00:00Z', published: false, category: 'terapi', title: { tr: key, en: key }, scheduledAt, scheduleError,
    });
    const rows = mergeList([], [s('a', '2026-10-25T09:00:00+03:00'), s('b', null)]);
    expect(rows.map((r) => [r.key, r.status])).toEqual([['a', 'planlandı'], ['b', 'taslak']]);
    expect(STATUS_LABEL.planlandı).toBe('Planlandı');
    const d = dashboard([], [s('late', '2026-10-26T09:00:00+03:00'), s('soon', '2026-10-24T09:00:00+03:00', 'GitHub yanıt vermedi.'), s('x', null)], new Date('2026-10-20T10:00:00Z'));
    expect(d.scheduled.map((x) => x.key)).toEqual(['soon', 'late']);
    expect(d.scheduleErrors.map((x) => x.key)).toEqual(['soon']);
  });
});

const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metin.' }] }] };
const filled = (title: string, slug: string): LangFields => ({
  title, subtitle: '', seoTitle: '', slug, slugTouched: false, description: 'Açıklama', focusKeyword: 'kelime', coverAlt: '', doc: body, references: [],
});
const seed = {
  'src/data/categories.json': '[{"id":"terapi","slug":{"tr":"terapi","en":"therapy"},"label":{"tr":"Terapi","en":"Therapy"}}]\n',
  'src/data/redirects.json': '[]\n',
};
const tomorrow = () => isoDay(new Date(Date.now() + 24 * 3600e3));

function setupEditor(over: Partial<Draft> = {}, scheduleError?: string) {
  localStorage.setItem('panel.rail', 'settings');
  const api = createMockApi({ seed });
  const draft: Draft = { ...newDraft(new Date()), category: 'terapi', tr: filled('Kaygı', 'kaygi'), en: filled('Anxiety', 'anxiety'), ...over };
  api.state.drafts.set(draft.key, { ...draft, rev: 1 });
  if (scheduleError) api.state.scheduleErrors.set(draft.key, scheduleError);
  render(
    <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' }, store: createSessionStore(localStorage) }}>
      <DeployProvider api={api}>
        <EditorPage postKey={draft.key} />
      </DeployProvider>
    </Panel.Provider>,
  );
  return { api, draft };
}

describe('planning in the editor', () => {
  it('a future time turns Yayınla into Planla', async () => {
    setupEditor();
    const settings = await screen.findByRole('region', { name: 'Ayarlar' });
    expect(screen.getByRole('button', { name: 'Yayınla' })).toBeTruthy();
    fireEvent.change(within(settings).getByLabelText('Yayın tarihi'), { target: { value: tomorrow() } });
    fireEvent.change(within(settings).getByLabelText('Yayın saati (isteğe bağlı)'), { target: { value: '09:00' } });
    expect(screen.getByRole('button', { name: 'Planla' })).toBeTruthy();
    expect(within(settings).getByText('Planlanan saatten sonraki bir saat içinde yayınlanır.')).toBeTruthy();
  });

  it('a time today that has passed keeps Yayınla', async () => {
    setupEditor();
    const settings = await screen.findByRole('region', { name: 'Ayarlar' });
    fireEvent.change(within(settings).getByLabelText('Yayın tarihi'), { target: { value: '2020-01-01' } });
    fireEvent.change(within(settings).getByLabelText('Yayın saati (isteğe bağlı)'), { target: { value: '09:00' } });
    expect(screen.getByRole('button', { name: 'Yayınla' })).toBeTruthy();
  });

  it('Planla saves the schedule and commits nothing; Planlamayı iptal et returns it to a draft', async () => {
    const { api, draft } = setupEditor();
    const settings = await screen.findByRole('region', { name: 'Ayarlar' });
    const day = tomorrow();
    fireEvent.change(within(settings).getByLabelText('Yayın tarihi'), { target: { value: day } });
    fireEvent.change(within(settings).getByLabelText('Yayın saati (isteğe bağlı)'), { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Planla' }));
    const dialog = await screen.findByRole('dialog', { name: 'Planlansın mı?' });
    expect(within(dialog).getByText(`Yazı ${formatSchedule(istanbulIso(day, '09:00'))}'da yayına girecek.`)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Evet, planla' }));
    await waitFor(() => expect(api.state.drafts.get(draft.key)?.scheduledAt).toBe(`${day}T09:00:00+03:00`));
    expect(api.state.commits).toHaveLength(0);
    expect(api.state.triggerCalls).toBe(1);
    expect(within(settings).getByText('Planlandı', { selector: '.badge' })).toBeTruthy();
    expect(within(settings).getByText(formatSchedule(istanbulIso(day, '09:00')))).toBeTruthy();

    fireEvent.click(within(settings).getByRole('button', { name: 'Planlamayı iptal et' }));
    await waitFor(() => expect(api.state.drafts.get(draft.key)?.scheduledAt).toBeNull());
    expect(within(settings).getByText('Taslak', { selector: '.badge' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yayınla' })).toBeTruthy();
  });

  it('a schedule error shows on the post', async () => {
    setupEditor({ scheduledAt: '2026-10-01T09:00:00+03:00' }, 'GitHub yanıt vermedi.');
    expect(await screen.findByText('Planlanan yayın yapılamadı, tekrar denenecek. GitHub yanıt vermedi.')).toBeTruthy();
  });
});

describe('Planlanan tab', () => {
  it('lists planned drafts with their time', async () => {
    const api = createMockApi({ seed });
    const fresh = newDraft(new Date('2026-05-01'));
    await api.saveDraft({ ...fresh, key: 'taslak-1', tr: { ...fresh.tr, title: 'Planlı yazı' }, scheduledAt: '2026-10-25T09:00:00+03:00' });
    await api.saveDraft({ ...fresh, key: 'taslak-2', tr: { ...fresh.tr, title: 'Düz taslak' } });
    render(
      <Panel.Provider value={{ api, config: { apiUrl: 'mock', googleClientId: 'x', ownerEmail: 'merhaba@klinikterapist.com' }, store: createSessionStore(localStorage) }}>
        <PostsList tab="planned" />
      </Panel.Provider>,
    );
    expect(await screen.findByRole('link', { name: 'Planlanan 1' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Taslaklar 1' })).toBeTruthy();
    const row = await screen.findByText('Planlı yazı');
    expect(row.closest('a')?.textContent).toContain('Planlandı · 25 Ekim 2026, 09.00');
    expect(screen.queryByText('Düz taslak')).toBeNull();
  });
});
