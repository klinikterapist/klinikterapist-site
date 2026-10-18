/**
 * Ayarlar panel: publish status, the shared settings (category, date, cover; one for both languages)
 * and the publish checklist (spec §5.4.1).
 */
import { useEffect, useRef, useState } from 'react';
import type { Draft } from '../../api/types';
import type { Category } from '../../../lib/schemas';
import type { ChecklistItem } from '../../lib/checklist';
import { IMAGE_PRESETS, ImageError, resizeImage } from '../../lib/image';
import { Button, Field, Select } from '../kit';
import type { ImageStore } from './images';

export type SharedPatch = Partial<Pick<Draft, 'category' | 'cover' | 'publishedAt'>>;

function Checklist({ items, flagMissing, onGo }: { items: ChecklistItem[]; flagMissing: boolean; onGo: (item: ChecklistItem) => void }) {
  const required = items.filter((i) => i.required);
  const recommended = items.filter((i) => !i.required);
  const row = (i: ChecklistItem) => (
    <li key={i.id} data-done={i.done} className={`checklist-item ${i.done ? 'is-done' : ''} ${flagMissing && i.required && !i.done ? 'is-flagged' : ''}`}>
      <button type="button" onClick={() => onGo(i)}>
        <span className="checklist-mark" aria-hidden="true">
          {i.done ? '✓' : '○'}
        </span>
        <span>{i.label}</span>
        <span className="k-visually-hidden">{i.done ? ' (tamam)' : ' (eksik)'}</span>
      </button>
    </li>
  );
  return (
    <div className="checklist" data-field="checklist">
      <h4>Yayın kontrol listesi</h4>
      <ul aria-label="Yayın kontrol listesi">
        <li className="checklist-group">Zorunlu</li>
        {required.map(row)}
        <li className="checklist-group">Önerilen (yayını engellemez)</li>
        {recommended.map(row)}
      </ul>
    </div>
  );
}

export function SettingsPanel(props: {
  draft: Draft;
  categories: Category[];
  images: ImageStore;
  /** Bumped after a new cover upload so the preview reloads. */
  coverVersion: number;
  onShared: (patch: SharedPatch) => void;
  onCoverUploaded: () => void;
  onError: (message: string | null) => void;
  checklist: ChecklistItem[];
  /** After Yayınla was pressed with something missing: the missing required items stand out. */
  flagMissing: boolean;
  onGo: (item: ChecklistItem) => void;
}) {
  const { draft, categories, images } = props;
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (draft.cover) images.url(draft.cover).then((u) => alive && setCover(u));
    else setCover(null);
    return () => {
      alive = false;
    };
  }, [draft.cover, images, props.coverVersion]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    props.onError(null);
    try {
      const img = await resizeImage(file, IMAGE_PRESETS.cover);
      const name = `cover.${img.ext}`;
      await images.add(name, img.base64);
      props.onShared({ cover: name });
      props.onCoverUploaded();
    } catch (e) {
      props.onError(e instanceof ImageError ? e.message : 'Kapak görseli yüklenemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="rail-panel-body">
      <div className="rail-panel-head">
        <h3>Ayarlar</h3>
        {draft.published ? <p className="badge badge-live">Yayında</p> : <p className="badge">Taslak</p>}
      </div>
      <p className="k-hint">Bu ayarlar iki dil için ortaktır.</p>
      <div className="stack">
        <Select
          label="Kategori"
          field="category"
          value={draft.category}
          options={[{ value: '', label: 'Kategori seçin…' }, ...categories.map((c) => ({ value: c.id, label: c.label.tr }))]}
          onChange={(category) => props.onShared({ category })}
        />
        <Field
          label="Yayın tarihi"
          field="publishedAt"
          type="date"
          value={draft.publishedAt}
          onChange={(publishedAt) => publishedAt && props.onShared({ publishedAt })}
          hint="Yazıda görünen tarih. Yazı, Yayınla'ya bastığınızda yayınlanır."
        />
        <div className="k-field">
          <span className="k-label">Kapak görseli</span>
          {cover && <img className="cover-preview" src={cover} alt="" />}
          <div className="row">
            <Button busy={busy} data-field="cover" onClick={() => input.current?.click()}>
              {draft.cover ? 'Kapağı değiştir' : 'Kapak görseli ekle'}
            </Button>
            {draft.cover && (
              <Button variant="ghost" onClick={() => props.onShared({ cover: null })}>
                Kapağı kaldır
              </Button>
            )}
          </div>
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      </div>
      <Checklist items={props.checklist} flagMissing={props.flagMissing} onGo={props.onGo} />
    </div>
  );
}
