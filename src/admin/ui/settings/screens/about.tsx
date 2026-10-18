/** Hakkımda: texts, working areas, the two Markdown sections and the timeline. */
import { parseAbout, type About, type Period } from '../../../../lib/schemas';
import { ICONS } from '../../../../lib/icons';
import { Field, Select } from '../../kit';
import { ListEditor, LocalizedField, MarkdownField, SettingsForm } from '../fields';
import { useSettingsFile } from '../useSettingsFile';

type Area = About['areas'][number];
type Step = About['timeline'][number];
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
          <ListEditor<Area>
            items={a.areas}
            onChange={set('areas')}
            itemLabel={(x) => x.label.tr || 'Yeni alan'}
            newItem={() => ({ icon: 'leaf', label: { tr: '', en: '' } })}
            addLabel="Alan ekle"
            render={(x, update) => (
              <>
                <Select label="Simge" value={x.icon} options={ICON_OPTIONS} onChange={(icon) => update({ icon })} />
                <LocalizedField label="Alan" value={x.label} onChange={(label) => update({ label })} />
              </>
            )}
          />
          <h3>Ben kimim?</h3>
          <MarkdownField label="Ben kimim (Türkçe)" lang="tr" value={a.whoAmI.tr} onChange={(tr) => set('whoAmI')({ ...a.whoAmI, tr })} />
          <MarkdownField label="Ben kimim (İngilizce)" lang="en" value={a.whoAmI.en} onChange={(en) => set('whoAmI')({ ...a.whoAmI, en })} />
          <h3>Neden bu işi yapıyorum?</h3>
          <MarkdownField label="Neden bu iş (Türkçe)" lang="tr" value={a.whyThisWork.tr} onChange={(tr) => set('whyThisWork')({ ...a.whyThisWork, tr })} />
          <MarkdownField label="Neden bu iş (İngilizce)" lang="en" value={a.whyThisWork.en} onChange={(en) => set('whyThisWork')({ ...a.whyThisWork, en })} />
          <LocalizedField label="Alıntı" value={a.quote} onChange={set('quote')} multiline issues={file.issues} path="quote" />
          <h3>Eğitim ve mesleki gelişim</h3>
          <ListEditor<Step>
            items={a.timeline}
            onChange={set('timeline')}
            itemLabel={(x) => x.title.tr || 'Yeni adım'}
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
        </>
      )}
    </SettingsForm>
  );
}
