/** Sık sorulan sorular: question and answer pairs, in the order they appear on the site. */
import { parseFaq, type Faq, type FaqItem } from '../../../../lib/schemas';
import { ListEditor, LocalizedField, SettingsForm } from '../fields';
import { useSettingsFile } from '../useSettingsFile';

const newId = () => `soru-${Date.now().toString(36)}`;

export function SssScreen() {
  const file = useSettingsFile<Faq>('src/data/faq.json', parseFaq, 'Sık sorulan sorular');
  return (
    <SettingsForm title="Sık sorulan sorular" screen="sss" file={file}>
      {(faq) => (
        <>
          <p className="k-hint">Bir soru, cevabı bir dilde boşsa o dilde sitede görünmez.</p>
          <ListEditor<FaqItem>
            items={faq}
            onChange={(next) => file.setValue(() => next)}
            itemLabel={(f) => f.q.tr || 'Yeni soru'}
            newItem={() => ({ id: newId(), q: { tr: '', en: '' }, a: { tr: '', en: '' } })}
            addLabel="Soru ekle"
            render={(f, update, i) => (
              <>
                <LocalizedField label="Soru" value={f.q} onChange={(q) => update({ q })} issues={file.issues} path={`${i}.q`} />
                <LocalizedField label="Cevap" value={f.a} onChange={(a) => update({ a })} multiline rows={4} issues={file.issues} path={`${i}.a`} />
              </>
            )}
          />
        </>
      )}
    </SettingsForm>
  );
}
