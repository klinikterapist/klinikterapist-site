// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const cropperProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));
vi.mock('react-easy-crop', () => ({
  default: (props: Record<string, unknown> & { onCropComplete: (a: unknown, px: unknown) => void }) => {
    cropperProps.last = props;
    // Report a fixed frame once, as the real cropper does after the image loads.
    queueMicrotask(() => props.onCropComplete({ x: 10, y: 20, width: 50, height: 40 }, { x: 0, y: 0, width: 1, height: 1 }));
    return <div data-testid="cropper" />;
  },
}));

import { CropDialog } from '../../../src/admin/ui/editor/CropDialog';

class FakeImage {
  naturalWidth = 1600;
  naturalHeight = 1600;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_: string) {
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage);
  cropperProps.last = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const open = (over: Partial<Parameters<typeof CropDialog>[0]> = {}) => {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(<CropDialog title="Kapağı ayarla" imageUrl="data:image/webp;base64,x" aspect={16 / 9} initial={null} onApply={onApply} onClose={onClose} {...over} />);
  return { onApply, onClose };
};

describe('CropDialog', () => {
  it('is a dialog with the given title', async () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Kapağı ayarla' })).toBeTruthy();
    await screen.findByTestId('cropper');
  });
  it('"Uygula" hands over the frame the cropper reported', async () => {
    const { onApply } = open();
    await screen.findByTestId('cropper');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Uygula' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Uygula' }));
    expect(onApply).toHaveBeenCalledWith({ x: 10, y: 20, w: 50, h: 40 });
  });
  it('"Vazgeç" closes', async () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(onClose).toHaveBeenCalled();
  });
  it('the zoom slider goes from 1 to 3', () => {
    open();
    const slider = screen.getByLabelText('Yakınlaştır') as HTMLInputElement;
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('3');
  });
  it('a new cover starts centred at 16:9', async () => {
    open();
    await screen.findByTestId('cropper');
    expect(cropperProps.last?.aspect).toBeCloseTo(16 / 9);
    expect(cropperProps.last?.initialCroppedAreaPercentages).toEqual({ x: 0, y: 21.88, width: 100, height: 56.25 });
  });
  it('a saved frame comes back', async () => {
    open({ initial: { x: 0, y: 10, w: 100, h: 56.25 } });
    await screen.findByTestId('cropper');
    expect(cropperProps.last?.initialCroppedAreaPercentages).toEqual({ x: 0, y: 10, width: 100, height: 56.25 });
  });
  it('a free crop uses the image ratio; circle uses the round frame', async () => {
    open({ aspect: null, shape: 'circle' });
    await screen.findByTestId('cropper');
    expect(cropperProps.last?.aspect).toBe(1);
    expect(cropperProps.last?.cropShape).toBe('round');
  });
});
