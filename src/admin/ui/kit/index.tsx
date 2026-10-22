/** Small UI building blocks shared by the panel screens. */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type LucideIcon } from '../icons';
import { useHistoryLayer } from '../history-layer';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; busy?: boolean };

export function Button({ variant = 'secondary', busy, children, className = '', disabled, ...rest }: ButtonProps) {
  return (
    <button type="button" className={`k-btn k-btn-${variant} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy && <span className="k-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: ReactNode;
  error?: string | null;
  multiline?: boolean;
  rows?: number;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  inputClassName?: string;
  lang?: string;
  /** Set as `data-field` on the input, so the publish checklist can find and focus it. */
  field?: string;
  /** Explanation opened by a small "?" button beside the label. */
  help?: ReactNode;
  autoComplete?: string;
}) {
  const id = useId();
  const describedBy = [props.hint ? `${id}-hint` : '', props.error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value: props.value,
    placeholder: props.placeholder,
    maxLength: props.maxLength,
    lang: props.lang,
    'data-field': props.field,
    autoComplete: props.autoComplete,
    className: `k-input ${props.inputClassName ?? ''}`,
    'aria-invalid': props.error ? true : undefined,
    'aria-describedby': describedBy,
  };
  return (
    <div className={`k-field ${props.className ?? ''}`}>
      <div className="k-label-row">
        <label htmlFor={id}>{props.label}</label>
        {props.help && <HelpTip label={props.label}>{props.help}</HelpTip>}
      </div>
      {props.multiline ? (
        <textarea {...common} rows={props.rows ?? 3} onChange={(e) => props.onChange(e.target.value)} />
      ) : (
        <input {...common} type={props.type ?? 'text'} onChange={(e) => props.onChange(e.target.value)} />
      )}
      {props.hint && (
        <p className="k-hint" id={`${id}-hint`}>
          {props.hint}
        </p>
      )}
      {props.error && (
        <p className="k-error" id={`${id}-err`} role="alert">
          {props.error}
        </p>
      )}
    </div>
  );
}

/**
 * Small round "?" button that opens a short explanation inline, below the label row it sits in.
 * Not a modal and not part of the browser history, so it is safe inside the bottom sheet: Escape
 * closes only the tip (while it is open) and never reaches the sheet.
 */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const regionId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // capture phase: runs before the sheet's own Escape handler
      setOpen(false);
      btn.current?.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);
  return (
    <>
      <button
        type="button"
        ref={btn}
        className="k-help-btn"
        aria-label={`${label} hakkında bilgi`}
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <div className="k-help-body" id={regionId} role="region" aria-label={`${label} hakkında`}>
          {children}
        </div>
      )}
    </>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="k-toggle">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Select<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
  field?: string;
  help?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`k-field ${props.className ?? ''}`}>
      <div className="k-label-row">
        <label htmlFor={id}>{props.label}</label>
        {props.help && <HelpTip label={props.label}>{props.help}</HelpTip>}
      </div>
      <select id={id} className="k-input" data-field={props.field} value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Banner({ tone = 'info', children, action }: { tone?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`k-banner k-banner-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="k-banner-text">{children}</div>
      {action}
    </div>
  );
}

type DialogProps = {
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  /** Join the browser history, so the phone's "back" closes the dialog (via `onClose`) instead of leaving the page. */
  history?: boolean;
};

/** Modal dialog with focus moved inside and Escape to cancel. */
export function Dialog(props: DialogProps) {
  return props.history ? <HistoryDialog {...props} /> : <DialogFrame {...props} />;
}

function HistoryDialog(props: DialogProps) {
  // Its own close paths go through onClose and unmount the dialog, which takes the entry back off.
  useHistoryLayer(props.onClose);
  return <DialogFrame {...props} />;
}

function DialogFrame({ title, children, actions, onClose }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, input, textarea, select')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  // On top of everything: opened from a sticky panel, the dialog would otherwise sit under the
  // editor's sticky toolbar and footer (owner's review 2026-10-20).
  return createPortal(
    <div className="k-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="k-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <h2 id={titleId}>{title}</h2>
        <div className="k-dialog-body">{children}</div>
        <div className="k-dialog-actions">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Empty list or card: an icon, one calm sentence and an optional next step. */
export function EmptyState({ icon, children, action }: { icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="k-empty">
      <span className="k-empty-icon">
        <Icon as={icon} size={28} />
      </span>
      <p>{children}</p>
      {action}
    </div>
  );
}

export type LightLevel = 'green' | 'yellow' | 'red';
const LIGHT_TEXT: Record<LightLevel, string> = { green: 'İyi', yellow: 'Geliştirilebilir', red: 'Sorun' };

/** Traffic light with an icon and hidden text, so it does not rely on colour alone. */
export function Light({ level }: { level: LightLevel }) {
  return (
    <span className={`k-light k-light-${level}`} title={LIGHT_TEXT[level]}>
      <span aria-hidden="true">{level === 'green' ? '✓' : level === 'yellow' ? '!' : '×'}</span>
      <span className="k-visually-hidden">{LIGHT_TEXT[level]}</span>
    </span>
  );
}

export function Spinner({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <p className="k-loading" role="status">
      <span className="k-spinner" aria-hidden="true" /> {label}
    </p>
  );
}

/** Up/down reorder buttons for list editors (no drag-only interaction). */
export function MoveButtons({ index, count, onMove, label }: { index: number; count: number; onMove: (to: number) => void; label: string }) {
  return (
    <span className="k-move">
      <Button variant="ghost" aria-label={`${label}: yukarı taşı`} disabled={index === 0} onClick={() => onMove(index - 1)}>
        ↑
      </Button>
      <Button variant="ghost" aria-label={`${label}: aşağı taşı`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        ↓
      </Button>
    </span>
  );
}

export function move<T>(list: T[], from: number, to: number): T[] {
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}
