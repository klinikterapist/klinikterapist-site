/**
 * Bildirimler (owner's decision 2026-10-20, Faz 2): first what needs attention now (worked out from
 * the clients and the requests: lib/attention.ts), then what happened (the backend's event stream),
 * by day, newest first, with a filter by kind. Events newer than the last visit are marked "yeni"
 * (the time of the last visit stays in this browser only).
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type BookingRequest, type Client, type PanelEvent, type PanelEventKind } from '../../api/types';
import { formatDay } from '../../../lib/booking-form';
import { attentionOf } from '../../lib/attention';
import { usePanel } from '../context';
import { Activity, BellDot, BellRing, CheckCheck, CircleAlert, Icon, TriangleAlert } from '../icons';
import { EventRow } from '../NotificationBell';
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
  }, [api, attempt]);

  const now = Date.now();
  const attention = data ? attentionOf(data.clients, data.requests, now) : [];
  const kinds = FILTERS.find((f) => f.id === filter)?.kinds;
  const shown = (data?.events ?? []).filter((e) => !kinds || kinds.includes(e.kind));
  const days = [...new Set(shown.map((e) => dayOf(e.at)))];

  // The last 14 days' events, for the activity strip.
  const strip = Array.from({ length: 14 }, (_, i) => {
    const d = dayOf(now - (13 - i) * 864e5);
    return { day: d, count: (data?.events ?? []).filter((e) => dayOf(e.at) === d).length };
  });
  const peak = Math.max(1, ...strip.map((x) => x.count));
  const unseen = (data?.events ?? []).filter((e) => e.at > seen).length;
  const today = strip[13].count;

  return (
    <section className="appt-page nt-page" aria-labelledby="nt-title">
      <div className="screen-head">
        <h2 id="nt-title">
          <Icon as={BellRing} size={22} />
          Bildirimler
        </h2>
      </div>
      <p className="settings-intro">Şu an ilgilenmeniz gerekenler ve son 90 günde olanlar. Kişiler baş harfleriyle ya da danışan numarasıyla görünür.</p>
      {error && (
        <Banner tone="error" action={<Button onClick={() => setAttempt((n) => n + 1)}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}
      {!data && !error && <Spinner label="Bildirimler yükleniyor…" />}
      {data && (
        <>
          <ul className="v2-tiles" aria-label="Özet">
            <li className="v2-tile tone-kiremit">
              <span className="tone-tile" aria-hidden="true">
                <Icon as={CircleAlert} size={18} />
              </span>
              <b>{attention.length}</b>
              <span>Dikkat isteyen</span>
            </li>
            <li className="v2-tile tone-gunes">
              <span className="tone-tile" aria-hidden="true">
                <Icon as={BellDot} size={18} />
              </span>
              <b>{unseen}</b>
              <span>Son ziyaretten beri yeni</span>
            </li>
            <li className="v2-tile tone-adacayi">
              <span className="tone-tile" aria-hidden="true">
                <Icon as={Activity} size={18} />
              </span>
              <b>{today}</b>
              <span>Bugünkü hareket</span>
            </li>
            <li className="v2-tile v2-tile-chart tone-deniz">
              <span className="v2-tile-label">Son 14 gün</span>
              <span className="nt-strip" role="img" aria-label={`Son 14 günde ${strip.reduce((a, x) => a + x.count, 0)} hareket`}>
                {strip.map((x) => (
                  <i key={x.day} style={{ height: `${Math.max(6, (x.count / peak) * 100)}%` }} className={x.count ? '' : 'is-zero'} title={`${formatDay(x.day, 'tr')}: ${x.count}`} />
                ))}
              </span>
            </li>
          </ul>
          <div className="nt-layout">
            <div className="k-group">
              <h3 className="tk-group-title">{`Dikkat isteyenler (${attention.length})`}</h3>
              {attention.length ? (
                <ul className="nt-att-list">
                  {attention.map((a) => (
                    <li key={a.key} className={`nt-att nt-att-${a.tone}`}>
                      <Icon as={a.tone === 'err' ? CircleAlert : TriangleAlert} size={18} />
                      <a href={a.link}>{a.text}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={CheckCheck}>Şu an ilgilenmeniz gereken bir şey yok.</EmptyState>
              )}
            </div>
            <div className="k-group">
              <div className="nt-head">
                <h3 className="tk-group-title">Hareketler</h3>
                <div className="segmented" role="group" aria-label="Hareket türü">
                  {FILTERS.map((f) => (
                    <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {shown.length === 0 ? (
                <EmptyState icon={BellRing}>Bu türde hareket yok.</EmptyState>
              ) : (
                days.map((day) => (
                  <div key={day} className="nt-day">
                    <h4>{formatDay(day, 'tr')}</h4>
                    <ul className="ev-list">
                      {shown
                        .filter((e) => dayOf(e.at) === day)
                        .map((e) => (
                          <EventRow key={e.id} e={e} isNew={e.at > seen} now={now} />
                        ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
