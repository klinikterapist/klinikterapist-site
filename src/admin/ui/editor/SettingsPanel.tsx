/**
 * Ayarlar panel: publish status and the settings shared by both languages (category, date, cover).
 * The publish checklist has its own panel.
 */
import type { Draft, LangFields } from '../../api/types';
import type { Category, Lang } from '../../../lib/schemas';
import { LANG_LABEL, PLAN_HINT, PLAN_TIMES, formatSchedule, istanbulIso } from '../../lib/draft';
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
  /** Time of day for a planned publish (`HH:MM`, Istanbul); empty = publish at once. */
  planTime?: string;
  onPlanTime?: (time: string) => void;
  /** The date and time are in the future: Yayınla plans the post. */
  planning?: boolean;
  onCancelPlan?: () => void;
}) {
  const { draft, categories, images } = props;
  // The same actions as the cover block under the subtitle.
  const cover = useCover({ draft, images, coverVersion: props.coverVersion, onShared: props.onShared, onCoverUploaded: props.onCoverUploaded, onError: props.onError });

  return (
    <div className="rail-panel-body">
      <div className="rail-panel-head">
        <h3>Ayarlar</h3>
        {draft.scheduledAt ? (
          <p className="badge badge-planned">Planlandı</p>
        ) : draft.published ? (
          <p className="badge badge-live">Yayında</p>
        ) : (
          <p className="badge">Taslak</p>
        )}
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
          hint={props.planning ? 'Yazıda görünen tarih; yazı bu gün, aşağıdaki saatte yayına girer.' : "Yazıda görünen tarih. Yazı, Yayınla'ya bastığınızda yayınlanır."}
        />
        {props.onPlanTime && (
          <div>
            <Select
              label="Yayın saati (isteğe bağlı)"
              field="planTime"
              value={props.planTime ?? ''}
              options={[
                { value: '', label: 'Saat seçme: Yayınla’ya basınca yayınlansın' },
                // A plan made with an older, free time still shows as it is.
                ...(props.planTime && !PLAN_TIMES.some((t) => t.value === props.planTime) ? [{ value: props.planTime, label: props.planTime.replace(':', '.') }] : []),
                ...PLAN_TIMES,
              ]}
              onChange={props.onPlanTime}
            />
            <p className="k-hint">{props.planning ? PLAN_HINT : 'İleri bir gün ve saat seçerseniz Yayınla düğmesi Planla olur.'}</p>
          </div>
        )}
        {draft.scheduledAt && (
          <div className="plan-box" role="status">
            <p>
              <b>Planlandı:</b> {formatSchedule(draft.scheduledAt)}
            </p>
            {props.planTime && istanbulIso(draft.publishedAt, props.planTime) !== draft.scheduledAt && (
              <p className="k-hint">Yeni gün ya da saati kaydetmek için Planla'ya basın.</p>
            )}
            <Button variant="ghost" onClick={props.onCancelPlan}>
              Planlamayı iptal et
            </Button>
          </div>
        )}
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
