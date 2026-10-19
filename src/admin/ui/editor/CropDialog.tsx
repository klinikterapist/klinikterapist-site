/**
 * Crop and zoom one image: drag to move, wheel or pinch to zoom, and the "Yakınlaştır" slider.
 * Used for the cover (16:9) and for body images (shape chips come in as `children`). The area is
 * reported in percent of the original, so the same frame comes back when the dialog is reopened.
 */
import { useEffect, useState, type ReactNode } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { centredCrop, clampCrop, type CropArea } from '../../lib/crop';
import { Button, Dialog, Spinner } from '../kit';

export type CropDialogProps = {
  title: string;
  imageUrl: string;
  /** Width / height of the frame; null keeps the image's own ratio. */
  aspect: number | null;
  shape?: 'circle' | 'pill' | null;
  initial: CropArea | null;
  onApply: (a: CropArea) => void;
  onClose: () => void;
  /** Extra controls under the slider (the body image's shape and size chips). */
  children?: ReactNode;
};

const toArea = (a: CropArea): Area => ({ x: a.x, y: a.y, width: a.w, height: a.h });
const fromArea = (a: Area): CropArea => clampCrop({ x: a.x, y: a.y, w: a.width, h: a.height });

export function CropDialog({ title, imageUrl, aspect, shape = null, initial, onApply, onClose, children }: CropDialogProps) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(initial);

  // The frame ratio must be known before the cropper mounts, so the saved frame lands where it was.
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => alive && setFailed(true);
    img.src = imageUrl;
    return () => {
      alive = false;
    };
  }, [imageUrl]);

  const ratio = aspect ?? (natural ? natural.w / natural.h : 1);
  // A saved frame only fits the ratio it was made with; after a shape change start centred.
  const fits = (a: CropArea, n: { w: number; h: number }) => Math.abs((a.w * n.w) / (a.h * n.h) / ratio - 1) < 0.02;
  const start = natural ? (initial && fits(initial, natural) ? initial : centredCrop(natural.w, natural.h, ratio)) : null;

  return (
    <Dialog
      title={title}
      onClose={onClose}
      history
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" disabled={!area} onClick={() => area && onApply(area)}>
            Uygula
          </Button>
        </>
      }
    >
      <div className="crop-dialog">
        <div className={`crop-stage${shape === 'pill' ? ' crop-stage-pill' : ''}`}>
          {failed ? (
            <p className="k-hint">Görsel açılamadı. Kapatıp yeniden deneyin.</p>
          ) : natural && start ? (
            <Cropper
              key={ratio}
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={3}
              aspect={ratio}
              cropShape={shape === 'circle' ? 'round' : 'rect'}
              showGrid={false}
              initialCroppedAreaPercentages={toArea(start)}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(a) => setArea(fromArea(a))}
              classes={{ cropAreaClassName: shape === 'pill' ? 'crop-area-pill' : undefined }}
              mediaProps={{ alt: '' }}
            />
          ) : (
            <Spinner label="Görsel açılıyor…" />
          )}
        </div>
        <label className="crop-zoom">
          <span>Yakınlaştır</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        {children}
      </div>
    </Dialog>
  );
}
