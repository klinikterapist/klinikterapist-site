/**
 * Seans takip › one client (owner's request 2026-10-20): the last four sessions and the next four,
 * each marked by the owner — attended, no-show, cancelled or postponed (who asked, a note, and for a
 * postponement the new date, which takes its time in the calendar). The free sessions (the intro
 * call before therapy, the closing session at its end) look different. The owner adds the closing
 * session or a one-off extra here. Cancellations and postponements the client asks for on their
 * own page (still to come) will be written here the same way, marked "danışan istedi".
 * Owner's review 2026-10-20 (a4): no name, e-mail or language on this page — only the weekly time,
 * the session type and when therapy began; a chart of the sessions so far in percent, and a running
 * count ("7. seans") that goes on past the four shown.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type Client } from '../../api/types';
import { formatDay } from '../../../lib/booking-form';
import { FREE_KINDS, pastAndNext, sessionKey, sessionNumbers, sessionStats, type SessionRecord, type SessionStatus } from '../../../lib/sessions';
import { usePanel } from '../context';
import { CalendarCheck, Icon } from '../icons';
import { Banner, Button, Dialog, EmptyState, Field, Select, Spinner } from '../kit';
import { SESSION_KIND_LABEL, WEEKDAYS, labelOf, templateTimes } from './AppointmentCalendar';
import { SessionChart } from './SessionChart';

const STATUS_LABEL: Record<SessionStatus, string> = { planned: 'Planlandı', attended: 'Katıldı', noshow: 'Gelmedi', cancelled: 'İptal edildi', postponed: 'Ertelendi' };
const short = (day: string) => {
  const [d, m, , w] = formatDay(day, 'tr').split(/[ ,]+/);
  return { d, m: m.slice(0, 3), w };
};
const at = (s: { day: string; time: string }) => `${formatDay(s.day, 'tr')}, ${s.time.replace(':', '.')}`;

type Marking = { s: SessionRecord; status: 'cancelled' | 'postponed'; by: 'client' | 'owner'; note: string; day: string; time: string };
type Adding = { kind: 'closing' | 'extra'; day: string; time: string };

export function ClientPage({ id }: { id: string }) {
  const { api } = usePanel();
  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [marking, setMarking] = useState<Marking | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .clientsList()
      .then(({ clients }) => alive && setClient(clients.find((c) => c.id === id) ?? null))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Danışan yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, id]);

  const change = async (input: Parameters<typeof api.clientSession>[0], done: string) => {
    setBusy(true);
    setError(null);
    try {
      const { client } = await api.clientSession(input);
      setClient(client);
      setNotice(done);
      setMarking(null);
      setAdding(null);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Kaydedilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };
  const mark = (s: SessionRecord, status: SessionStatus) =>
    change({ op: 'mark', id, day: s.day, time: s.time, status }, status === 'planned' ? `${at(s)}: işaret kaldırıldı.` : `${at(s)}: ${STATUS_LABEL[status].toLocaleLowerCase('tr-TR')} olarak işaretlendi.`);

  if (client === undefined && !error) return <Spinner label="Danışan yükleniyor…" />;
  if (!client) {
    return (
      <section className="appt-page">
        {error && <Banner tone="error">{error}</Banner>}
        <EmptyState icon={CalendarCheck} action={<a href="#/seans-takip">← Seans takibe dön</a>}>
          Bu danışan bulunamadı. Takipten çıkarılmış olabilir.
        </EmptyState>
      </section>
    );
  }

  const now = Date.now();
  const { past, next } = pastAndNext(client, now);
  const stats = sessionStats(client, now);
  const numbers = sessionNumbers(client, next.at(-1)?.day ?? past.at(-1)?.day ?? client.since);
  const times = (day: string) => (day ? templateTimes(day) : []);

  const row = (s: SessionRecord, past: boolean) => {
    const { d, m, w } = short(s.day);
    const free = FREE_KINDS.includes(s.kind);
    const added = s.kind !== 'weekly';
    return (
      <li key={sessionKey(s)} className={`ss-row ss-${s.status}${free ? ' is-free' : ''}`}>
        <span className="ss-date" aria-hidden="true">
          <b>{d}</b>
          <span>{m}</span>
        </span>
        <span className="ss-what">
          <b>
            {w} · {s.time.replace(':', '.')}
            <span className="k-visually-hidden">{`, ${formatDay(s.day, 'tr')}`}</span>
          </b>
          <span className={`ss-kind${free ? ' is-free' : ''}`}>
            {numbers.has(sessionKey(s)) ? `${numbers.get(sessionKey(s))}. seans · ` : ''}
            {SESSION_KIND_LABEL[s.kind]}
          </span>
          {s.note && <span className="ss-note">{s.note}</span>}
        </span>
        <span className={`ss-status st-${s.status}`}>
          {s.status === 'planned' ? (past ? 'İşaretlenmedi' : 'Planlandı') : STATUS_LABEL[s.status]}
          {s.by && <small>{s.by === 'client' ? 'danışan istedi' : 'siz'}</small>}
          {s.movedTo && <small>{`→ ${short(s.movedTo.day).d} ${short(s.movedTo.day).m} ${s.movedTo.time.replace(':', '.')}`}</small>}
        </span>
        <span className="ss-actions">
          {s.status === 'planned' ? (
            <>
              {past && (
                <>
                  <Button variant="primary" disabled={busy} onClick={() => mark(s, 'attended')}>
                    Katıldı
                  </Button>
                  <Button disabled={busy} onClick={() => mark(s, 'noshow')}>
                    Gelmedi
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => setMarking({ s, status: 'cancelled', by: 'client', note: '', day: '', time: '' })}>
                İptal
              </Button>
              <Button variant="ghost" onClick={() => setMarking({ s, status: 'postponed', by: 'client', note: '', day: '', time: '' })}>
                Ertele
              </Button>
              {added && !s.from && (
                <Button variant="ghost" onClick={() => change({ op: 'remove', id, day: s.day, time: s.time }, `${at(s)} silindi.`)}>
                  Sil
                </Button>
              )}
            </>
          ) : (
            <Button variant="ghost" disabled={busy} onClick={() => mark(s, 'planned')}>
              İşareti kaldır
            </Button>
          )}
        </span>
      </li>
    );
  };

  return (
    <section className="appt-page client-page" aria-labelledby="cl-title">
      <a className="back-link" href="#/seans-takip">
        ← Seans takip
      </a>
      <header className="cl-hero">
        <span className="cl-badge" aria-hidden="true">
          <Icon as={CalendarCheck} size={26} />
        </span>
        <div className="cl-hero-text">
          <h2 id="cl-title">
            <span className="tk-number tk-number-lg">{client.number}</span>
            {client.status === 'closing' && <span className="tk-badge">Sonlandırma görüşmesi bekleniyor</span>}
          </h2>
          <p>{`${labelOf({ kind: 'session', type: client.type })} · bugüne kadar ${stats.held} seans`}</p>
        </div>
        <div className="head-actions">
          <Button onClick={() => setAdding({ kind: 'closing', day: '', time: '' })}>Sonlandırma görüşmesi ekle</Button>
          <Button onClick={() => setAdding({ kind: 'extra', day: '', time: '' })}>Ek seans ekle</Button>
        </div>
      </header>
      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <div className="appt-layout">
        <div className="appt-main">
          <div className="k-group">
            <h3 className="tk-group-title">{`Geçmiş seanslar (son ${past.length})`}</h3>
            {past.length ? <ul className="ss-list">{past.map((s) => row(s, true))}</ul> : <p className="k-hint">Henüz geçmiş seans yok.</p>}
          </div>
          <div className="k-group">
            <h3 className="tk-group-title">{`Sıradaki seanslar (${next.length})`}</h3>
            {next.length ? <ul className="ss-list">{next.map((s) => row(s, false))}</ul> : <p className="k-hint">Planlı seans yok.</p>}
          </div>
          <p className="k-hint">
            Geçmiş seansları "Katıldı" ya da "Gelmedi" diye işaretleyin. İptal ya da ertelenen bir seansın saati takvimde ve sitede açılır; ertelenen seansın yeni tarihi takvime
            işlenir. Danışanın kendi sayfasından yapacağı iptal ve erteleme talepleri (o sayfa açıldığında) buraya kendiliğinden "danışan istedi" diye yazılacak.
          </p>
        </div>
        <aside className="appt-side cl-side">
          <div className="k-group">
            <h3 className="tk-group-title">Seans bilgisi</h3>
            <dl className="cl-card cl-info">
              <div>
                <dt>Haftalık seans</dt>
                <dd>{`Her ${WEEKDAYS[client.weekday].toLocaleLowerCase('tr-TR')} ${client.time.replace(':', '.')}`}</dd>
              </div>
              <div>
                <dt>Görüşme türü</dt>
                <dd>{labelOf({ kind: 'session', type: client.type })}</dd>
              </div>
              <div>
                <dt>Terapiye başlangıç</dt>
                <dd>{formatDay(client.since, 'tr')}</dd>
              </div>
            </dl>
          </div>
          <div className="k-group">
            <h3 className="tk-group-title">Seans grafiği</h3>
            <SessionChart stats={stats} />
          </div>
        </aside>
      </div>

      {marking && (
        <Dialog
          title={`${at(marking.s)}: ${marking.status === 'cancelled' ? 'iptal' : 'ertele'}`}
          history
          onClose={() => !busy && setMarking(null)}
          actions={
            <>
              <Button onClick={() => setMarking(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button
                variant="primary"
                busy={busy}
                disabled={marking.status === 'postponed' && !!marking.day && !marking.time}
                onClick={() =>
                  change(
                    { op: 'mark', id, day: marking.s.day, time: marking.s.time, status: marking.status, by: marking.by, note: marking.note, ...(marking.day && marking.time ? { newDay: marking.day, newTime: marking.time } : {}) },
                    marking.status === 'cancelled' ? `${at(marking.s)} iptal edildi; saat açıldı.` : `${at(marking.s)} ertelendi${marking.day && marking.time ? `: yeni tarih ${at(marking)}` : ''}.`,
                  )
                }
              >
                Kaydet
              </Button>
            </>
          }
        >
          <div className="segmented end-choice" role="group" aria-label="Kim istedi">
            <button type="button" aria-pressed={marking.by === 'client'} onClick={() => setMarking({ ...marking, by: 'client' })}>
              Danışan istedi
            </button>
            <button type="button" aria-pressed={marking.by === 'owner'} onClick={() => setMarking({ ...marking, by: 'owner' })}>
              Ben {marking.status === 'cancelled' ? 'iptal ettim' : 'erteledim'}
            </button>
          </div>
          {marking.status === 'postponed' && (
            <div className="add-grid">
              <Field label="Yeni tarih (isteğe bağlı)" type="date" value={marking.day} onChange={(day) => setMarking({ ...marking, day, time: '' })} />
              <Select
                label="Yeni saat"
                value={marking.time}
                options={[{ value: '', label: marking.day ? 'Saat seçin…' : 'Önce tarih seçin' }, ...times(marking.day).map((x) => ({ value: x, label: x.replace(':', '.') }))]}
                onChange={(time) => setMarking({ ...marking, time })}
              />
            </div>
          )}
          <Field label="Not (isteğe bağlı)" value={marking.note} onChange={(note) => setMarking({ ...marking, note })} maxLength={300} />
          <p className="k-hint">Bu seansın saati takvimde ve sitede açılır. Kişiye e-posta gitmez.</p>
        </Dialog>
      )}

      {adding && (
        <Dialog
          title={adding.kind === 'closing' ? 'Sonlandırma görüşmesi ekle' : 'Ek seans ekle'}
          history
          onClose={() => !busy && setAdding(null)}
          actions={
            <>
              <Button onClick={() => setAdding(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button
                variant="primary"
                busy={busy}
                disabled={!adding.day || !adding.time}
                onClick={() => change({ op: 'add', id, kind: adding.kind, day: adding.day, time: adding.time }, `${at(adding)} eklendi; takvime işlendi.`)}
              >
                Ekle
              </Button>
            </>
          }
        >
          <p>{adding.kind === 'closing' ? 'Ücretsiz, 25–30 dakikalık sonlandırma görüşmesi. Seans listesinde ve takvimde ücretsiz görüşme olarak görünür.' : 'Haftalık seansın dışında tek seferlik bir seans.'}</p>
          <div className="add-grid">
            <Field label="Tarih" type="date" value={adding.day} onChange={(day) => setAdding({ ...adding, day, time: '' })} />
            <Select
              label="Saat"
              value={adding.time}
              options={[{ value: '', label: adding.day ? 'Saat seçin…' : 'Önce tarih seçin' }, ...times(adding.day).map((x) => ({ value: x, label: x.replace(':', '.') }))]}
              onChange={(time) => setAdding({ ...adding, time })}
            />
          </div>
        </Dialog>
      )}
    </section>
  );
}
