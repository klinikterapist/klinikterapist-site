// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('react-easy-crop', () => ({
  default: (props: { initialCroppedAreaPercentages: unknown; onCropComplete: (a: unknown, px: unknown) => void }) => {
    queueMicrotask(() => props.onCropComplete({ x: 0, y: 5, width: 100, height: 56.25 }, {}));
    return <div data-testid="cropper" data-initial={JSON.stringify(props.initialCroppedAreaPercentages)} />;
  },
}));
const renderCrop = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ base64: 'Q1JPUA==', ext: 'webp' })));
vi.mock('../../../src/admin/lib/crop', async (orig) => ({ ...(await orig<object>()), renderCrop }));
const resizeImage = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({ base64: 'T1JJRw==', ext: 'webp', type: 'image/webp', width: 2000, height: 1500 })));
vi.mock('../../../src/admin/lib/image', async (orig) => ({ ...(await orig<object>()), resizeImage }));

import { CoverBlock } from '../../../src/admin/ui/editor/CoverBlock';
import type { CropArea } from '../../../src/admin/lib/crop';

class FakeImage {
  naturalWidth = 2000;
  naturalHeight = 1500;
  onload: (() => void) | null = null;
  set src(_: string) {
    queueMicrotask(() => this.onload?.());
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage);
  renderCrop.mockClear();
  resizeImage.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(draft: { cover: string | null; coverOriginal: string | null; coverCrop: CropArea | null }) {
  const images = { url: vi.fn(async (n: string) => `data:image/webp;base64,${n === 'cover.webp' ? 'Q09WRVI=' : 'T1JJRw=='}`), add: vi.fn(async (_name: string, _base64: string) => {}) };
  const onShared = vi.fn();
  const onCoverUploaded = vi.fn();
  render(<CoverBlock draft={draft} images={images} coverVersion={0} onShared={onShared} onCoverUploaded={onCoverUploaded} onError={() => {}} lang="tr" alt="Kapak" />);
  return { images, onShared, onCoverUploaded };
}

const apply = async () => {
  await screen.findByTestId('cropper');
  await waitFor(() => expect((screen.getByRole('button', { name: 'Uygula' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Uygula' }));
};

describe('CoverBlock', () => {
  it('an older cover with no original opens centred and becomes its own original on "Uygula"', async () => {
    const { images, onShared, onCoverUploaded } = setup({ cover: 'cover.webp', coverOriginal: null, coverCrop: null });
    fireEvent.click(screen.getByRole('button', { name: 'Kapağı ayarla' }));
    expect(await screen.findByRole('dialog', { name: 'Kapağı ayarla' })).toBeTruthy();
    const cropper = await screen.findByTestId('cropper');
    expect(JSON.parse(cropper.dataset.initial!)).toEqual({ x: 0, y: 12.5, width: 100, height: 75 });
    await apply();
    await waitFor(() => expect(onShared).toHaveBeenCalled());
    expect(renderCrop).toHaveBeenCalledWith('Q09WRVI=', { x: 0, y: 5, w: 100, h: 56.25 }, { w: 1600, h: 900 }, 'image/webp', 0.82);
    expect(images.add.mock.calls.map((c) => c[0])).toEqual(['cover-orig.webp', 'cover.webp']);
    expect(images.add).toHaveBeenCalledWith('cover-orig.webp', 'Q09WRVI=');
    expect(onShared).toHaveBeenCalledWith({ cover: 'cover.webp', coverOriginal: 'cover-orig.webp', coverCrop: { x: 0, y: 5, w: 100, h: 56.25 } });
    expect(onCoverUploaded).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('re-opening a cropped cover brings the saved frame back and crops from the original', async () => {
    const saved = { x: 0, y: 20, w: 100, h: 75 };
    const { images } = setup({ cover: 'cover.webp', coverOriginal: 'cover-orig.webp', coverCrop: saved });
    fireEvent.click(screen.getByRole('button', { name: 'Kapağı ayarla' }));
    const cropper = await screen.findByTestId('cropper');
    expect(JSON.parse(cropper.dataset.initial!)).toEqual({ x: 0, y: 20, width: 100, height: 75 });
    await apply();
    await waitFor(() => expect(renderCrop).toHaveBeenCalled());
    expect(renderCrop.mock.calls[0][0]).toBe('T1JJRw==');
    // The original is already stored: only the new crop is uploaded.
    await waitFor(() => expect(images.add.mock.calls.map((c) => c[0])).toEqual(['cover.webp']));
  });

  it('a new upload stores nothing until "Uygula", so "Vazgeç" keeps the current cover', async () => {
    const { images, onShared } = setup({ cover: null, coverOriginal: null, coverCrop: null });
    const input = screen.getByTestId('cover-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.heic', { type: 'image/heic' })] } });
    await screen.findByRole('dialog', { name: 'Kapağı ayarla' });
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(images.add).not.toHaveBeenCalled();
    expect(onShared).not.toHaveBeenCalled();
    expect(resizeImage.mock.calls[0][1]).toMatchObject({ maxW: 2000, maxH: 2000, q: 0.85 });
  });
});
