/**
 * The editor's icon strip on the right edge (spec §5.4): Ayarlar, SEO and Meta. One panel is open at
 * a time; clicking the open one closes it. The choice is kept on this device (`panel.rail`). Under
 * 768 px the panel opens as a bottom sheet that the phone's "back" closes; it starts closed there.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { RailPanel } from '../../lib/checklist';
import { useHistoryLayer } from '../history-layer';
import { Icon, SearchCheck, Settings, Tag, type LucideIcon } from '../icons';
import { Button } from '../kit';

export type { RailPanel };

export const RAIL_LABEL: Record<RailPanel, string> = { settings: 'Ayarlar', seo: 'SEO', meta: 'Meta' };
const RAIL_ICON: Record<RailPanel, LucideIcon> = { settings: Settings, seo: SearchCheck, meta: Tag };
const PANELS: RailPanel[] = ['settings', 'seo', 'meta'];
const KEY = 'panel.rail';
export const SHEET_BELOW = 768;

/** True while the window is narrower than `px` (window width, so it also works without matchMedia). */
export function useNarrow(px: number): boolean {
  const [narrow, setNarrow] = useState(() => window.innerWidth < px);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < px);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [px]);
  return narrow;
}

/** The open panel (or null) and a setter that remembers it. */
export function useRailPanel(): [RailPanel | null, (next: RailPanel | null) => void] {
  const [open, setOpen] = useState<RailPanel | null>(() => {
    if (window.innerWidth < SHEET_BELOW) return null;
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === 'closed') return null;
      if (v && (PANELS as string[]).includes(v)) return v as RailPanel;
    } catch {
      /* storage unavailable */
    }
    return 'settings';
  });
  const set = useCallback((next: RailPanel | null) => {
    setOpen(next);
    try {
      window.localStorage.setItem(KEY, next ?? 'closed');
    } catch {
      /* storage unavailable */
    }
  }, []);
  return [open, set];
}

export type RailDots = { seo: 'good' | 'ok' | 'bad'; seoScore: number; settingsMissing: boolean };

export function SideRail({ open, onToggle, dots }: { open: RailPanel | null; onToggle: (p: RailPanel) => void; dots: RailDots }) {
  const title: Record<RailPanel, string> = {
    settings: dots.settingsMissing ? 'Ayarlar (eksik madde var)' : 'Ayarlar',
    seo: `SEO (puan ${dots.seoScore})`,
    meta: 'Meta',
  };
  return (
    <nav className="side-rail" aria-label="Yazı panelleri">
      {PANELS.map((p) => (
        <button
          key={p}
          type="button"
          className="rail-btn"
          aria-label={RAIL_LABEL[p]}
          aria-pressed={open === p}
          title={title[p]}
          onClick={() => onToggle(p)}
        >
          <Icon as={RAIL_ICON[p]} size={20} />
          {p === 'seo' && <span className={`rail-dot rail-dot-${dots.seo}`} aria-hidden="true" />}
          {p === 'settings' && dots.settingsMissing && <span className="rail-dot rail-dot-ok" aria-hidden="true" />}
        </button>
      ))}
    </nav>
  );
}

/** Bottom sheet for the open panel on a phone; joins the history so "back" closes it. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const close = useHistoryLayer(onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [close]);
  return (
    <div className="rail-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="rail-sheet" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        <div className="rail-sheet-head">
          <span className="rail-sheet-grip" aria-hidden="true" />
          <Button variant="ghost" onClick={close}>
            Kapat
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** The open panel: an inline region beside the text, or a bottom sheet on a phone. Both are named after the panel. */
export function RailPanelFrame({ panel, sheet, onClose, children }: { panel: RailPanel; sheet: boolean; onClose: () => void; children: ReactNode }) {
  if (sheet) {
    return (
      <Sheet label={RAIL_LABEL[panel]} onClose={onClose}>
        {children}
      </Sheet>
    );
  }
  return (
    <section className="rail-panel" role="region" aria-label={RAIL_LABEL[panel]}>
      {children}
    </section>
  );
}
