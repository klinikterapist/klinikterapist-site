/**
 * Ayarlar panel: publish status and the settings shared by both languages (category, date, cover).
 * The publish checklist has its own panel.
 */
import { useEffect, useRef, useState } from 'react';
import type { Draft, LangFields } from '../../api/types';
import type { Category, Lang } from '../../../lib/schemas';
import { LANG_LABEL } from '../../lib/draft';
import { HELP } from '../../lib/help-texts';
import { IMAGE_PRESETS, ImageError, resizeImage } from '../../lib/image';
import { Button, Field, Select } from '../kit';
import type { ImageStore } from './images';

export type SharedPatch = Partial<Pick<Draft, 'category' | 'cover' | 'publishedAt'>>;

export function SettingsPanel(props: {
  draft: Draft;
  categories: Category[];
  images: ImageStore;
  /** Bumped after a new cover upload so the preview reloads. */
  coverVersion: number;
  onShared: (patch: SharedPatch) => void;
  onCoverUploaded: () => void;
  onError: (message: string | null) => void;
  /** The active language: the cover's alt text is written per language. */
  lang: Lang;
  onLang: (patch: Partial<LangFields>) => void;
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
        {draft.cover && (
          <Field
            label={`Kapak görselinin alt metni (${LANG_LABEL[props.lang]})`}
            field="coverAlt"
            help={HELP.coverAlt}
            value={draft[props.lang].coverAlt}
            onChange={(coverAlt) => props.onLang({ coverAlt })}
            hint="Görselde ne var? Kısa bir cümle."
            lang={props.lang}
          />
        )}
      </div>
    </div>
  );
}
