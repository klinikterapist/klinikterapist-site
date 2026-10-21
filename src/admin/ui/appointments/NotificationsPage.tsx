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
import { BellRing, Icon } from '../icons';
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
const timeOf = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(11, 16).replace(':', '.');

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

  return (
    <section className="appt-page" aria-labelledby="nt-title">
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
        <div className="nt-layout">
          <div className="k-group">
            <h3 className="tk-group-title">{`Dikkat isteyenler (${attention.length})`}</h3>
            {attention.length ? (
              <ul className="nt-list">
                {attention.map((a) => (
                  <li key={a.key} className={`nt-item nt-${a.tone}`}>
                    <a href={a.link}>{a.text}</a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-hint">Şu an ilgilenmeniz gereken bir şey yok.</p>
            )}
          </div>
          <div className="k-group">
            <h3 className="tk-group-title">Hareketler</h3>
            <div className="segmented" role="group" aria-label="Hareket türü">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <EmptyState icon={BellRing}>Bu türde hareket yok.</EmptyState>
            ) : (
              days.map((day) => (
                <div key={day} className="nt-day">
                  <h4>{formatDay(day, 'tr')}</h4>
                  <ul className="nt-list">
                    {shown
                      .filter((e) => dayOf(e.at) === day)
                      .map((e) => (
                        <li key={e.id} className={`nt-item nt-kind-${e.kind}${e.at > seen ? ' is-new' : ''}`}>
                          <span className="nt-time">{timeOf(e.at)}</span>
                          {e.link ? <a href={e.link}>{e.text}</a> : <span>{e.text}</span>}
                          {e.at > seen && <span className="nt-new">yeni</span>}
                        </li>
                      ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
