/** The citation settings shared by "Referans ekle" and "Atıfı düzenle": page and format. */
import { useId } from 'react';
import { citationText, type LocatorKind, type Reference } from '../../../lib/apa';
import type { Lang } from '../../../lib/schemas';
import { LOCATOR_OPTIONS } from './referenceModel';

export type LocatorInput = { page: string; kind: LocatorKind };

export function LocatorFields({ value, onChange, label = 'Sayfa (isteğe bağlı)' }: { value: LocatorInput; onChange: (v: LocatorInput) => void; label?: string }) {
  const id = useId();
  return (
    <div className="k-field cite-locator">
      <label htmlFor={id}>{label}</label>
      <div className="row">
        <input id={id} className="k-input" value={value.page} placeholder="Örneğin 34" onChange={(e) => onChange({ ...value, page: e.target.value })} />
        <select className="k-input" aria-label="Konum türü" value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as LocatorKind })}>
          {LOCATOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function sample(ref: Reference | null, narrative: boolean, lang: Lang): string {
  if (!ref) return narrative ? 'Yazar (yıl)' : '(Yazar, yıl)';
  try {
    return citationText({ items: [{ id: ref.id }], narrative }, [ref], lang);
  } catch {
    return narrative ? 'Yazar (yıl)' : '(Yazar, yıl)';
  }
}

/** "Biçim": parenthetical or narrative, each option showing how the reference will read. */
export function FormatSelect({ narrative, onChange, reference, lang }: { narrative: boolean; onChange: (narrative: boolean) => void; reference: Reference | null; lang: Lang }) {
  const id = useId();
  return (
    <div className="k-field">
      <label htmlFor={id}>Biçim</label>
      <select id={id} className="k-input" value={narrative ? 'narrative' : 'parenthetical'} onChange={(e) => onChange(e.target.value === 'narrative')}>
        <option value="parenthetical">{sample(reference, false, lang)}</option>
        <option value="narrative">{sample(reference, true, lang)}</option>
      </select>
    </div>
  );
}
