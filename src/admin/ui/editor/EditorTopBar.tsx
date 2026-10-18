/**
 * The editor's top bar (spec §5.3): ← Yazılar · save status · language buttons · Önizle · Yayınla ·
 * "⋯" (Yayından kaldır, Değişiklikleri at / Taslağı sil).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Draft } from '../../api/types';
import type { Lang } from '../../../lib/schemas';
import { Ellipsis, Icon } from '../icons';
import { Button } from '../kit';
import { LangButtons } from './LangButtons';

/** The one place the publish button's label is decided. */
export function publishLabel(d: Pick<Draft, 'published'>): string {
  return d.published ? 'Değişiklikleri yayınla' : 'Yayınla';
}

export type MoreAction = { label: string; onSelect: () => void };

function MoreMenu({ actions }: { actions: MoreAction[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

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
      {open && (
        <div ref={menu} id="top-more-menu" className="top-more-menu" role="menu">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditorTopBar(props: {
  status: ReactNode;
  draft: Draft;
  lang: Lang;
  onLang: (l: Lang) => void;
  onPreview: () => void;
  onPublish: () => void;
  publishing: boolean;
  more: MoreAction[];
}) {
  return (
    <div className="editor-top">
      <a href="#/yazilar">← Yazılar</a>
      {props.status}
      <div className="editor-top-actions">
        <LangButtons draft={props.draft} lang={props.lang} onLang={props.onLang} />
        <Button onClick={props.onPreview}>Önizle</Button>
        <Button variant="primary" busy={props.publishing} onClick={props.onPublish}>
          {publishLabel(props.draft)}
        </Button>
        {props.more.length > 0 && <MoreMenu actions={props.more} />}
      </div>
    </div>
  );
}
