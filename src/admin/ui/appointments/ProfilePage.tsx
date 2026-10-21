/**
 * Terapist profili (owner's decision 2026-10-20, Faz 2): the start screen above Randevu talepleri
 * and Seans takip. At a glance: the time now, a few numbers (active clients, sessions this week,
 * waiting requests, unpaid sessions), the next seven days' sessions, the waiting requests, what
 * needs attention and the latest events (Bildirimler, in short), the appointment calendar with
 * "Saat kapat", the chart of all clients' sessions so far, and the system's e-mail addresses (Faz 4).
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type BookingRequest, type Client, type PanelEvent } from '../../api/types';
import { formatDay, slotInstant } from '../../../lib/booking-form';
import { sessionKey, sessionStats, sessionsOf, type SessionStats } from '../../../lib/sessions';
import { attentionOf, hasFee } from '../../lib/attention';
import { usePanel } from '../context';
import { Icon, UserRound } from '../icons';
import { Banner, Button, Spinner } from '../kit';
import { AppointmentCalendar, SESSION_KIND_LABEL, labelOf } from './AppointmentCalendar';
import { MailboxesCard } from './MailboxesCard';
import { SessionChart } from './SessionChart';
import { NowClock, whenText } from './TrackingPage';

const DAY = 24 * 3600e3;
const istanbulDay = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);

type Upcoming = { key: string; at: number; day: string; time: string; who: string; what: string; link: string; free: boolean };

/** The next seven days: the clients' sessions and the approved one-off appointments. */
function upcoming(clients: Client[], requests: BookingRequest[], now: number): Upcoming[] {
  const from = istanbulDay(now);
  const to = istanbulDay(now + 7 * DAY);
  const out: Upcoming[] = [];
  for (const c of clients) {
    for (const s of sessionsOf(c, from, to)) {
      const at = slotInstant(s.day, s.time);
      if (at < now || s.status === 'cancelled' || s.status === 'postponed') continue;
      out.push({ key: `${c.id}-${sessionKey(s)}`, at, day: s.day, time: s.time, who: c.number, what: s.kind === 'weekly' ? labelOf({ kind: 'session', type: c.type }) : SESSION_KIND_LABEL[s.kind], link: `#/seans-takip/${c.id}`, free: !hasFee(s) });
    }
  }
  for (const r of requests) {
    const at = slotInstant(r.day, r.time);
    if (r.status !== 'approved' || at < now || r.day > to) continue;
    out.push({ key: r.id, at, day: r.day, time: r.time, who: r.name, what: labelOf(r), link: '#/randevular', free: r.kind === 'intro' });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** All clients' sessions so far, added up for one chart. */
function total(clients: Client[], now: number): SessionStats {
  const t: SessionStats = { held: 0, attended: 0, noshow: 0, cancelled: 0, postponed: 0, unmarked: 0, total: 0, free: 0 };
  for (const c of clients) {
    const s = sessionStats(c, now);
    for (const k of Object.keys(t) as (keyof SessionStats)[]) t[k] += s[k];
  }
  return t;
}

export function ProfilePage() {
  const { api } = usePanel();
  const [data, setData] = useState<{ clients: Client[]; requests: BookingRequest[]; events: PanelEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([api.clientsList(), api.requestsList(), api.eventsList()])
      .then(([cl, rq, ev]) => alive && setData({ clients: cl.clients, requests: rq.requests, events: ev.events }))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const now = Date.now();
  const next = data ? upcoming(data.clients, data.requests, now) : [];
  const pending = (data?.requests ?? []).filter((r) => r.status === 'pending');
  const attention = data ? attentionOf(data.clients, data.requests, now) : [];
  const weekEnd = now + 7 * DAY;
  const tiles = data
    ? [
        { label: 'Aktif danışan', value: data.clients.length, link: '#/seans-takip' },
        { label: 'Önümüzdeki 7 gün', value: next.filter((u) => u.at < weekEnd).length, link: '#/seans-takip' },
        { label: 'Bekleyen talep', value: pending.length, link: '#/randevular' },
        { label: 'Dikkat isteyen', value: attention.length, link: '#/bildirimler' },
      ]
    : [];

  return (
    <section className="appt-page profile-page" aria-labelledby="pf-title">
      <div className="screen-head">
        <h2 id="pf-title">
          <Icon as={UserRound} size={22} />
          Randevu Özeti
        </h2>
        <div className="head-actions">
          <NowClock />
        </div>
      </div>
      {error && (
        <Banner tone="error" action={<Button onClick={() => setAttempt((n) => n + 1)}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}
      {!data && !error && <Spinner label="Yükleniyor…" />}
      {data && (
        <>
          <ul className="pf-tiles" aria-label="Özet">
            {tiles.map((t) => (
              <li key={t.label}>
                <a href={t.link}>
                  <b>{t.value}</b>
                  <span>{t.label}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="appt-layout">
            <div className="appt-main">
              <div className="k-group">
                <h3 className="tk-group-title">Yaklaşan seanslar (7 gün)</h3>
                {next.length ? (
                  <ul className="tk-list">
                    {next.map((u) => (
                      <li key={u.key} className="tk-row">
                        <span className="tk-number">{u.who}</span>
                        <span className="tk-what">
                          <b>{whenText(u, now)}</b>
                          <span>{`${u.what}${u.free ? ' · ücretsiz' : ''}`}</span>
                        </span>
                        <a className="k-btn k-btn-secondary tk-go" href={u.link}>
                          Aç
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="k-hint">Önümüzdeki 7 günde seans yok.</p>
                )}
              </div>
              <div className="k-group">
                <h3 className="tk-group-title">{`Gelen talepler (${pending.length})`}</h3>
                {pending.length ? (
                  <ul className="nt-list">
                    {pending.slice(0, 5).map((r) => (
                      <li key={r.id} className="nt-item">
                        <a href="#/randevular">{`${r.name} · ${r.kind === 'intro' ? 'Ön görüşme' : 'Seans'} · ${formatDay(r.day, 'tr')}, ${r.time.replace(':', '.')}`}</a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="k-hint">Bekleyen talep yok.</p>
                )}
              </div>
              <div className="k-group">
                <h3 className="tk-group-title">Bildirimler</h3>
                <ul className="nt-list">
                  {attention.slice(0, 3).map((a) => (
                    <li key={a.key} className={`nt-item nt-${a.tone}`}>
                      <a href={a.link}>{a.text}</a>
                    </li>
                  ))}
                  {data.events.slice(0, 5).map((e) => (
                    <li key={e.id} className="nt-item">
                      <span className="nt-time">{formatDay(istanbulDay(e.at), 'tr').split(' ').slice(0, 2).join(' ')}</span>
                      {e.link ? <a href={e.link}>{e.text}</a> : <span>{e.text}</span>}
                    </li>
                  ))}
                </ul>
                <a className="back-link" href="#/bildirimler">
                  Tüm bildirimler →
                </a>
              </div>
            </div>
            <aside className="appt-side">
              <AppointmentCalendar version={attempt} />
              <div className="k-group">
                <h3 className="tk-group-title">Toplam seans grafiği</h3>
                <SessionChart stats={total(data.clients, now)} />
              </div>
              <MailboxesCard />
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
