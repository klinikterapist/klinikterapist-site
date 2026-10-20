/**
 * Randevu talepleri (owner's design 2026-10-20): requests from the site's booking and intro-call
 * forms, beside the appointment calendar. Onayla / Uygun değilim / İptal et open the ready,
 * personal e-mail for editing; sending it applies the decision (declined and cancelled requests are
 * deleted with their details). Approved ones wait for "Seans takibe geçir" — a booking keeps the
 * weekday and time the person chose, an intro call asks the owner — or "Geri al" when the approval
 * went by mistake (an apology e-mail, and the request is pending again).
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type BookingRequest, type Client, type RequestDecision } from '../../api/types';
import { AGE_RANGES, INTRO_FOR, INTRO_TOPICS, clientNumber, formatDay } from '../../../lib/booking-form';
import { decisionMail, revertMail, type Mail } from '../../lib/booking-mail';
import { usePanel } from '../context';
import { Icon, Inbox } from '../icons';
import { Banner, Button, Dialog, EmptyState, Field, Select, Spinner } from '../kit';
import { AppointmentCalendar, WEEKDAYS, labelOf, templateTimes } from './AppointmentCalendar';
import { MailDialog } from './MailDialog';

const KEEP_DAYS = 30;
const DECISION_SEND: Record<RequestDecision, string> = { approve: 'Onayla ve gönder', unavailable: 'Uygun değilim ve gönder', cancel: 'İptal et ve gönder' };
const DECISION_TITLE: Record<RequestDecision, string> = { approve: 'Onay e-postası', unavailable: '"Uygun değilim" e-postası', cancel: 'İptal e-postası' };

const titleOf = (r: BookingRequest) => (r.kind === 'intro' ? 'Ücretsiz ön görüşme talebi' : `Randevu talebi · ${labelOf(r)}`);
const whenOf = (r: BookingRequest) => `${formatDay(r.day, 'tr')}, ${r.time.replace(':', '.')}`;
const daysLeft = (r: BookingRequest) => Math.max(0, KEEP_DAYS - Math.floor((Date.now() - r.createdAt) / (24 * 3600e3)));
export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');
const weekly = (weekday: number, time: string) => `her ${WEEKDAYS[weekday].toLocaleLowerCase('tr-TR')} ${time.replace(':', '.')}`;

/** The next date on or after today that falls on `weekday` (`YYYY-MM-DD`, Istanbul). */
function nextWeekday(weekday: number): string {
  const d = new Date(Date.now() + 3 * 3600e3);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function Row({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'is-wide' : undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function RequestCard({ r, children }: { r: BookingRequest; children: React.ReactNode }) {
  const forWhom = INTRO_FOR.find((f) => f.id === r.forWhom);
  const [d, mon] = formatDay(r.day, 'tr').split(/[ ,]+/);
  return (
    <li className="rq-card">
      <header className="rq-head">
        <span className="rq-avatar" aria-hidden="true">
          {initialsOf(r.name)}
        </span>
        <span className="rq-who">
          <b>{r.name}</b>
          <span>{titleOf(r)}</span>
        </span>
        <span className="rq-when" aria-label={`İstenen zaman: ${whenOf(r)}`}>
          <b>
            {d} {mon}
          </b>
          <span>
            {formatDay(r.day, 'tr').split(', ')[1]} · {r.time.replace(':', '.')}
          </span>
        </span>
      </header>
      <dl className="rq-rows">
        <Row label="İstenen zaman">{whenOf(r)}</Row>
        <Row label="E-posta">
          <a href={`mailto:${r.email}`}>{r.email}</a>
        </Row>
        <Row label="Telefon">
          <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>{r.phone}</a>
        </Row>
        {r.kind === 'intro' && (
          <>
            {forWhom && <Row label="Kimin için">{forWhom.tr}</Row>}
            <Row label="Konular">{(r.topics ?? []).map((i) => INTRO_TOPICS.tr[i]).join(', ') || '—'}</Row>
            <Row label="Daha önce destek">{r.before === 'yes' ? 'Evet' : r.before === 'no' ? 'Hayır' : 'Belirtmedi'}</Row>
            <Row label="Yaş aralığı">{AGE_RANGES.tr[r.age ?? -1] ?? '—'}</Row>
          </>
        )}
        {r.note && (
          <Row label="Not" wide>
            {r.note}
          </Row>
        )}
        <Row label="Sayfa dili">{r.lang === 'en' ? 'İngilizce (e-postalar İngilizce gider)' : 'Türkçe'}</Row>
      </dl>
      {children}
    </li>
  );
}

type Sending = { title: string; send: string; tone: 'primary' | 'danger'; r: BookingRequest; mail: Mail; run: (m: Mail) => Promise<string> };

export function RequestsPage({ add }: { add: { day: string; time: string; type: string } | null }) {
  const { api } = usePanel();
  const [requests, setRequests] = useState<BookingRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; link?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<'pending' | 'approved'>('pending');
  const [sending, setSending] = useState<Sending | null>(null);
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

  const decide = (r: BookingRequest, decision: RequestDecision) =>
    setSending({
      title: DECISION_TITLE[decision],
      send: DECISION_SEND[decision],
      tone: decision === 'approve' ? 'primary' : 'danger',
      r,
      mail: decisionMail(r, decision),
      run: async (m) => {
        await api.requestDecide({ id: r.id, decision, ...m });
        return decision === 'approve'
          ? `E-posta gönderildi ve ${whenOf(r)} takvime işlendi. Kişiyi "Onaylanan" bölümünden Seans takibe geçirebilirsiniz.`
          : 'E-posta gönderildi. Talep ve kişinin bilgileri silindi; saat sitede yeniden açık.';
      },
    });

  const revert = (r: BookingRequest) =>
    setSending({
      title: 'Geri al: özür e-postası',
      send: 'Gönder ve geri al',
      tone: 'primary',
      r,
      mail: revertMail(r),
      run: async (m) => {
        await api.requestRevert({ id: r.id, ...m });
        setView('pending');
        return 'Özür e-postası gönderildi. Talep yeniden "Bekleyen" bölümünde; onaylı saat takvimden kaldırıldı.';
      },
    });

  const send = async () => {
    if (!sending) return;
    setBusy(true);
    setError(null);
    try {
      setNotice({ text: await sending.run(sending.mail) });
      setSending(null);
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
      const { client }: { client: Client } = await api.requestToClient(
        moving.r.kind === 'intro' ? { id: moving.r.id, weekday: moving.weekday, time: moving.time, since: moving.since } : { id: moving.r.id },
      );
      setNotice({ text: `${moving.r.name}, ${client.number} numarasıyla Seans takibe alındı: ${weekly(client.weekday, client.time)}.`, link: true });
      setMoving(null);
      reload();
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Seans takibe geçirilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const pending = (requests ?? []).filter((r) => r.status === 'pending');
  const approved = (requests ?? []).filter((r) => r.status === 'approved');
  const shown = view === 'pending' ? pending : approved;
  const weekdayTimes = moving ? templateTimes(nextWeekday(moving.weekday), 'session') : [];

  return (
    <section className="appt-page" aria-labelledby="req-title">
      <div className="screen-head">
        <h2 id="req-title">
          <Icon as={Inbox} size={22} />
          Randevu talepleri
        </h2>
      </div>
      <p className="settings-intro">
        Siteden gelen randevu ve ön görüşme talepleri. Kararınızı verdiğinizde kişiye hazır bir e-posta gider. Reddedilen ve iptal edilen taleplerin bilgileri hemen silinir. Hiçbir
        talep {KEEP_DAYS} günden uzun tutulmaz.
      </p>

      <div className="appt-layout">
        <div className="appt-main">
          <div className="segmented" role="group" aria-label="Talepler">
            <button type="button" aria-pressed={view === 'pending'} onClick={() => setView('pending')}>
              {`Bekleyen (${pending.length})`}
            </button>
            <button type="button" aria-pressed={view === 'approved'} onClick={() => setView('approved')}>
              {`Onaylanan (${approved.length})`}
            </button>
          </div>
          {notice && (
            <Banner tone="success" action={notice.link ? <a href="#/seans-takip">Seans takibe git →</a> : undefined}>
              {notice.text}
            </Banner>
          )}
          {error && (
            <Banner tone="error" action={<Button onClick={reload}>Tekrar dene</Button>}>
              {error}
            </Banner>
          )}
          {!requests && !error && <Spinner label="Talepler yükleniyor…" />}

          {requests && shown.length === 0 && (
            <EmptyState icon={Inbox}>{view === 'pending' ? 'Bekleyen talep yok.' : 'Seans takibe geçirilmeyi bekleyen onaylı talep yok.'}</EmptyState>
          )}
          {requests && shown.length > 0 && (
            <ul className="rq-list">
              {shown.map((r) => (
                <RequestCard key={r.id} r={r}>
                  {r.status === 'pending' ? (
                    <footer className="rq-foot">
                      <span className="rq-status rq-wait">{r.holdId ? 'Saat 24 saat sizin için tutuluyor' : 'Saat tutulmuyor; onaylarken çakışma denetlenir'}</span>
                      <span className="row">
                        <Button variant="primary" onClick={() => decide(r, 'approve')}>
                          Onayla
                        </Button>
                        <Button onClick={() => decide(r, 'unavailable')}>Uygun değilim</Button>
                        <Button variant="ghost" onClick={() => decide(r, 'cancel')}>
                          İptal et
                        </Button>
                      </span>
                    </footer>
                  ) : (
                    <footer className="rq-foot">
                      <span className="rq-status rq-ok">{`Onaylandı · ${daysLeft(r)} gün içinde takibe geçirilmezse bilgiler silinir`}</span>
                      <span className="row">
                        <Button
                          variant="primary"
                          onClick={() => {
                            const weekday = r.kind === 'session' ? new Date(`${r.day}T12:00:00Z`).getUTCDay() : 1;
                            setMoving({ r, weekday, time: '', since: nextWeekday(weekday) });
                          }}
                        >
                          Seans takibe geçir
                        </Button>
                        <Button onClick={() => revert(r)}>Geri al</Button>
                        <Button variant="ghost" onClick={() => decide(r, 'cancel')}>
                          İptal et
                        </Button>
                      </span>
                    </footer>
                  )}
                </RequestCard>
              ))}
            </ul>
          )}
        </div>
        <aside className="appt-side">
          <AppointmentCalendar version={attempt} add={add} />
        </aside>
      </div>

      {sending && (
        <MailDialog
          title={sending.title}
          to={sending.r}
          mail={sending.mail}
          onMail={(mail) => setSending({ ...sending, mail })}
          send={sending.send}
          tone={sending.tone}
          busy={busy}
          onSend={send}
          onClose={() => setSending(null)}
        >
          {sending.send === 'Gönder ve geri al' && (
            <p>Yanlışlıkla onayladığınız talep "Bekleyen" bölümüne döner ve onaylı saat takvimden kalkar. Kişiye teknik bir sorundan özür dileyen bu e-posta gider.</p>
          )}
        </MailDialog>
      )}

      {moving && (
        <Dialog
          title="Seans takibe geçir"
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
            <p>{`${moving.r.name}, ${weekly(moving.weekday, moving.r.time)}'de haftalık ${labelOf(moving.r).replace(/ \(.*\)$/, '').toLocaleLowerCase('tr-TR')} seansına alınacak (ilk seans ${whenOf(moving.r)}).`}</p>
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
          <p className="k-hint">{`Kişi bir danışan numarasıyla takip edilir (${clientNumber(1, moving.r.name)} gibi). Ad ve e-posta yalnızca ona e-posta gönderebilmeniz için şifreli saklanır ve terapi sonlandırılınca silinir.`}</p>
        </Dialog>
      )}
    </section>
  );
}
