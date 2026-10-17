// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { DeployProvider, useDeploy } from '../../../src/admin/ui/DeployStatus';
import type { Api, SiteStatus } from '../../../src/admin/api/types';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const base: SiteStatus = { state: 'success', commitSha: 'c1', url: 'https://github.com/run/1', updatedAt: null, tokenExpiresAt: null };

function Tracker({ sha }: { sha: string }) {
  const { track } = useDeploy();
  return (
    <button type="button" onClick={() => track(sha)}>
      izle
    </button>
  );
}

const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe('DeployProvider', () => {
  it('shows progress until the run for the commit finishes, then "Yayında" for a while', async () => {
    const states: SiteStatus[] = [
      base,
      { ...base, state: 'in_progress', commitSha: 'c2' },
      { ...base, state: 'success', commitSha: 'c2' },
    ];
    const api = { status: vi.fn(async () => states.shift() ?? { ...base, commitSha: 'c2' }) } as unknown as Api;
    render(
      <DeployProvider api={api} intervalMs={1000}>
        <Tracker sha="c2" />
      </DeployProvider>,
    );
    await tick(0);
    act(() => screen.getByText('izle').click());
    expect(screen.getByText(/Site güncelleniyor/)).toBeTruthy();
    await tick(1000);
    expect(screen.getByText(/Site güncelleniyor/)).toBeTruthy();
    await tick(1000);
    expect(screen.getByText(/Yayında ✓/)).toBeTruthy();
    await tick(10000);
    expect(screen.queryByText(/Yayında ✓/)).toBeNull();
  });

  it('a failed run stays visible with a link, and the token warning appears 30 days ahead', async () => {
    const soon = new Date(Date.now() + 10 * 24 * 3600e3).toISOString();
    const states: SiteStatus[] = [{ ...base, tokenExpiresAt: soon }, { ...base, state: 'failure', commitSha: 'c3', tokenExpiresAt: soon }];
    const api = { status: vi.fn(async () => states.shift() ?? states[0]) } as unknown as Api;
    render(
      <DeployProvider api={api} intervalMs={1000}>
        <Tracker sha="c3" />
      </DeployProvider>,
    );
    await tick(0);
    expect(screen.getByText(/GitHub bağlantı anahtarının süresi/)).toBeTruthy();
    act(() => screen.getByText('izle').click());
    await tick(1000);
    expect(screen.getByText(/Yayın başarısız oldu/)).toBeTruthy();
    await tick(20000);
    expect(screen.getByText(/Yayın başarısız oldu/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ayrıntı' }).getAttribute('href')).toBe('https://github.com/run/1');
  });
});
