/**
 * Bildirimler (owner's decision 2026-10-20, Faz 2; redesigned on the owner's review 2026-10-21): on
 * the left what needs attention now (worked out from the clients and the requests: lib/attention.ts),
 * each with a "Git" button, and the kinds with their counts; on the right what happened (the backend's
 * event stream) as a timeline by day, newest first, each event with its kind's icon and tone. Events newer than the last visit are marked "yeni"
 * (the time of the last visit stays in this browser only).
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type BookingRequest, type Client, type PanelEvent, type PanelEventKind } from '../../api/types';
import { formatDay } from '../../../lib/booking-form';
import { attentionOf } from '../../lib/attention';
import { usePanel } from '../context';
import { useFreshData } from '../fresh-data';
import { BellRing, CalendarClock, CheckCheck, ChevronRight, CircleAlert, Icon, Inbox, MessagesSquare, TriangleAlert, UsersRound, Wallet, type LucideIcon } from '../icons';
import { EVENT_LOOK, dayGroup, timeOf } from '../NotificationBell';
import { markSeen, readSeen } from '../notifications';
import { Banner, Button, EmptyState, Spinner } from '../kit';

const FILTERS: { id: 'all' | PanelEventKind; label: string; kinds?: PanelEventKind[] }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'request', label: 'Talepler', kinds: ['request', 'decision', 'waitlist', 'info'] },
  { id: 'client', label: 'Danışanlar', kinds: ['client'] },
  { id: 'payment', label: 'Ödemeler', kinds: ['payment'] },
  { id: 'reminder', label: 'Hatırlatmalar', kinds: ['reminder'] },
];

const dayOf = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);

export function NotificationsPage() {
  const { api } = usePanel();
  const fresh = useFreshData(api);
  const [data, setData] = useState<{ events: PanelEvent[]; clients: Client[]; requests: BookingRequest[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  // Kept for this visit: the "yeni" marks stay until the page is left.
  const [seen] = useState(readSeen);

  useEffect(() => {
    let alive = true;
    Promise.all([api.eventsList(), api.clientsList(), api.requestsList()])
      .then(([ev, cl, rq]) => {
        if (!alive) return;
        setData({ events: ev.events, clients: cl.clients, requests: rq.requests });
        markSeen();
      })
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Bildirimler yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt, fresh]);

  const now = Date.now();
  const attention = data ? attentionOf(data.clients, data.requests, now) : [];
  const kinds = FILTERS.find((f) => f.id === filter)?.kinds;
  const shown = (data?.events ?? []).filter((e) => !kinds || kinds.includes(e.kind));
  const days = [...new Set(shown.map((e) => dayOf(e.at)))];

  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, (data?.events ?? []).filter((e) => !f.kinds || f.kinds.includes(e.kind)).length]));
  const unseen = (data?.events ?? []).filter((e) => e.at > seen).length;
  const icons: Record<string, LucideIcon> = { all: Inbox, request: MessagesSquare, client: UsersRound, payment: Wallet, reminder: CalendarClock };
  const tones: Record<string, string> = { all: 'lacivert', request: 'kiremit', client: 'adacayi', payment: 'gunes', reminder: 'lavanta' };

  return (
    <section className="appt-page nt-page nt-v3" aria-labelledby="nt-title">
      <div className="screen-head">
        <h2 id="nt-title">
          <Icon as={BellRing} size={22} />
          Bildirimler
        </h2>
        {data && (
          <span className="nt-head-meta">
            {unseen ? `${unseen} yeni hareket` : 'Hepsi okundu'}
            <span aria-hidden="true"> · </span>
            {`${attention.length} konu dikkat istiyor`}
          </span>
        )}
      </div>
      {error && (
        <Banner tone="error" action={<Button onClick={() => setAttempt((n) => n + 1)}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}
      {!data && !error && <Spinner label="Bildirimler yükleniyor…" />}
      {data && (
        <div className="nt3">
          <aside className="nt3-side">
            <section className="nt3-card" aria-labelledby="nt3-att">
              <h3 id="nt3-att">Şimdi ilgilenin</h3>
              {attention.length ? (
                <ul className="nt3-att">
                  {attention.map((a) => (
                    <li key={a.key} className={`nt3-att-item is-${a.tone}`}>
                      <Icon as={a.tone === 'err' ? CircleAlert : TriangleAlert} size={18} />
                      <span>{a.text}</span>
                      <a href={a.link} aria-label={`${a.text}: git`}>
                        Git
                        <Icon as={ChevronRight} size={14} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="nt3-calm">
                  <Icon as={CheckCheck} size={18} />
                  Şu an ilgilenmeniz gereken bir şey yok.
                </p>
              )}
            </section>
            <nav className="nt3-card nt3-filters" aria-label="Hareket türü">
              <h3>Türe göre</h3>
              <div role="group" aria-label="Hareket türü">
                {FILTERS.map((f) => (
                  <button key={f.id} type="button" className={`tone-${tones[f.id]}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                    <span className="tone-tile tone-tile-sm" aria-hidden="true">
                      <Icon as={icons[f.id]} size={15} />
                    </span>
                    <span>{f.label}</span>
                    <span className="nt3-count">{counts[f.id]}</span>
                  </button>
                ))}
              </div>
            </nav>
          </aside>
          <section className="nt3-card nt3-feed" aria-labelledby="nt3-feed">
            <h3 id="nt3-feed">{`Hareketler · ${FILTERS.find((f) => f.id === filter)?.label}`}</h3>
            {shown.length === 0 ? (
              <EmptyState icon={BellRing}>Bu türde hareket yok.</EmptyState>
            ) : (
              days.map((day) => (
                <div key={day} className="nt3-day">
                  <h4>{dayGroup(Date.parse(`${day}T12:00:00Z`) - 3 * 3600e3, now) === 'Daha önce' ? formatDay(day, 'tr') : `${dayGroup(Date.parse(`${day}T12:00:00Z`) - 3 * 3600e3, now)} · ${formatDay(day, 'tr')}`}</h4>
                  <ol className="nt3-line">
                    {shown
                      .filter((e) => dayOf(e.at) === day)
                      .map((e) => {
                        const look = EVENT_LOOK[e.kind] ?? EVENT_LOOK.info;
                        return (
                          <li key={e.id} className={`nt3-ev tone-${look.tone}${e.at > seen ? ' is-new' : ''}`}>
                            <span className="nt3-dot" aria-hidden="true">
                              <Icon as={look.icon} size={14} />
                            </span>
                            <span className="nt3-ev-body">
                              {e.link ? <a href={e.link}>{e.text}</a> : <span>{e.text}</span>}
                              <span className="nt3-ev-meta">{look.label}</span>
                            </span>
                            <span className="nt3-ev-time">
                              {e.at > seen && <span className="nt3-new">Yeni</span>}
                              {timeOf(e.at)}
                            </span>
                          </li>
                        );
                      })}
                  </ol>
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </section>
  );
}
