/**
 * A small menu behind one button (owner's review 2026-10-21: fewer buttons side by side). The rarer
 * steps of a row or a page sit here, each with a short line on what it does; a red one is marked as
 * such. Escape or a click outside closes it.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Ellipsis, Icon, type LucideIcon } from './icons';

export type MenuItem = { label: string; hint?: string; icon?: LucideIcon; danger?: boolean; disabled?: boolean; onSelect: () => void } | 'divider';

export function ActionMenu({ label, icon, items, compact = false, align = 'right' }: { label: string; icon?: LucideIcon; items: MenuItem[]; compact?: boolean; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const shown = items.filter((x) => x === 'divider' || !x.disabled);
  if (!shown.some((x) => x !== 'divider')) return null;
  let body: ReactNode = (
    <>
      {icon && <Icon as={icon} size={16} />}
      <span>{label}</span>
      <Icon as={ChevronDown} size={14} />
    </>
  );
  if (compact) body = <Icon as={Ellipsis} size={18} />;
  return (
    <div className="act-menu" ref={box}>
      <button
        type="button"
        className={`k-btn ${compact ? 'k-btn-ghost act-menu-more' : 'k-btn-secondary'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
        onClick={() => setOpen(!open)}
      >
        {body}
      </button>
      {open && (
        <div id={id} className={`act-menu-list act-menu-${align}`} role="menu" aria-label={label}>
          {shown.map((x, i) =>
            x === 'divider' ? (
              <hr key={i} />
            ) : (
              <button
                key={x.label}
                type="button"
                role="menuitem"
                aria-label={x.label}
                className={x.danger ? 'is-danger' : undefined}
                onClick={() => {
                  setOpen(false);
                  x.onSelect();
                }}
              >
                {x.icon && <Icon as={x.icon} size={16} />}
                <span>
                  <b>{x.label}</b>
                  {x.hint && <small>{x.hint}</small>}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
