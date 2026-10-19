/**
 * "Görseli düzenle": shape (Özgün, Dikdörtgen, Kare, Hap, Yuvarlak), size and crop of one body
 * image. The crop frame follows the chosen shape; "Uygula" hands back all three.
 */
import { useState } from 'react';
import type { CropArea } from '../../lib/crop';
import { ASPECT, type Shape, type Size } from '../../../lib/figure-frame';
import { CropDialog } from './CropDialog';

export type ImageEdit = { shape: Shape; size: Size; area: CropArea };

const SHAPE_CHIPS: { value: 'original' | 'rect' | 'square' | 'pill' | 'circle'; label: string }[] = [
  { value: 'original', label: 'Özgün' },
  { value: 'rect', label: 'Dikdörtgen' },
  { value: 'square', label: 'Kare' },
  { value: 'pill', label: 'Hap' },
  { value: 'circle', label: 'Yuvarlak' },
];
const SIZE_CHIPS: { value: Size; label: string }[] = [
  { value: 'full', label: 'Tam genişlik' },
  { value: 'md', label: 'Orta' },
  { value: 'sm', label: 'Küçük' },
];

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chip-row" role="radiogroup" aria-label={label}>
      <span className="chip-row-label">{label}</span>
      <div className="chip-row-items">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`chip${value === o.value ? ' is-active' : ''}`} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ImageEditDialog(props: { imageUrl: string; shape: Shape; size: Size; crop: CropArea | null; onApply: (e: ImageEdit) => void; onClose: () => void }) {
  const [shape, setShape] = useState<Shape>(props.shape);
  const [size, setSize] = useState<Size>(props.size);
  // The owner's own size choice wins over the size a shape suggests.
  const [sizeChosen, setSizeChosen] = useState(props.size !== 'full');
  const base = shape === 'rect-portrait' ? 'rect' : shape;

  const pickShape = (s: (typeof SHAPE_CHIPS)[number]['value']) => {
    setShape(s === 'rect' && shape === 'rect-portrait' ? 'rect-portrait' : s);
    if (!sizeChosen) setSize(s === 'circle' || s === 'square' ? 'md' : 'full');
  };

  return (
    <CropDialog
      title="Görseli düzenle"
      imageUrl={props.imageUrl}
      aspect={ASPECT[shape]}
      shape={shape === 'circle' ? 'circle' : shape === 'pill' ? 'pill' : null}
      initial={shape === props.shape ? props.crop : null}
      onApply={(area) => props.onApply({ shape, size, area })}
      onClose={props.onClose}
    >
      <Chips label="Şekil" options={SHAPE_CHIPS} value={base} onChange={pickShape} />
      {base === 'rect' && (
        <Chips
          label="Yön"
          options={[
            { value: 'rect', label: 'Yatay' },
            { value: 'rect-portrait', label: 'Dikey' },
          ]}
          value={shape as 'rect' | 'rect-portrait'}
          onChange={setShape}
        />
      )}
      <Chips
        label="Boyut"
        options={SIZE_CHIPS}
        value={size}
        onChange={(s) => {
          setSize(s);
          setSizeChosen(true);
        }}
      />
    </CropDialog>
  );
}
