/** The editable reference fields; which ones show depends on the type. */
import { useId } from 'react';
import type { RefType } from '../../../lib/apa';
import { Button, Field, Toggle } from '../kit';
import { TYPE_FIELDS, TYPE_OPTIONS, YEAR_ERROR, doiError, emptyRow, parseYear, type PersonRow, type RefForm } from './referenceModel';

const CONTAINER_LABEL: Record<RefType, string> = { article: 'Dergi adı', book: 'Kitap adı', chapter: 'Kitap adı', web: 'Site adı' };

function People(props: { legend: string; rows: PersonRow[]; noun: string; accusative: string; onChange: (rows: PersonRow[]) => void; keepOne: boolean }) {
  const { rows, onChange } = props;
  const set = (i: number, patch: Partial<PersonRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <fieldset className="ref-people">
      <legend>{props.legend}</legend>
      {rows.map((r, i) => (
        <div className="ref-person" key={i}>
          {r.org ? (
            <Field label="Kurum adı" value={r.literal} onChange={(literal) => set(i, { literal })} className="ref-person-org" />
          ) : (
            <>
              <Field label="Soyadı" value={r.family} onChange={(family) => set(i, { family })} />
              <Field label="Adı" value={r.given} onChange={(given) => set(i, { given })} />
            </>
          )}
          <div className="ref-person-tools">
            <Toggle label="Kurum" checked={r.org} onChange={(org) => set(i, { org })} />
            {(!props.keepOne || rows.length > 1) && (
              <Button variant="ghost" aria-label={`${i + 1}. ${props.accusative} kaldır`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                ×
              </Button>
            )}
          </div>
        </div>
      ))}
      <Button variant="ghost" onClick={() => onChange([...rows, emptyRow()])}>
        {props.noun} ekle
      </Button>
    </fieldset>
  );
}

export function ReferenceForm({ form, onChange }: { form: RefForm; onChange: (form: RefForm) => void }) {
  const typeId = useId();
  const set = (patch: Partial<RefForm>) => onChange({ ...form, ...patch });
  const yearError = form.year.trim() && parseYear(form.year) === null ? YEAR_ERROR : null;
  const shown = new Set(form.type ? TYPE_FIELDS[form.type] : []);
  const text = (key: 'container' | 'volume' | 'issue' | 'pages' | 'edition' | 'publisher' | 'url', label: string, hint?: string) =>
    shown.has(key) && <Field label={label} value={form[key]} hint={hint} onChange={(v) => set({ [key]: v })} />;

  return (
    <div className="ref-form">
      <div className="k-field">
        <label htmlFor={typeId}>Tür</label>
        <select id={typeId} className="k-input" value={form.type} onChange={(e) => set({ type: e.target.value as RefType })}>
          {!form.type && (
            <option value="" disabled>
              Tür seçin…
            </option>
          )}
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <People legend="Yazarlar" noun="Yazar" accusative="yazarı" rows={form.authors} keepOne onChange={(authors) => set({ authors })} />
      <p className="k-hint">Yazarı yoksa satırları boş bırakın; atıfta başlık kullanılır.</p>
      <Field label="Yıl" value={form.year} onChange={(year) => set({ year })} hint="Örneğin 2004; tarih yoksa t.y., yayımlanmamışsa baskıda." error={yearError} />
      <Field label="Başlık" value={form.title} onChange={(title) => set({ title })} />
      {shown.has('editors') && <People legend="Editörler" noun="Editör" accusative="editörü" rows={form.editors} keepOne={false} onChange={(editors) => set({ editors })} />}
      {form.type && text('container', CONTAINER_LABEL[form.type])}
      <div className="ref-row">
        {text('volume', 'Cilt')}
        {text('issue', 'Sayı')}
        {text('pages', 'Sayfalar', form.type === 'chapter' ? 'Bölümün sayfaları, örneğin 10-20' : undefined)}
      </div>
      <div className="ref-row">
        {text('edition', 'Baskı', 'Örneğin 2 (ilk baskıysa boş bırakın)')}
        {text('publisher', 'Yayınevi')}
      </div>
      <Field label="DOI" value={form.doi} onChange={(doi) => set({ doi })} placeholder="10.1037/…" hint="İsteğe bağlı. Varsa künyede doi.org bağlantısı olarak görünür." error={doiError(form.doi)} />
      {text('url', 'Bağlantı (URL)')}
      {shown.has('accessed') && (
        <Field label="Erişim tarihi" type="date" value={form.accessed} onChange={(accessed) => set({ accessed })} hint="Yalnızca içeriği zamanla değişen sayfalarda gerekir." />
      )}
    </div>
  );
}
