/**
 * Seans grafiği (owner's review 2026-10-20, a4): the client's past paid sessions in percent, as one
 * stacked bar with a key under it (like the storage bar in iPhone settings), and the running count
 * since therapy began. Free sessions are counted apart.
 */
import type { SessionStats } from '../../../lib/sessions';

const PARTS = [
  { key: 'attended', label: 'Katıldı' },
  { key: 'noshow', label: 'Gelmedi' },
  { key: 'cancelled', label: 'İptal edildi' },
  { key: 'postponed', label: 'Ertelendi' },
  { key: 'unmarked', label: 'İşaretlenmedi' },
] as const;

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export function SessionChart({ stats }: { stats: SessionStats }) {
  return (
    <div className="cl-card chart">
      <div className="chart-count">
        <span>
          <b>{stats.held}</b> seans
        </span>
        <small>{`Terapiye başlangıçtan bu yana${stats.free ? ` · ${stats.free} ücretsiz görüşme` : ''}`}</small>
      </div>
      {stats.total === 0 ? (
        <p className="k-hint">Henüz geçmiş seans yok; grafik ilk seanstan sonra dolar.</p>
      ) : (
        <>
          <div className="chart-bar" role="img" aria-label={PARTS.filter((p) => stats[p.key]).map((p) => `${p.label} %${pct(stats[p.key], stats.total)}`).join(', ')}>
            {PARTS.filter((p) => stats[p.key]).map((p) => (
              <span key={p.key} className={`chart-seg seg-${p.key}`} style={{ flexGrow: stats[p.key] }} />
            ))}
          </div>
          <ul className="chart-key">
            {PARTS.map((p) => (
              <li key={p.key}>
                <i className={`seg-${p.key}`} aria-hidden="true" />
                <span>{p.label}</span>
                <b>{`%${pct(stats[p.key], stats.total)}`}</b>
                <small>{stats[p.key]}</small>
              </li>
            ))}
          </ul>
          <p className="chart-note">{`Geçmiş ${stats.total} seans üzerinden (iptal ve ertelenenler dahil).`}</p>
        </>
      )}
    </div>
  );
}
