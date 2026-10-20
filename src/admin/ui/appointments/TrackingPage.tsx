/**
 * Seans takip (owner's design 2026-10-20, review a5): clients by number (KT001OGO), beside the
 * appointment calendar. Under "Aktif danışanlar", those with a session today first, then "Yaklaşan
 * seanslar", always the nearest session first; then the clients in their closing stage. A row shows
 * only the number, the next session and the way to the client's page, where everything else is
 * (Terapiyi sonlandır, Geri al, Sil included). Top right: the date and time now and "Ücret ve ödeme"
 * (Faz 1), with a reminder when the fees are for an earlier year.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type Client } from '../../api/types';
import { formatDay } from '../../../lib/booking-form';
import { pastAndNext, sessionKey, type SessionRecord } from '../../../lib/sessions';
import { usePanel } from '../context';
import { CalendarCheck, ChevronRight, Clock, Icon } from '../icons';
import { Banner, Button, EmptyState, Spinner } from '../kit';
import { feesOutdated, type PaymentSettings } from '../../../lib/payment';
import { PaymentDialog } from './PaymentDialog';
import { AppointmentCalendar, WEEKDAYS, labelOf } from './AppointmentCalendar';

export const weeklyText = (c: Pick<Client, 'weekday' | 'time' | 'type'>) =>
  `Her ${WEEKDAYS[c.weekday].toLocaleLowerCase('tr-TR')} ${c.time.replace(':', '.')} · ${labelOf({ kind: 'session', type: c.type })}`;

const istanbulDay = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);

/** The client's next session that still takes place (cancelled and postponed ones skipped). */
export function nextSession(c: Client, now: number): SessionRecord | undefined {
  return pastAndNext(c, now, 8).next.find((s) => s.status === 'planned');
}

/** "Bugün, 18.00" / "Yarın, 18.00" / "27 Ekim 2026, Salı · 18.00". */
export function whenText(s: { day: string; time: string }, now: number): string {
  const today = istanbulDay(now);
  const tomorrow = istanbulDay(now + 864e5);
  const time = s.time.replace(':', '.');
  return s.day === today ? `Bugün, ${time}` : s.day === tomorrow ? `Yarın, ${time}` : `${formatDay(s.day, 'tr')} · ${time}`;
}

/** The date and time now, moving on every 20 seconds: "20 Ekim 2026, Salı · 11.05". */
export function NowClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20e3);
    return () => clearInterval(t);
  }, []);
  const iso = new Date(now + 3 * 3600e3).toISOString();
  return (
    <span className="now-clock" aria-label="Şu an">
      <Icon as={Clock} size={18} />
      <span>{formatDay(iso.slice(0, 10), 'tr')}</span>
      <b>{iso.slice(11, 16).replace(':', '.')}</b>
    </span>
  );
}

export function TrackingPage() {
  const { api } = usePanel();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [payment, setPayment] = useState<PaymentSettings | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .paymentGet()
      .then(({ payment }) => alive && setPayment(payment))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api]);

  useEffect(() => {
    let alive = true;
    api
      .clientsList()
      .then(({ clients }) => alive && setClients(clients))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Danışanlar yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const now = Date.now();
  const today = istanbulDay(now);
  // Nearest first; a client with no planned session goes last.
  const withNext = (clients ?? [])
    .map((c) => ({ c, next: nextSession(c, now) }))
    .sort((a, b) => (a.next ? sessionKey(a.next) : '~').localeCompare(b.next ? sessionKey(b.next) : '~'));
  const active = withNext.filter((x) => x.c.status !== 'closing');
  const todays = active.filter((x) => x.next?.day === today);
  const coming = active.filter((x) => x.next?.day !== today);
  const closing = withNext.filter((x) => x.c.status === 'closing');

  const row = ({ c, next }: { c: Client; next?: SessionRecord }) => (
    <li key={c.id} className="tk-row">
      <span className="tk-number">{c.number}</span>
      <span className="tk-what">
        <b>{next ? whenText(next, now) : 'Planlı seans yok'}</b>
        <span>{next ? `Sıradaki seans · ${weeklyText(c)}` : weeklyText(c)}</span>
      </span>
      <a className="k-btn k-btn-secondary tk-go" href={`#/seans-takip/${c.id}`} aria-label={`${c.number}: danışanın sayfasına git`}>
        Sayfasına git
        <Icon as={ChevronRight} size={16} />
      </a>
    </li>
  );

  return (
    <section className="appt-page" aria-labelledby="tk-title">
      <div className="screen-head">
        <h2 id="tk-title">
          <Icon as={CalendarCheck} size={22} />
          Seans takip
        </h2>
        <div className="head-actions">
          <NowClock />
          <Button onClick={() => setPaying(true)}>Ücret ve ödeme</Button>
        </div>
      </div>
      <p className="settings-intro">
        Seans takipteki danışanlar, en yakın seanstan başlayarak. Danışanlar numarayla görünür. Seansları işaretlemek, terapiyi sonlandırmak ya da geri almak için danışanın sayfasına gidin.
      </p>

      <div className="appt-layout">
        <div className="appt-main">
          {payment && feesOutdated(payment, now) && (
            <Banner tone="warning" action={<Button onClick={() => setPaying(true)}>Ücretleri girin</Button>}>
              {payment.year
                ? `Ücretler ${payment.year} yılı için girilmiş. Yeni yılın ücretlerini girin; hatırlatma ve onay e-postaları bunları kullanır.`
                : 'Ücret ve ödeme bilgileri henüz girilmedi. Onay ve hatırlatma e-postaları ücret yerine "ödeme bilgilerini ayrıca ileteceğim" der.'}
            </Banner>
          )}
          {error && (
            <Banner tone="error" action={<Button onClick={() => setAttempt((n) => n + 1)}>Tekrar dene</Button>}>
              {error}
            </Banner>
          )}
          {!clients && !error && <Spinner label="Danışanlar yükleniyor…" />}
          {clients && clients.length === 0 && (
            <EmptyState icon={CalendarCheck}>Seans takipte danışan yok. Onaylanan talepleri Randevu talepleri sayfasından buraya geçirebilirsiniz.</EmptyState>
          )}
          {active.length > 0 && (
            <div className="k-group tk-active">
              <h3 className="tk-group-title">{`Aktif danışanlar (${active.length})`}</h3>
              <h4 className="tk-sub-title">{`Bugün (${todays.length})`}</h4>
              {todays.length ? <ul className="tk-list">{todays.map(row)}</ul> : <p className="k-hint">Bugün seans yok.</p>}
              {coming.length > 0 && (
                <>
                  <h4 className="tk-sub-title">{`Yaklaşan seanslar (${coming.length})`}</h4>
                  <ul className="tk-list">{coming.map(row)}</ul>
                </>
              )}
            </div>
          )}
          {closing.length > 0 && (
            <div className="k-group">
              <h3 className="tk-group-title">{`Sonlandırma aşamasında (${closing.length})`}</h3>
              <ul className="tk-list">{closing.map(row)}</ul>
            </div>
          )}
        </div>
        <aside className="appt-side">
          <AppointmentCalendar version={attempt} />
        </aside>
      </div>
      {paying && <PaymentDialog onClose={() => setPaying(false)} onSaved={setPayment} />}
    </section>
  );
}
