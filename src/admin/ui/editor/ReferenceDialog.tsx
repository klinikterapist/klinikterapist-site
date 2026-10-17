/**
 * "Referans ekle": cite a saved reference or add a new one (DOI lookup or by hand), with a live
 * APA preview and the citation settings. Also used alone to edit one reference.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { bibliography, formatReferenceHtml, makeRefId, type LocatorKind, type Reference } from '../../../lib/apa';
import type { Lang } from '../../../lib/schemas';
import { DoiError, cslToReference, fetchCsl, parseDoi, sameDoi } from '../../lib/doi';
import { Banner, Button, Dialog, Field } from '../kit';
import { canRemoveReference, citedIdsInDoc } from './Citation';
import { FormatSelect, LocatorFields, type LocatorInput } from './CiteSettings';
import { ReferenceForm } from './ReferenceForm';
import { emptyForm, formFromReference, locatorError, parseLocator, referenceFromForm, type RefForm } from './referenceModel';

export type InsertRequest = { ref: Reference; isNew: boolean; locator?: { kind: LocatorKind; value: string }; narrative: boolean };

const TITLE_CASE_WARNING = 'Başlığın büyük/küçük harflerini kontrol edin.';
const NOT_A_DOI = 'Bu bir DOI gibi görünmüyor. DOI "10." ile başlar, örneğin 10.1037/0003-066X.59.1.29.';
const ALREADY_SAVED = 'Bu referans zaten kayıtlı.';
const duplicateText = 'Bu DOI ile bir referans zaten kayıtlı. “Kayıtlı referanslar” sekmesinden seçin.';
const unsupportedText = (type: string) => `Bu kaynak türü (${type}) otomatik biçimlendirilemiyor. Uygun türü seçip alanları kontrol edin.`;

/**
 * One reference as APA HTML, with the 2004a/2004b letters the site would give it: counted over
 * the references cited in the doc plus this one (R8).
 */
function referenceHtml(ref: Reference, references: Reference[], doc: JSONContent, lang: Lang): string {
  const all = [...references.filter((r) => r.id !== ref.id), ref];
  const cited = citedIdsInDoc(doc).add(ref.id);
  return formatReferenceHtml(ref, bibliography(all, cited, lang), lang);
}

function Preview({ reference: ref, references, doc, lang }: { reference: Reference | null; references: Reference[]; doc: JSONContent; lang: Lang }) {
  const id = useId();
  return (
    <div className="ref-preview">
      <p className="ref-preview-title" id={id}>
        Önizleme (APA 7)
      </p>
      {ref ? (
        <section aria-labelledby={id} dangerouslySetInnerHTML={{ __html: referenceHtml(ref, references, doc, lang) }} />
      ) : (
        <section aria-labelledby={id} className="k-hint">
          Tür, yıl ve başlık girilince künye burada görünür.
        </section>
      )}
    </div>
  );
}

/** Edit-only form for one saved reference. */
function EditPane(props: { initial: Reference; references: Reference[]; doc: JSONContent; lang: Lang; onSave: (ref: Reference) => void; onCancel: () => void; dialogTitle: string; onClose: () => void }) {
  const [form, setForm] = useState<RefForm>(() => formFromReference(props.initial));
  const ref = referenceFromForm(form, props.initial.id);
  return (
    <Dialog
      title={props.dialogTitle}
      onClose={props.onClose}
      actions={
        <>
          <Button onClick={props.onCancel}>Vazgeç</Button>
          <Button variant="primary" disabled={!ref} onClick={() => ref && props.onSave(ref)}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="ref-dialog">
        <ReferenceForm form={form} onChange={setForm} />
        <Preview reference={ref} references={props.references} doc={props.doc} lang={props.lang} />
      </div>
    </Dialog>
  );
}

export function ReferenceDialog(props: {
  lang: Lang;
  references: Reference[];
  doc: JSONContent;
  /** The cursor is on this citation: the reference joins it. */
  joining: { narrative: boolean } | null;
  fetchFn?: typeof fetch;
  onClose: () => void;
  onInsert: (r: InsertRequest) => void;
  onSave: (ref: Reference) => void;
  onDelete: (id: string) => void;
}) {
  const { lang, references, onClose } = props;
  const [tab, setTab] = useState<'saved' | 'new'>(references.length ? 'saved' : 'new');
  const [editing, setEditing] = useState<Reference | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [doiInput, setDoiInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [form, setForm] = useState<RefForm | null>(null);
  const [fromDoi, setFromDoi] = useState(false);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [locator, setLocator] = useState<LocatorInput>({ page: '', kind: 'p' });
  const [narrative, setNarrative] = useState(props.joining?.narrative ?? false);
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(true);
  const tabsId = useId();
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  if (editing) {
    return (
      <EditPane
        initial={editing}
        references={references}
        doc={props.doc}
        lang={lang}
        dialogTitle="Referansı düzenle"
        onClose={onClose}
        onCancel={() => setEditing(null)}
        onSave={(ref) => {
          props.onSave(ref);
          setEditing(null);
        }}
      />
    );
  }

  const taken = new Set(references.map((r) => r.id));
  const draftRef = form ? referenceFromForm(form) : null;
  const newRef = draftRef ? { ...draftRef, id: makeRefId(draftRef, taken) } : null;
  const savedRef = references.find((r) => r.id === selected) ?? null;
  // A new reference must not repeat a saved one's DOI (it would become ray2004-2 next to ray2004).
  const duplicate = newRef?.doi ? (references.find((r) => sameDoi(r.doi, newRef.doi)) ?? null) : null;
  const chosen = tab === 'saved' ? savedRef : duplicate ? null : newRef;

  const lookup = async () => {
    const doi = parseDoi(doiInput);
    setLookupError(null);
    setNotice(null);
    if (!doi) {
      setLookupError(NOT_A_DOI);
      setForm((f) => f ?? emptyForm());
      return;
    }
    const saved = references.find((r) => sameDoi(r.doi, doi));
    if (saved) {
      setSelected(saved.id);
      setTab('saved');
      setNotice(ALREADY_SAVED);
      return;
    }
    // A form filled by an earlier lookup belongs to that DOI; it must not survive a failed one.
    const keep = fromDoi ? null : form;
    setUnsupported(null);
    setFromDoi(false);
    setBusy(true);
    try {
      const { ref, unsupported: u } = cslToReference(await fetchCsl(doi, props.fetchFn ?? window.fetch.bind(window)), taken);
      if (!alive.current) return;
      setForm({ ...formFromReference(ref, u ? '' : ref.type), doi: ref.doi ?? doi });
      setFromDoi(true);
      setUnsupported(u);
    } catch (e) {
      if (!alive.current) return;
      setLookupError(e instanceof DoiError ? e.message : 'Bilgiler okunamadı. Alanları elle doldurun.');
      // A DOI that doi.org does not know is never attached; after a network error it stays in the DOI field.
      const notFound = e instanceof DoiError && e.notFound;
      setForm({ ...(keep ?? emptyForm()), doi: notFound ? (keep && keep.doi !== doi ? keep.doi : '') : doi });
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const insert = () => {
    if (!chosen) return;
    props.onInsert({ ref: chosen, isNew: tab === 'new', locator: parseLocator(locator.page, locator.kind), narrative });
  };

  const tabButton = (value: 'saved' | 'new', label: string) => (
    <button
      type="button"
      role="tab"
      id={`${tabsId}-${value}`}
      aria-selected={tab === value}
      aria-controls={`${tabsId}-panel`}
      className={`ref-tab ${tab === value ? 'is-active' : ''}`}
      onClick={() => {
        setTab(value);
        setNotice(null);
      }}
    >
      {label}
    </button>
  );

  return (
    <Dialog
      title="Referans ekle"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" disabled={!chosen || busy || !!locatorError(locator.page)} onClick={insert}>
            Ekle
          </Button>
        </>
      }
    >
      <div className="ref-dialog">
        <div className="ref-tabs" role="tablist" aria-label="Referans">
          {tabButton('saved', `Kayıtlı referanslar (${references.length})`)}
          {tabButton('new', 'Yeni referans')}
        </div>

        <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`} className="ref-panel">
          {tab === 'saved' && notice && <Banner>{notice}</Banner>}
          {tab === 'saved' ? (
            references.length ? (
              <ul className="ref-saved" role="radiogroup" aria-label="Kayıtlı referanslar">
                {references.map((r) => {
                  const removable = canRemoveReference(props.doc, r.id);
                  return (
                    <li key={r.id} className={selected === r.id ? 'is-selected' : ''}>
                      <label className="ref-saved-choice">
                        <input type="radio" name={`${tabsId}-saved`} checked={selected === r.id} onChange={() => setSelected(r.id)} />
                        <span dangerouslySetInnerHTML={{ __html: referenceHtml(r, references, props.doc, lang) }} />
                      </label>
                      <span className="ref-saved-tools">
                        <Button variant="ghost" onClick={() => setEditing(r)}>
                          Düzenle
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={!removable}
                          onClick={() => {
                            if (selected === r.id) setSelected(null);
                            props.onDelete(r.id);
                          }}
                        >
                          Sil
                        </Button>
                        {!removable && <span className="k-hint">Bu referans metinde kullanılıyor.</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="k-hint">Bu yazıda henüz kayıtlı referans yok. “Yeni referans” sekmesinden ekleyin.</p>
            )
          ) : (
            <>
              <div className="ref-doi">
                <Field
                  label="DOI ya da doi.org bağlantısı"
                  value={doiInput}
                  onChange={setDoiInput}
                  placeholder="10.1037/… ya da https://doi.org/10.1037/…"
                />
                <Button busy={busy} onClick={lookup} disabled={!doiInput.trim()}>
                  Bul
                </Button>
              </div>
              {lookupError && <Banner tone="error">{lookupError}</Banner>}
              {form ? (
                <>
                  {unsupported && <Banner tone="warning">{unsupportedText(unsupported)}</Banner>}
                  {fromDoi && <Banner tone="warning">{TITLE_CASE_WARNING}</Banner>}
                  <ReferenceForm form={form} onChange={setForm} />
                  {duplicate && <Banner tone="error">{duplicateText}</Banner>}
                  <Preview reference={newRef} references={references} doc={props.doc} lang={lang} />
                </>
              ) : (
                <Button variant="ghost" onClick={() => setForm(emptyForm())}>
                  DOI yok, elle doldur
                </Button>
              )}
            </>
          )}
        </div>

        <div className="ref-cite">
          {props.joining && <p className="k-hint">Referans, imlecin üzerindeki atıfa eklenecek.</p>}
          <LocatorFields value={locator} onChange={setLocator} />
          <FormatSelect narrative={narrative} onChange={setNarrative} reference={chosen} lang={lang} />
        </div>
      </div>
    </Dialog>
  );
}

export { EditPane as ReferenceEditDialog };
