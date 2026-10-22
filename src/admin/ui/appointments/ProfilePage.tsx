/**
 * Randevu Özeti, once Terapist profili (owner's decision 2026-10-20, Faz 2; redesigned 2026-10-21): the
 * start screen above Randevu Talepleri and Danışanlar. The time now and the bell; four numbers; the next
 * seven days as a strip; the coming sessions and the waiting requests beside the calendar; the session
 * statistics (twelve weeks back and four ahead, the outcomes as a ring); the week's occupancy, each
 * client's sessions and attendance, and the tools. Notifications are on Bildirimler and the e-mail
 * addresses in Ayarlar › E-posta Ayarları.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type BookingRequest, type Client, type PanelEvent } from '../../api/types';
import { formatDay, slotInstant } from '../../../lib/booking-form';
import { sessionKey, sessionsOf } from '../../../lib/sessions';
import { attentionOf, hasFee } from '../../lib/attention';
import { usePanel } from '../context';
import { useFreshData } from '../fresh-data';
import { CalendarCheck, CalendarClock, CalendarRange, CircleAlert, Icon, Inbox, MessagesSquare, UsersRound } from '../icons';
import { NotificationBell } from '../NotificationBell';
import { WeekStrip } from './WeekStrip';
import { Banner, Button, Spinner } from '../kit';
import { AppointmentCalendar, SESSION_KIND_LABEL, labelOf } from './AppointmentCalendar';
import { OccupancyCard, ToolsCard } from './ProfileTools';
import { ClientsCard, SessionInsights } from './SessionInsights';
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

export function ProfilePage() {
  const { api } = usePanel();
  const fresh = useFreshData(api);
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
  }, [api, attempt, fresh]);

  const now = Date.now();
  const next = data ? upcoming(data.clients, data.requests, now) : [];
  const pending = (data?.requests ?? []).filter((r) => r.status === 'pending');
  const attention = data ? attentionOf(data.clients, data.requests, now) : [];
  const weekEnd = now + 7 * DAY;
  const tiles = data
    ? [
        { label: 'Aktif danışan', value: data.clients.length, link: '#/seans-takip', icon: UsersRound, tone: 'adacayi' },
        { label: 'Önümüzdeki 7 gün', value: next.filter((u) => u.at < weekEnd).length, link: '#/seans-takip', icon: CalendarRange, tone: 'lavanta' },
        { label: 'Bekleyen talep', value: pending.length, link: '#/randevular', icon: Inbox, tone: 'kiremit' },
        { label: 'Dikkat isteyen', value: attention.length, link: '#/bildirimler', icon: CircleAlert, tone: 'gunes' },
      ]
    : [];

  return (
    <section className="appt-page profile-page" aria-labelledby="pf-title">
      <div className="screen-head">
        <h2 id="pf-title">
          <Icon as={CalendarClock} size={22} />
          Randevu Özeti
        </h2>
        <div className="head-actions">
          <NowClock />
          <NotificationBell />
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
          <ul className="v2-tiles" aria-label="Özet">
            {tiles.map((t) => (
              <li key={t.label} className={`v2-tile tone-${t.tone}`}>
                <span className="tone-tile" aria-hidden="true">
                  <Icon as={t.icon} size={18} />
                </span>
                <b>{t.value}</b>
                <a href={t.link}>{t.label}</a>
              </li>
            ))}
          </ul>
          <WeekStrip items={next} now={now} />
          {/* Owner's review 2026-10-21: one grid, so the blocks line up — the week's sessions and requests
              beside the calendar, then this month, occupancy and tools, then notifications, the chart and
              the e-mail addresses. */}
          <div className="pf-grid">
            <div className="pf-col">
              <article className="pf-card" aria-labelledby="pf-next">
                <h3 id="pf-next">Yaklaşan seanslar (7 gün)</h3>
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
              </article>
              <article className="pf-card" aria-labelledby="pf-req">
                <h3 id="pf-req">{`Gelen talepler (${pending.length})`}</h3>
                {pending.length ? (
                  <ul className="ev-list">
                    {pending.slice(0, 5).map((r) => (
                      <li key={r.id} className="ev-row">
                        <span className={`tone-tile ${r.kind === 'intro' ? 'tone-kiremit' : 'tone-adacayi'}`} aria-hidden="true">
                          <Icon as={r.kind === 'intro' ? MessagesSquare : CalendarCheck} size={16} />
                        </span>
                        <span className="ev-body">
                          <a href="#/randevular">{`${r.name} · ${r.kind === 'intro' ? 'Ön görüşme' : 'Seans'}`}</a>
                          <span className="ev-meta">{`${formatDay(r.day, 'tr')}, ${r.time.replace(':', '.')}`}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="k-hint">Bekleyen talep yok.</p>
                )}
              </article>
            </div>
            <article className="pf-card pf-cal" aria-label="Takvim">
              <AppointmentCalendar version={attempt} />
            </article>
          </div>
          <SessionInsights clients={data.clients} now={now} />
          <div className="pf-row3">
            <OccupancyCard clients={data.clients} now={now} />
            <ClientsCard clients={data.clients} now={now} />
            <ToolsCard />
          </div>
        </>
      )}
    </section>
  );
}
