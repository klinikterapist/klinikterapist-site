/** Hand-drawn SVG charts for the Ana sayfa statistics (no chart library). Colours come from tokens. */
import { useId, useState } from 'react';

const fmt = (n: number) => n.toLocaleString('tr-TR');
const dayLabel = (day: string, long = false) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: long ? 'long' : 'short', timeZone: 'UTC' });

/** A smooth-enough polyline through the points. */
function linePath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 120;
  const h = 32;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length > 1 ? (i / (values.length - 1)) * w : w / 2, h - 3 - (v / max) * (h - 6)] as [number, number]);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={`${linePath(pts)} L${w} ${h} L0 ${h} Z`} className="spark-fill" />
      <path d={linePath(pts)} className="spark-line" />
    </svg>
  );
}

/** Daily views (area) and reads (line) with a hover / focus readout. */
export function LineChart({ data }: { data: { day: string; views: number; reads: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const gradId = useId();
  const W = 720;
  const H = 220;
  const pad = { l: 36, r: 8, t: 12, b: 26 };
  const max = Math.max(4, ...data.map((d) => d.views));
  const nice = Math.ceil(max / 4) * 4;
  const x = (i: number) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * (W - pad.l - pad.r) : (W - pad.l - pad.r) / 2);
  const y = (v: number) => pad.t + (1 - v / nice) * (H - pad.t - pad.b);
  const views = data.map((d, i) => [x(i), y(d.views)] as [number, number]);
  const reads = data.map((d, i) => [x(i), y(d.reads)] as [number, number]);
  const ticks = [0, nice / 4, nice / 2, (3 * nice) / 4, nice];
  const every = Math.max(1, Math.ceil(data.length / 7));
  const totalViews = data.reduce((s, d) => s + d.views, 0);
  const totalReads = data.reduce((s, d) => s + d.reads, 0);
  const a = active === null ? null : data[active];

  const pick = (clientX: number, rect: DOMRect) => {
    const rel = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (data.length - 1));
    setActive(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="line-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Günlük görüntüleme ve okuma. Toplam ${fmt(totalViews)} görüntüleme, ${fmt(totalReads)} okuma.`}
        tabIndex={0}
        onMouseMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setActive((p) => Math.min(data.length - 1, (p ?? -1) + 1));
          if (e.key === 'ArrowLeft') setActive((p) => Math.max(0, (p ?? data.length) - 1));
          if (e.key === 'Escape') setActive(null);
        }}
        onBlur={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="lc-grad-top" />
            <stop offset="100%" className="lc-grad-bottom" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="lc-grid" />
            <text x={pad.l - 8} y={y(t) + 4} className="lc-axis" textAnchor="end">
              {fmt(Math.round(t))}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % every === 0 || i === data.length - 1 ? (
            <text key={d.day} x={x(i)} y={H - 6} className="lc-axis" textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
              {dayLabel(d.day)}
            </text>
          ) : null,
        )}
        {data.length > 0 && <path d={`${linePath(views)} L${x(data.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={`url(#${gradId})`} />}
        <path d={linePath(views)} className="lc-views" />
        <path d={linePath(reads)} className="lc-reads" />
        {a && active !== null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={pad.t} y2={H - pad.b} className="lc-cursor" />
            <circle cx={x(active)} cy={y(a.views)} r={4.5} className="lc-dot-views" />
            <circle cx={x(active)} cy={y(a.reads)} r={4.5} className="lc-dot-reads" />
          </g>
        )}
      </svg>
      {a && active !== null && (
        <div className="lc-tip" style={{ left: `${(x(active) / W) * 100}%` }} role="status">
          <b>{dayLabel(a.day, true)}</b>
          <span>
            <i className="key key-views" /> {fmt(a.views)} görüntüleme
          </span>
          <span>
            <i className="key key-reads" /> {fmt(a.reads)} okuma
          </span>
        </div>
      )}
    </div>
  );
}

/** Rows with a soft bar behind each label (largest = full width). */
export function BarList({ rows, unit, empty }: { rows: { label: string; value: number; href?: string; note?: string }[]; unit: string; empty: string }) {
  if (!rows.length) return <p className="bar-empty">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="bar-list">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="bar-fill" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} aria-hidden="true" />
          <span className="bar-label">
            {r.href ? <a href={r.href}>{r.label}</a> : r.label}
            {r.note && <small>{r.note}</small>}
          </span>
          <span className="bar-value">
            {fmt(r.value)}
            <span className="k-visually-hidden"> {unit}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** One stacked bar with a legend: shares of a whole (devices, languages). */
export function ShareBar({ parts, empty }: { parts: { label: string; value: number }[]; empty: string }) {
  const sum = parts.reduce((s, p) => s + p.value, 0);
  if (!sum) return <p className="bar-empty">{empty}</p>;
  return (
    <div className="share-bar">
      <div className="share-track" aria-hidden="true">
        {parts.map((p, i) => (
          <span key={p.label} className={`share-seg share-seg-${i}`} style={{ width: `${(p.value / sum) * 100}%` }} />
        ))}
      </div>
      <ul className="share-legend">
        {parts.map((p, i) => (
          <li key={p.label}>
            <i className={`key share-seg-${i}`} />
            <span>{p.label}</span>
            <b>%{Math.round((p.value / sum) * 100)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
