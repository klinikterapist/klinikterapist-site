/**
 * Ayarlar panel: publish status and the settings shared by both languages (category, date, cover).
 * The publish checklist has its own panel.
 */
import type { Draft, LangFields } from '../../api/types';
import type { Category, Lang } from '../../../lib/schemas';
import { LANG_LABEL } from '../../lib/draft';
import { HELP } from '../../lib/help-texts';
import { Button, Field, Select, Toggle } from '../kit';
import type { ImageStore } from './images';
import { useCover } from './CoverBlock';

export type SharedPatch = Partial<Pick<Draft, 'category' | 'cover' | 'coverOriginal' | 'coverCrop' | 'publishedAt' | 'featured'>>;

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
  // The same actions as the cover block under the subtitle.
  const cover = useCover({ draft, images, coverVersion: props.coverVersion, onShared: props.onShared, onCoverUploaded: props.onCoverUploaded, onError: props.onError });

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
        <Toggle label="Öne çıkan yazı" checked={!!draft.featured} onChange={(featured) => props.onShared({ featured: featured || undefined })} />
        <div className="k-field">
          <span className="k-label">Kapak görseli</span>
          {cover.url && <img className="cover-preview" src={cover.url} alt="" />}
          <div className="row">
            {draft.cover && (
              <Button disabled={cover.busy} onClick={cover.adjust}>
                Kapağı ayarla
              </Button>
            )}
            <Button busy={cover.busy} data-field="cover" onClick={cover.pick}>
              {draft.cover ? 'Kapağı değiştir' : 'Kapak görseli ekle'}
            </Button>
            {draft.cover && (
              <Button variant="ghost" onClick={cover.remove}>
                Kapağı kaldır
              </Button>
            )}
          </div>
          {cover.elements}
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
