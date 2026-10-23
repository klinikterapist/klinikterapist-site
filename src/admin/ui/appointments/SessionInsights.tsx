/**
 * Seans istatistikleri on Randevu Özeti (owner's request 2026-10-21: richer session charts):
 * - Haftalar: the last twelve weeks and the next four as stacked bars — attended, missed, cancelled,
 *   postponed, not yet marked, and the planned ones ahead in a lighter tone; this week marked.
 * - Durum: all past paid sessions as a ring with the share of each outcome, attendance in the middle.
 * - Danışanlara göre: each client's sessions so far and attendance rate as a bar.
 * Paid sessions only (the free intro and closing calls are counted apart), as on the client's page.
 */
import type { Client } from '../../api/types';
import { slotInstant } from '../../../lib/booking-form';
import { FREE_KINDS, addDays, sessionStats, sessionsOf, type SessionStatus } from '../../../lib/sessions';

const istanbulDay = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
/** Monday of the week `day` is in. */
const mondayOf = (day: string) => {
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((wd + 6) % 7));
};
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const short = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;

type Bucket = 'attended' | 'noshow' | 'cancelled' | 'postponed' | 'unmarked' | 'planned';
const PARTS: { key: Bucket; label: string }[] = [
  { key: 'attended', label: 'Katıldı' },
  { key: 'noshow', label: 'Gelmedi' },
  { key: 'cancelled', label: 'İptal' },
  { key: 'postponed', label: 'Ertelendi' },
  { key: 'unmarked', label: 'İşaretlenmedi' },
  { key: 'planned', label: 'Planlı' },
];

export function weeklySessions(clients: Client[], now: number, back = 12, ahead = 4) {
  const thisWeek = mondayOf(istanbulDay(now));
  const weeks = Array.from({ length: back + ahead }, (_, i) => addDays(thisWeek, (i - back + 1) * 7));
  const from = weeks[0];
  const to = addDays(weeks[weeks.length - 1], 6);
  const rows = weeks.map((w) => ({ week: w, counts: { attended: 0, noshow: 0, cancelled: 0, postponed: 0, unmarked: 0, planned: 0 } as Record<Bucket, number> }));
  for (const c of clients) {
    for (const s of sessionsOf(c, from, to)) {
      if (FREE_KINDS.includes(s.kind)) continue;
      const row = rows.find((r) => r.week === mondayOf(s.day));
      if (!row) continue;
      const past = slotInstant(s.day, s.time) <= now;
      const b: Bucket = s.status === 'planned' ? (past ? 'unmarked' : 'planned') : (s.status as Exclude<SessionStatus, 'planned'>);
      row.counts[b]++;
    }
  }
  return { rows, thisWeek };
}

function WeeksChart({ clients, now }: { clients: Client[]; now: number }) {
  const { rows, thisWeek } = weeklySessions(clients, now);
  const peak = Math.max(1, ...rows.map((r) => Object.values(r.counts).reduce((a, n) => a + n, 0)));
  const held = rows.filter((r) => r.week <= thisWeek).reduce((a, r) => a + r.counts.attended, 0);
  return (
    <div className="si-weeks">
      <div className="si-head">
        <span>
          <b>{held}</b> seans yapıldı
        </span>
        <small>Son 12 hafta · sağda önümüzdeki 4 hafta</small>
      </div>
      <div className="si-bars" role="img" aria-label={rows.map((r) => `${short(r.week)} haftası: ${PARTS.filter((p) => r.counts[p.key]).map((p) => `${p.label} ${r.counts[p.key]}`).join(', ') || 'seans yok'}`).join('; ')}>
        {rows.map((r) => {
          const total = Object.values(r.counts).reduce((a, n) => a + n, 0);
          return (
            <div key={r.week} className={`si-col${r.week === thisWeek ? ' is-now' : ''}${r.week > thisWeek ? ' is-ahead' : ''}`}>
              <span className="si-n">{total || ''}</span>
              <span className="si-stack" style={{ height: `${(total / peak) * 100}%` }}>
                {PARTS.filter((p) => r.counts[p.key]).map((p) => (
                  <i key={p.key} className={`si-${p.key}`} style={{ flexGrow: r.counts[p.key] }} title={`${p.label}: ${r.counts[p.key]}`} />
                ))}
              </span>
              <span className="si-week">{r.week === thisWeek ? 'Bu hafta' : short(r.week)}</span>
            </div>
          );
        })}
      </div>
      <ul className="si-key">
        {PARTS.map((p) => (
          <li key={p.key}>
            <i className={`si-${p.key}`} aria-hidden="true" />
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusRing({ clients, now }: { clients: Client[]; now: number }) {
  const t = { attended: 0, noshow: 0, cancelled: 0, postponed: 0, unmarked: 0, total: 0, free: 0 };
  for (const c of clients) {
    const s = sessionStats(c, now);
    t.attended += s.attended;
    t.noshow += s.noshow;
    t.cancelled += s.cancelled;
    t.postponed += s.postponed;
    t.unmarked += s.unmarked;
    t.total += s.total;
    t.free += s.free;
  }
  const parts = PARTS.filter((p) => p.key !== 'planned');
  let acc = 0;
  const stops = parts
    .filter((p) => t[p.key as keyof typeof t])
    .map((p) => {
      const startPct = acc;
      acc += (t[p.key as keyof typeof t] / Math.max(1, t.total)) * 100;
      return `var(--si-${p.key}) ${startPct}% ${acc}%`;
    });
  const marked = t.attended + t.noshow;
  const rate = marked ? Math.round((t.attended / marked) * 100) : null;
  return (
    <div className="si-ring-wrap">
      <span className="si-ring" style={{ background: t.total ? `conic-gradient(${stops.join(', ')})` : undefined }} role="img" aria-label={parts.map((p) => `${p.label} ${t[p.key as keyof typeof t]}`).join(', ')}>
        <span>
          <b>{rate === null ? '–' : `%${rate}`}</b>
          <small>katılım</small>
        </span>
      </span>
      <ul className="si-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <i className={`si-${p.key}`} aria-hidden="true" />
            <span>{p.label}</span>
            <b>{t[p.key as keyof typeof t]}</b>
            <small>{t.total ? `%${Math.round((t[p.key as keyof typeof t] / t.total) * 100)}` : ''}</small>
          </li>
        ))}
        <li className="si-legend-free">
          <span>Ücretsiz görüşme</span>
          <b>{t.free}</b>
        </li>
      </ul>
    </div>
  );
}

export function SessionInsights({ clients, now }: { clients: Client[]; now: number }) {
  return (
    <section className="pf-card si" aria-labelledby="si-title">
      <h3 id="si-title">Seans istatistikleri</h3>
      <div className="si-grid">
        <WeeksChart clients={clients} now={now} />
        <StatusRing clients={clients} now={now} />
      </div>
    </section>
  );
}
