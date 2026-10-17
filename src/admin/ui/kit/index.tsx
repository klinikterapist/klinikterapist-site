/** Small UI building blocks shared by the panel screens. */
import { useEffect, useId, useRef, type ReactNode } from 'react';

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
}) {
  const id = useId();
  const describedBy = [props.hint ? `${id}-hint` : '', props.error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value: props.value,
    placeholder: props.placeholder,
    maxLength: props.maxLength,
    lang: props.lang,
    className: `k-input ${props.inputClassName ?? ''}`,
    'aria-invalid': props.error ? true : undefined,
    'aria-describedby': describedBy,
  };
  return (
    <div className={`k-field ${props.className ?? ''}`}>
      <label htmlFor={id}>{props.label}</label>
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

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="k-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Select<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`k-field ${props.className ?? ''}`}>
      <label htmlFor={id}>{props.label}</label>
      <select id={id} className="k-input" value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
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

/** Modal dialog with focus moved inside and Escape to cancel. */
export function Dialog({ title, children, actions, onClose }: { title: string; children: ReactNode; actions: ReactNode; onClose: () => void }) {
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
  return (
    <div className="k-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="k-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <h2 id={titleId}>{title}</h2>
        <div className="k-dialog-body">{children}</div>
        <div className="k-dialog-actions">{actions}</div>
      </div>
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
