/**
 * Randevular › Talepler (owner's design 2026-10-20): requests from the site's booking and intro-call
 * forms. Onayla / Uygun değilim / İptal et open the ready, personal e-mail for editing; Gönder sends
 * it and applies the decision (declined and cancelled requests are deleted with their details).
 * Approved ones wait for "Randevu takibine geçir": a booking keeps the weekday and time the person
 * chose, an intro call asks the owner for the weekly day and time. Moving deletes the person's
 * details; the client is a number from then on.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type BookingRequest, type Client, type RequestDecision } from '../../api/types';
import { AGE_RANGES, INTRO_FOR, INTRO_TOPICS, formatDay } from '../../../lib/booking-form';
import { decisionMail } from '../../lib/booking-mail';
import { usePanel } from '../context';
import { Inbox } from '../icons';
import { Banner, Button, Dialog, EmptyState, Field, Select, Spinner } from '../kit';
import { WEEKDAYS, labelOf, templateTimes } from './CalendarTab';

const KEEP_DAYS = 30;
const HOLD_H = 24;
const DECISION_LABEL: Record<RequestDecision, string> = { approve: 'Onayla', unavailable: 'Uygun değilim', cancel: 'İptal et' };
const DECISION_TITLE: Record<RequestDecision, string> = { approve: 'Onay e-postası', unavailable: '"Uygun değilim" e-postası', cancel: 'İptal e-postası' };

const titleOf = (r: BookingRequest) => (r.kind === 'intro' ? 'Ücretsiz ön görüşme talebi' : `Randevu talebi · ${labelOf(r)}`);
const whenOf = (r: BookingRequest) => `${formatDay(r.day, 'tr')}, ${r.time.replace(':', '.')}`;
const daysLeft = (r: BookingRequest) => Math.max(0, KEEP_DAYS - Math.floor((Date.now() - r.createdAt) / (24 * 3600e3)));

/** The next date on or after today that falls on `weekday` (`YYYY-MM-DD`, Istanbul). */
function nextWeekday(weekday: number): string {
  const d = new Date(Date.now() + 3 * 3600e3);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function Details({ r }: { r: BookingRequest }) {
  const forWhom = INTRO_FOR.find((f) => f.id === r.forWhom);
  return (
    <dl className="req-details">
      <div>
        <dt>İstenen zaman</dt>
        <dd>{whenOf(r)}</dd>
      </div>
      <div>
        <dt>Ad soyad</dt>
        <dd>{r.name}</dd>
      </div>
      <div>
        <dt>E-posta</dt>
        <dd>
          <a href={`mailto:${r.email}`}>{r.email}</a>
        </dd>
      </div>
      <div>
        <dt>Telefon</dt>
        <dd>
          <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>{r.phone}</a>
        </dd>
      </div>
      {r.kind === 'intro' && (
        <>
          {forWhom && (
            <div>
              <dt>Kimin için</dt>
              <dd>{forWhom.tr}</dd>
            </div>
          )}
          <div>
            <dt>Konular</dt>
            <dd>{(r.topics ?? []).map((i) => INTRO_TOPICS.tr[i]).join(', ') || '—'}</dd>
          </div>
          <div>
            <dt>Daha önce destek</dt>
            <dd>{r.before === 'yes' ? 'Evet' : r.before === 'no' ? 'Hayır' : 'Belirtmedi'}</dd>
          </div>
          <div>
            <dt>Yaş aralığı</dt>
            <dd>{AGE_RANGES.tr[r.age ?? -1] ?? '—'}</dd>
          </div>
        </>
      )}
      {r.note && (
        <div className="req-note">
          <dt>Not</dt>
          <dd>{r.note}</dd>
        </div>
      )}
      <div>
        <dt>Sayfa dili</dt>
        <dd>{r.lang === 'en' ? 'İngilizce (e-posta İngilizce gider)' : 'Türkçe'}</dd>
      </div>
    </dl>
  );
}

export function RequestsTab({ onMoved }: { onMoved: (c: Client) => void }) {
  const { api } = usePanel();
  const [requests, setRequests] = useState<BookingRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [deciding, setDeciding] = useState<{ r: BookingRequest; decision: RequestDecision; subject: string; body: string } | null>(null);
  const [moving, setMoving] = useState<{ r: BookingRequest; weekday: number; time: string; since: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .requestsList()
      .then(({ requests }) => alive && setRequests(requests))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Talepler yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);
  const reload = () => setAttempt((n) => n + 1);

  const open = (r: BookingRequest, decision: RequestDecision) => setDeciding({ r, decision, ...decisionMail(r, decision) });

  const send = async () => {
    if (!deciding) return;
    setBusy(true);
    setError(null);
    try {
      await api.requestDecide({ id: deciding.r.id, decision: deciding.decision, subject: deciding.subject, body: deciding.body });
      setNotice(
        deciding.decision === 'approve'
          ? `E-posta gönderildi ve ${whenOf(deciding.r)} takvime işlendi. Kişiyi "Randevu takibine geçir" ile takibe alabilirsiniz.`
          : `E-posta gönderildi. Talep ve kişinin bilgileri silindi; saat sitede yeniden açık.`,
      );
      setDeciding(null);
      reload();
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'E-posta gönderilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const move = async () => {
    if (!moving) return;
    setBusy(true);
    setError(null);
    try {
      const { client } = await api.requestToClient(
        moving.r.kind === 'intro' ? { id: moving.r.id, weekday: moving.weekday, time: moving.time, since: moving.since } : { id: moving.r.id },
      );
      setMoving(null);
      onMoved(client);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Takibe geçirilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const pending = (requests ?? []).filter((r) => r.status === 'pending');
  const approved = (requests ?? []).filter((r) => r.status === 'approved');
  const weekdayTimes = moving ? templateTimes(nextWeekday(moving.weekday), 'session') : [];

  return (
    <div className="appt-tab">
      <p className="k-hint">
        Siteden gelen talepler burada. Kararınızı verdiğinizde kişiye hazır bir e-posta gider; göndermeden önce metni düzeltebilirsiniz. Reddedilen ve iptal edilen taleplerin bilgileri
        hemen, onaylananlarınki takibe geçirilince silinir; hiçbiri {KEEP_DAYS} günden uzun tutulmaz.
      </p>
      {notice && <Banner tone="success">{notice}</Banner>}
      {error && (
        <Banner tone="error" action={<Button onClick={reload}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}
      {!requests && !error && <Spinner label="Talepler yükleniyor…" />}

      {requests && (
        <>
          <h3 className="home-section-title">{`Yeni talepler (${pending.length})`}</h3>
          {pending.length === 0 ? (
            <EmptyState icon={Inbox}>Bekleyen talep yok.</EmptyState>
          ) : (
            <ul className="req-list">
              {pending.map((r) => (
                <li key={r.id} className="req-card">
                  <div className="req-head">
                    <b>{titleOf(r)}</b>
                    <span className="badge badge-planned">{`Saat ${HOLD_H} saat tutuluyor`}</span>
                  </div>
                  <Details r={r} />
                  <div className="row">
                    <Button variant="primary" onClick={() => open(r, 'approve')}>
                      Onayla
                    </Button>
                    <Button onClick={() => open(r, 'unavailable')}>Uygun değilim</Button>
                    <Button variant="ghost" onClick={() => open(r, 'cancel')}>
                      İptal et
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3 className="home-section-title">{`Onaylananlar (${approved.length})`}</h3>
          {approved.length === 0 ? (
            <p className="k-hint">Takibe geçirilmeyi bekleyen onaylı talep yok.</p>
          ) : (
            <ul className="req-list">
              {approved.map((r) => (
                <li key={r.id} className="req-card">
                  <div className="req-head">
                    <b>{titleOf(r)}</b>
                    <span className="badge badge-live">Onaylandı</span>
                    <span className="k-hint">{`${daysLeft(r)} gün içinde takibe geçirilmezse bilgiler silinir.`}</span>
                  </div>
                  <Details r={r} />
                  <div className="row">
                    <Button
                      variant="primary"
                      onClick={() => {
                        const weekday = r.kind === 'session' ? new Date(`${r.day}T12:00:00Z`).getUTCDay() : 1;
                        setMoving({ r, weekday, time: '', since: nextWeekday(weekday) });
                      }}
                    >
                      Randevu takibine geçir
                    </Button>
                    <Button variant="ghost" onClick={() => open(r, 'cancel')}>
                      İptal et
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {deciding && (
        <Dialog
          title={DECISION_TITLE[deciding.decision]}
          history
          onClose={() => !busy && setDeciding(null)}
          actions={
            <>
              <Button onClick={() => setDeciding(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant={deciding.decision === 'approve' ? 'primary' : 'danger'} busy={busy} onClick={send}>
                {`${DECISION_LABEL[deciding.decision]} ve gönder`}
              </Button>
            </>
          }
        >
          <p className="k-hint">{`Alıcı: ${deciding.r.name} <${deciding.r.email}>. Metni gönderiminden önce düzeltebilirsiniz.`}</p>
          <div className="stack">
            <Field label="Konu" value={deciding.subject} onChange={(subject) => setDeciding({ ...deciding, subject })} maxLength={200} />
            <Field label="E-posta metni" multiline rows={12} value={deciding.body} onChange={(body) => setDeciding({ ...deciding, body })} maxLength={5000} />
          </div>
        </Dialog>
      )}

      {moving && (
        <Dialog
          title="Randevu takibine geçir"
          history
          onClose={() => !busy && setMoving(null)}
          actions={
            <>
              <Button onClick={() => setMoving(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="primary" busy={busy} disabled={moving.r.kind === 'intro' && !moving.time} onClick={move}>
                Takibe geçir
              </Button>
            </>
          }
        >
          {moving.r.kind === 'session' ? (
            <p>{`${moving.r.name}, her ${WEEKDAYS[moving.weekday].toLocaleLowerCase('tr-TR')} ${moving.r.time.replace(':', '.')}'de haftalık ${labelOf(moving.r).replace(/ \(.*\)$/, '').toLocaleLowerCase('tr-TR')} seansına alınacak (ilk seans ${whenOf(moving.r)}).`}</p>
          ) : (
            <>
              <p>{`${moving.r.name} için haftalık seans günü ve saatini seçin.`}</p>
              <div className="stack">
                <Select
                  label="Gün"
                  value={String(moving.weekday)}
                  options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: WEEKDAYS[d] }))}
                  onChange={(v) => setMoving({ ...moving, weekday: Number(v), time: '', since: nextWeekday(Number(v)) })}
                />
                <Select
                  label="Saat"
                  value={moving.time}
                  options={[{ value: '', label: weekdayTimes.length ? 'Saat seçin…' : 'Bu gün seans saati yok' }, ...weekdayTimes.map((t) => ({ value: t, label: t.replace(':', '.') }))]}
                  onChange={(time) => setMoving({ ...moving, time })}
                />
                <Field label="İlk seans tarihi" type="date" value={moving.since} onChange={(since) => setMoving({ ...moving, since })} />
              </div>
            </>
          )}
          <p className="k-hint">Geçirince kişinin adı, e-postası, telefonu, notu ve konuları panelden silinir; yerine bir danışan numarası (D-001 gibi) verilir. Haftalık seans her hafta takvimi doldurur.</p>
        </Dialog>
      )}
    </div>
  );
}
