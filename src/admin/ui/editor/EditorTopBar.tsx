/**
 * The editor's top bar (spec §5.3): ← Yazılar · save status · language buttons · Önizle · Yayınla ·
 * "⋯" (Yayından kaldır, Değişiklikleri at / Taslağı sil).
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Draft } from '../../api/types';
import type { Lang } from '../../../lib/schemas';
import type { ChecklistItem } from '../../lib/checklist';
import { useHistoryLayer } from '../history-layer';
import { Ellipsis, Icon } from '../icons';
import { Button } from '../kit';
import { LangButtons } from './LangButtons';

/** The one place the publish button's label is decided: a future date and time plan the post instead. */
export function publishLabel(d: Pick<Draft, 'published'>, planning = false): string {
  if (planning) return 'Planla';
  return d.published ? 'Değişiklikleri yayınla' : 'Yayınla';
}

export type MoreAction = { label: string; onSelect: () => void };

function MoreMenu({ actions }: { actions: MoreAction[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  return (
    <div className="top-more">
      <button
        ref={button}
        type="button"
        className="k-btn k-btn-ghost top-more-btn"
        aria-label="Diğer işlemler"
        title="Diğer işlemler"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="top-more-menu"
        onClick={() => setOpen(!open)}
      >
        <Icon as={Ellipsis} size={20} />
      </button>
      {open && <MoreMenuList actions={actions} button={button} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The open menu. It joins the browser history, so the phone's "back" closes it and stays on the post. */
function MoreMenuList({ actions, button, onClose }: { actions: MoreAction[]; button: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const close = useHistoryLayer(onClose);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        button.current?.focus();
      }
    };
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [close, button]);

  return (
    <div ref={menu} id="top-more-menu" className="top-more-menu" role="menu">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          role="menuitem"
          onClick={() => {
            // Close first: a confirm opened by the action then waits for the menu's entry to go.
            close();
            a.onSelect();
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

export function EditorTopBar(props: {
  status: ReactNode;
  draft: Draft;
  /** The publish checklist; the language buttons' ✓/⚠ come from it. */
  checklist: ChecklistItem[];
  lang: Lang;
  onLang: (l: Lang) => void;
  onPreview: () => void;
  onPublish: () => void;
  publishing: boolean;
  /** A future date and time is set: the button plans instead of publishing. */
  planning?: boolean;
  more: MoreAction[];
}) {
  return (
    <div className="editor-top">
      <a href="#/yazilar">← Yazılar</a>
      {props.status}
      <div className="editor-top-actions">
        <LangButtons checklist={props.checklist} lang={props.lang} onLang={props.onLang} />
        <Button onClick={props.onPreview}>Önizle</Button>
        <Button variant="primary" busy={props.publishing} onClick={props.onPublish}>
          {publishLabel(props.draft, props.planning)}
        </Button>
        {props.more.length > 0 && <MoreMenu actions={props.more} />}
      </div>
    </div>
  );
}
