/**
 * Hakkımda: texts, working areas, the Markdown sections, the timeline and the certificates. Owner's
 * review 2026-10-21: the long texts open in their own window; the lists are rows that open a window.
 */
import { parseAbout, type About, type Period } from '../../../../lib/schemas';
import { ICONS } from '../../../../lib/icons';
import { Field, Select } from '../../kit';
import { LocalizedField, SettingsForm } from '../fields';
import { MarkdownBlock, RowList, SiteIcon } from '../rows';
import { useSettingsFile } from '../useSettingsFile';
import { IconSelect } from './lists';

type Area = About['areas'][number];
type Step = About['timeline'][number];
type Cert = About['certificates'][number];
const ICON_OPTIONS = Object.keys(ICONS).map((k) => ({ value: k, label: k }));

function PeriodField({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const localized = typeof value !== 'string';
  return (
    <>
      <Select
        label="Dönem biçimi"
        value={localized ? 'localized' : 'single'}
        options={[
          { value: 'single', label: 'Tek metin (ör. 2016–2020)' },
          { value: 'localized', label: 'TR/EN ayrı (ör. Devam ediyor / Ongoing)' },
        ]}
        onChange={(mode) => {
          if (mode === 'localized' && !localized) onChange({ tr: value, en: value });
          if (mode === 'single' && localized) onChange(value.tr);
        }}
      />
      {localized ? (
        <LocalizedField label="Dönem" value={value} onChange={onChange} />
      ) : (
        <Field label="Dönem" value={value} onChange={onChange} />
      )}
    </>
  );
}

export function HakkimdaScreen() {
  const file = useSettingsFile<About>('src/data/about.json', parseAbout, 'Hakkımda');
  const set = <K extends keyof About>(k: K) => (v: About[K]) => file.setValue((a) => ({ ...a, [k]: v }));
  return (
    <SettingsForm title="Hakkımda" screen="hakkimda" file={file}>
      {(a) => (
        <>
          <LocalizedField label="Sayfa başlığı" value={a.heading} onChange={set('heading')} issues={file.issues} path="heading" />
          <LocalizedField label="Giriş cümlesi" value={a.lead} onChange={set('lead')} multiline issues={file.issues} path="lead" />
          <h3>Çalışma alanları</h3>
          <RowList<Area>
            items={a.areas}
            onChange={set('areas')}
            noun="alan"
            title={(x) => x.label.tr || 'Yeni alan'}
            subtitle={(x) => x.label.en}
            icon={(x) => (
              <span className="tone-tile tone-adacayi" aria-hidden="true">
                <SiteIcon name={x.icon} size={18} />
              </span>
            )}
            newItem={() => ({ icon: 'leaf', label: { tr: '', en: '' } })}
            addLabel="Alan ekle"
            render={(x, update) => (
              <>
                <IconSelect value={x.icon} options={ICON_OPTIONS} onChange={(icon) => update({ icon })} />
                <LocalizedField label="Alan" value={x.label} onChange={(label) => update({ label })} />
              </>
            )}
          />
          <h3>Ben kimim?</h3>
          <MarkdownBlock label="Ben kimim" value={a.whoAmI} onChange={set('whoAmI')} />
          <h3>Neden bu işi yapıyorum?</h3>
          <MarkdownBlock label="Neden bu iş" value={a.whyThisWork} onChange={set('whyThisWork')} />
          <LocalizedField label="Alıntı" value={a.quote} onChange={set('quote')} multiline issues={file.issues} path="quote" />
          <h3>klinikterapist nedir?</h3>
          <MarkdownBlock label="Marka hikâyesi" value={a.brand} onChange={set('brand')} />
          <h3>Eğitim ve mesleki gelişim</h3>
          <RowList<Step>
            items={a.timeline}
            onChange={set('timeline')}
            noun="adım"
            title={(x) => x.title.tr || 'Yeni adım'}
            subtitle={(x) => x.detail.tr}
            marks={(x) => <span className="tone-chip tone-lavanta">{typeof x.period === 'string' ? x.period || 'Dönem yok' : x.period.tr}</span>}
            newItem={() => ({ title: { tr: '', en: '' }, detail: { tr: '', en: '' }, period: '' })}
            addLabel="Adım ekle"
            render={(x, update) => (
              <>
                <LocalizedField label="Başlık" value={x.title} onChange={(title) => update({ title })} />
                <LocalizedField label="Ayrıntı" value={x.detail} onChange={(detail) => update({ detail })} />
                <PeriodField value={x.period} onChange={(period) => update({ period })} />
              </>
            )}
          />
          <h3>Sertifikalarım</h3>
          <RowList<Cert>
            items={a.certificates}
            onChange={set('certificates')}
            noun="sertifika"
            title={(x) => x.title.tr || 'Yeni sertifika'}
            subtitle={(x) => [x.issuer, x.year].filter(Boolean).join(' · ')}
            icon={() => (
              <span className="tone-tile tone-gunes" aria-hidden="true">
                <SiteIcon name="award" size={18} />
              </span>
            )}
            newItem={() => ({ title: { tr: '', en: '' }, issuer: '', year: '', url: '' })}
            addLabel="Sertifika ekle"
            render={(x, update) => (
              <>
                <LocalizedField label="Sertifika / eğitim adı" value={x.title} onChange={(title) => update({ title })} />
                <Field label="Veren kurum" value={x.issuer} onChange={(issuer) => update({ issuer })} />
                <Field label="Yıl" value={x.year} onChange={(year) => update({ year })} />
                <Field label="Belge bağlantısı (isteğe bağlı, https://…)" value={x.url ?? ''} onChange={(url) => update({ url })} />
              </>
            )}
          />
        </>
      )}
    </SettingsForm>
  );
}
