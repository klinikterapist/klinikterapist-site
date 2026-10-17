/** The small menu a citation opens, and the "Atıfı düzenle" dialog (page and format). */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { citationText, type CiteItem, type Reference } from '../../../lib/apa';
import { sanitizeCiteItems } from '../../../lib/citations';
import type { Lang } from '../../../lib/schemas';
import { Button, Dialog } from '../kit';
import type { CitationAttrs } from './Citation';
import { FormatSelect, LocatorFields, type LocatorInput } from './CiteSettings';
import { locatorError, parseLocator } from './referenceModel';

export type MenuAction = { kind: 'locator' } | { kind: 'edit'; id: string } | { kind: 'add' } | { kind: 'remove' };

/** "Ray, 2004" for one item, used to tell the references of a multi-reference citation apart. */
export function shortLabel(id: string, references: Reference[], lang: Lang): string {
  try {
    return citationText({ items: [{ id }], narrative: false }, references, lang).replace(/^\(|\)$/g, '');
  } catch {
    return id;
  }
}

const GAP = 8;

/** Below the citation, or above it near the bottom edge; kept inside the viewport on both sides. */
export function placeMenu(rect: DOMRect, size: { width: number; height: number }, viewport: { width: number; height: number }) {
  const left = Math.max(GAP, Math.min(rect.left, viewport.width - size.width - GAP));
  const below = rect.bottom + 4;
  const top = below + size.height > viewport.height - GAP ? Math.max(GAP, rect.top - size.height - 4) : below;
  return { top, left };
}

export function CitationMenu(props: {
  rect: DOMRect;
  attrs: CitationAttrs;
  references: Reference[];
  lang: Lang;
  onAction: (a: MenuAction) => void;
  onClose: () => void;
}) {
  const { rect, onClose } = props;
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: Event) => !menu.current?.contains(e.target as Node) && onClose();
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('scroll', onClose, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const ids = props.attrs.items.map((i) => i.id);
  const item = (label: string, action: MenuAction) => (
    <button key={label} type="button" role="menuitem" onMouseDown={(e) => e.preventDefault()} onClick={() => props.onAction(action)}>
      {label}
    </button>
  );
  const [pos, setPos] = useState({ top: rect.bottom + 4, left: Math.max(GAP, rect.left) });
  useLayoutEffect(() => {
    const el = menu.current;
    if (el) setPos(placeMenu(rect, { width: el.offsetWidth, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
  }, [rect]);
  return (
    <div ref={menu} className="ed-more-menu ed-cite-menu" role="menu" aria-label="Atıf" style={pos}>
      {item('Sayfayı / biçimi değiştir', { kind: 'locator' })}
      {ids.length === 1
        ? item('Referansı düzenle', { kind: 'edit', id: ids[0] })
        : ids.map((id) => item(`Referansı düzenle: ${shortLabel(id, props.references, props.lang)}`, { kind: 'edit', id }))}
      {item('Bu atıfa referans ekle', { kind: 'add' })}
      {item('Atıfı kaldır', { kind: 'remove' })}
    </div>
  );
}

const toInput = (item: CiteItem): LocatorInput => ({ page: item.locator?.value ?? '', kind: item.locator?.kind ?? 'p' });

export function CitationEditDialog(props: {
  attrs: CitationAttrs;
  references: Reference[];
  lang: Lang;
  onSave: (attrs: CitationAttrs) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState(() => props.attrs.items.map((item) => ({ id: item.id, loc: toInput(item) })));
  const [narrative, setNarrative] = useState(props.attrs.narrative);
  const single = rows.length === 1;
  const save = () => {
    const items = sanitizeCiteItems(rows.map((r) => {
      const locator = parseLocator(r.loc.page, r.loc.kind);
      return locator ? { id: r.id, locator } : { id: r.id };
    }));
    props.onSave({ items, narrative });
  };
  return (
    <Dialog
      title="Atıfı düzenle"
      onClose={props.onClose}
      actions={
        <>
          <Button onClick={props.onClose}>Vazgeç</Button>
          <Button variant="primary" disabled={rows.some((r) => locatorError(r.loc.page))} onClick={save}>
            Kaydet
          </Button>
        </>
      }
    >
      {rows.map((r, i) => (
        <div key={r.id} className="cite-edit-row">
          <LocatorFields
            label={single ? 'Sayfa (isteğe bağlı)' : `${shortLabel(r.id, props.references, props.lang)}: sayfa (isteğe bağlı)`}
            value={r.loc}
            onChange={(loc) => setRows(rows.map((x, j) => (j === i ? { ...x, loc } : x)))}
          />
          {!single && (
            <Button variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              Atıftan çıkar
            </Button>
          )}
        </div>
      ))}
      <FormatSelect
        narrative={narrative}
        onChange={setNarrative}
        reference={props.references.find((r) => r.id === rows[0]?.id) ?? null}
        lang={props.lang}
      />
    </Dialog>
  );
}
