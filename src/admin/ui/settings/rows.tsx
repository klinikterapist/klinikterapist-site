/**
 * Calmer settings pieces (owner's review 2026-10-21, "Düzeltmeler" 1, 5–7):
 * - TextBlock: a longer text shows as a short preview; "Metni düzenle" opens it in its own window,
 *   Turkish and English side by side, with a word count. "Tamam" keeps the change, "Vazgeç" drops it.
 * - RowList: a list as tidy rows (icon, name, a line under it, small marks, a chevron); a row opens
 *   its fields in a window, where it can also be moved or deleted. "Ekle" opens a new one the same way.
 * Changes reach the site only with the screen's Kaydet, as before.
 */
import { useState, type ReactNode } from 'react';
import type { Localized } from '../../../lib/schemas';
import { ICONS, type IconName } from '../../../lib/icons';
import { Button, Dialog, Field } from '../kit';
import { MarkdownField } from './fields';
import { ArrowDown, ArrowUp, ChevronRight, Icon, PencilLine, Plus, Trash2 } from '../icons';
import type { Issues } from './useSettingsFile';

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** One of the site's own icons (the ones the visitors see), drawn the same way here. */
export function SiteIcon({ name, size = 20 }: { name: string; size?: number }) {
  const n = (name in ICONS ? name : 'leaf') as IconName;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[n] }}
    />
  );
}

export function TextBlock(props: { label: string; value: Localized; onChange: (v: Localized) => void; hint?: string; issues?: Issues; path?: string; rows?: number }) {
  const [draft, setDraft] = useState<Localized | null>(null);
  const err = (lang: 'tr' | 'en') => (props.path ? (props.issues?.[`${props.path}.${lang}`] ?? props.issues?.[props.path]) : undefined);
  const error = err('tr') ?? err('en');
  const tr = props.value.tr.trim();
  const en = props.value.en.trim();
  return (
    <div className={`text-block${error ? ' has-error' : ''}`}>
      <div className="text-block-head">
        <span className="k-label">{props.label}</span>
        <span className="text-block-langs">
          <span className={tr ? 'is-set' : ''}>TR</span>
          <span className={en ? 'is-set' : ''}>EN</span>
        </span>
      </div>
      <button type="button" className="text-block-preview" onClick={() => setDraft({ ...props.value })} aria-label={`${props.label}: metni düzenle`}>
        <span className="text-block-text">{tr || <em>Henüz yazılmadı.</em>}</span>
        <span className="text-block-edit">
          <Icon as={PencilLine} size={15} />
          Metni düzenle
        </span>
      </button>
      {props.hint && <p className="k-hint">{props.hint}</p>}
      {error && <p className="k-error">{error}</p>}
      {draft && (
        <Dialog
          title={props.label}
          onClose={() => setDraft(null)}
          actions={
            <>
              <Button onClick={() => setDraft(null)}>Vazgeç</Button>
              <Button
                variant="primary"
                onClick={() => {
                  props.onChange(draft);
                  setDraft(null);
                }}
              >
                Tamam
              </Button>
            </>
          }
        >
          <div className="text-dialog">
            <Field label="Türkçe" value={draft.tr} onChange={(v) => setDraft({ ...draft, tr: v })} multiline rows={props.rows ?? 10} lang="tr" hint={`${words(draft.tr)} kelime`} />
            <Field label="İngilizce" value={draft.en} onChange={(v) => setDraft({ ...draft, en: v })} multiline rows={props.rows ?? 10} lang="en" hint={`${words(draft.en)} kelime`} />
          </div>
        </Dialog>
      )}
    </div>
  );
}

export function RowList<T>(props: {
  items: T[];
  onChange: (items: T[]) => void;
  /** Name of the row (and of its window). */
  title: (item: T) => string;
  subtitle?: (item: T) => ReactNode;
  icon?: (item: T) => ReactNode;
  /** Small marks on the right (e.g. "Ana sayfada"). */
  marks?: (item: T) => ReactNode;
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  newItem?: () => T;
  addLabel?: string;
  /** What the list is called, for the empty state. */
  noun?: string;
  canDelete?: (item: T) => string | true;
  /** Rows to show (a filter); hidden rows keep their place in the list. */
  visible?: (item: T) => boolean;
  /** Numbers the rows (1., 2., …) in the order the site shows them. */
  numbered?: boolean;
  /** Cards in a grid instead of rows (Kaynaklar). */
  cards?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [fresh, setFresh] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const update = (i: number) => (patch: Partial<T>) => props.onChange(props.items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const moveTo = (from: number, to: number) => {
    const next = [...props.items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    props.onChange(next);
    setOpen(to);
  };
  const close = () => {
    setOpen(null);
    setFresh(false);
    setDeleting(false);
  };
  const item = open !== null ? props.items[open] : undefined;
  const can = item !== undefined && props.canDelete ? props.canDelete(item) : true;

  return (
    <div className={`row-list${props.cards ? ' row-list-cards' : ''}`}>
      {props.items.filter((it) => !props.visible || props.visible(it)).length === 0 ? (
        <p className="row-list-empty">{`Henüz ${props.noun ?? 'öğe'} yok.`}</p>
      ) : (
        <ul>
          {props.items.map((it, i) =>
            props.visible && !props.visible(it) ? null : (
            <li key={i}>
              <button type="button" className="row-list-row" onClick={() => setOpen(i)}>
                {props.numbered && <span className="row-list-n">{i + 1}</span>}
                {props.icon && <span className="row-list-icon">{props.icon(it)}</span>}
                <span className="row-list-text">
                  <b>{props.title(it)}</b>
                  {props.subtitle && <span>{props.subtitle(it)}</span>}
                </span>
                {props.marks && <span className="row-list-marks">{props.marks(it)}</span>}
                <Icon as={ChevronRight} size={18} />
              </button>
            </li>
            ),
          )}
        </ul>
      )}
      {props.newItem && (
        <Button
          className="row-list-add"
          onClick={() => {
            props.onChange([...props.items, props.newItem!()]);
            setFresh(true);
            setOpen(props.items.length);
          }}
        >
          <Icon as={Plus} size={16} />
          {props.addLabel ?? 'Ekle'}
        </Button>
      )}
      {open !== null && item !== undefined && (
        <Dialog
          title={props.title(item)}
          onClose={() => {
            // A new row closed with nothing in it goes away again.
            if (fresh && !props.title(item).trim()) props.onChange(props.items.filter((_, j) => j !== open));
            close();
          }}
          actions={
            deleting ? (
              <>
                <Button onClick={() => setDeleting(false)}>Vazgeç</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    props.onChange(props.items.filter((_, j) => j !== open));
                    close();
                  }}
                >
                  Evet, sil
                </Button>
              </>
            ) : (
              <>
                <span className="row-list-tools">
                  <Button variant="ghost" aria-label="Yukarı taşı" disabled={open === 0} onClick={() => moveTo(open, open - 1)}>
                    <Icon as={ArrowUp} size={16} />
                  </Button>
                  <Button variant="ghost" aria-label="Aşağı taşı" disabled={open === props.items.length - 1} onClick={() => moveTo(open, open + 1)}>
                    <Icon as={ArrowDown} size={16} />
                  </Button>
                  <Button variant="ghost" className="row-list-delete" disabled={can !== true} title={can === true ? undefined : can} onClick={() => setDeleting(true)}>
                    <Icon as={Trash2} size={16} />
                    Sil
                  </Button>
                </span>
                <Button variant="primary" onClick={close}>
                  Tamam
                </Button>
              </>
            )
          }
        >
          {deleting ? (
            <p>{`“${props.title(item) || 'Bu satır'}” listeden çıkarılacak. Kaydet'e basana kadar sitede değişiklik olmaz.`}</p>
          ) : (
            <div className="row-list-form">{props.render(item, update(open), open)}</div>
          )}
        </Dialog>
      )}
    </div>
  );
}

/** A Markdown section (Hakkımda): a preview of the Turkish text; the window has both languages with Önizle. */
export function MarkdownBlock(props: { label: string; value: Localized; onChange: (v: Localized) => void }) {
  const [draft, setDraft] = useState<Localized | null>(null);
  const tr = props.value.tr.trim();
  return (
    <div className="text-block">
      <div className="text-block-head">
        <span className="k-label">{props.label}</span>
        <span className="text-block-langs">
          <span className={tr ? 'is-set' : ''}>TR</span>
          <span className={props.value.en.trim() ? 'is-set' : ''}>EN</span>
        </span>
      </div>
      <button type="button" className="text-block-preview" onClick={() => setDraft({ ...props.value })} aria-label={`${props.label}: metni düzenle`}>
        <span className="text-block-text">{tr ? tr.replace(/[#*_>`]/g, '') : <em>Henüz yazılmadı.</em>}</span>
        <span className="text-block-edit">
          <Icon as={PencilLine} size={15} />
          Metni düzenle
        </span>
      </button>
      {draft && (
        <Dialog
          title={props.label}
          onClose={() => setDraft(null)}
          actions={
            <>
              <Button onClick={() => setDraft(null)}>Vazgeç</Button>
              <Button
                variant="primary"
                onClick={() => {
                  props.onChange(draft);
                  setDraft(null);
                }}
              >
                Tamam
              </Button>
            </>
          }
        >
          <div className="text-dialog">
            <MarkdownField label="Türkçe" lang="tr" rows={14} value={draft.tr} onChange={(v) => setDraft({ ...draft, tr: v })} />
            <MarkdownField label="İngilizce" lang="en" rows={14} value={draft.en} onChange={(v) => setDraft({ ...draft, en: v })} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
