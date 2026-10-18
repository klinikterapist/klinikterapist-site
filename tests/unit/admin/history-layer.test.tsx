// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { useHistoryLayer } from '../../../src/admin/ui/history-layer';

afterEach(cleanup);

const popstate = () => new Promise<void>((r) => window.addEventListener('popstate', () => r(), { once: true }));
const tick = () => new Promise((r) => setTimeout(r, 30));

let closeFns: Array<() => void> = [];
function Layer({ onClose, i = 0 }: { onClose: () => void; i?: number }) {
  closeFns[i] = useHistoryLayer(onClose);
  return null;
}

describe('useHistoryLayer', () => {
  it('pushes one entry on mount and closes on back', async () => {
    const before = history.length;
    const onClose = vi.fn();
    render(<Layer onClose={onClose} />);
    expect(history.length).toBe(before + 1);
    const p = popstate();
    history.back();
    await p;
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close() removes its own entry', async () => {
    history.pushState(null, '', location.href); // known baseline entry
    const before = history.length;
    const onClose = vi.fn();
    render(<Layer onClose={onClose} />);
    expect(history.length).toBe(before + 1);
    const p = popstate();
    closeFns[0]();
    await p;
    await tick();
    expect(onClose).toHaveBeenCalledTimes(1);
    // Back on the baseline entry; the layer's entry is only a forward entry that the next push replaces.
    expect(history.state?.layer).toBeUndefined();
    history.pushState(null, '', location.href);
    expect(history.length).toBe(before + 1);
  });

  it('two layers: back closes the top one only', async () => {
    const bottom = vi.fn();
    const top = vi.fn();
    render(
      <>
        <Layer onClose={bottom} i={0} />
        <Layer onClose={top} i={1} />
      </>,
    );
    const p = popstate();
    history.back();
    await p;
    await tick();
    expect(top).toHaveBeenCalledTimes(1);
    expect(bottom).not.toHaveBeenCalled();
  });

  it('without a layer, back is not intercepted', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<Layer onClose={onClose} />);
    unmount();
    await tick();
    const p = popstate();
    history.back();
    await p;
    await tick();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('StrictMode double mount leaves one entry and closes once', async () => {
    const push = vi.spyOn(history, 'pushState');
    const onClose = vi.fn();
    render(
      <StrictMode>
        <Layer onClose={onClose} />
      </StrictMode>,
    );
    await tick();
    expect(push).toHaveBeenCalledTimes(1);
    push.mockRestore();
    const p = popstate();
    history.back();
    await p;
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
