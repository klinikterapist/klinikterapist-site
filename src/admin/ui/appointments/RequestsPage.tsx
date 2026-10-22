/**
 * Randevu talepleri (owner's design 2026-10-20): requests from the site's booking and intro-call
 * forms, beside the appointment calendar.
 *   - Top right: "Randevu ekle" (an appointment given by phone or e-mail, with the person's name and
 *     e-mail) and the state of Randevu alımı per language, a link to Ayarlar › Önemli Ayarlar where it
 *     is opened and closed (owner's request 2026-10-21; closed, the site offers "Haber et").
 *   - Aktif talepler (owner's review a5): Onayla / Uygun değilim / İptal et open the ready, personal e-mail for editing.
 *   - Onaylanan: "Seans takibe geçir" (a booking keeps its weekday and time, an intro call asks),
 *     or "Geri al" when the approval went by mistake.
 *   - Bekleme listesi: the "Haber et" people (WaitlistTab).
 * Each card says loudly what it is (a session booking or the free intro call) and whether the
 * person's e-mail address is checked. Owner's review a5: the kind box has the date box's size and
 * type, in its own colour (session: sage, intro call: terracotta, with the card's side line); the
 * card says when the request came and how long ago, and warns once 24 hours have passed.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type BookingRequest, type Client, type RequestDecision, type WaitlistEntry } from '../../api/types';
import { AGE_RANGES, INTRO_FOR, INTRO_TOPICS, REQUEST_KEEP_DAYS, SESSION_TYPES, clientNumber, formatDay, requestKeepUntil } from '../../../lib/booking-form';
import { decisionMail, revertMail, type Mail } from '../../lib/booking-mail';
import type { PaymentSettings } from '../../../lib/payment';
import { go, usePanel } from '../context';
import { useFreshData } from '../fresh-data';
import { BellRing, ChevronDown, CircleCheck, Icon, Inbox, Plus } from '../icons';
import { Banner, Button, Dialog, EmptyState, Field, Select, Spinner } from '../kit';
import { AddAppointmentDialog, type AddInitial } from './AddAppointmentDialog';
import { AppointmentCalendar, WEEKDAYS, labelOf, templateTimes } from './AppointmentCalendar';
import { MailDialog } from './MailDialog';
import { initialsOf } from './shared';
import { VerifiedMark, WaitlistTab } from './WaitlistTab';

const KEEP_DAYS = REQUEST_KEEP_DAYS;
const DECISION_SEND: Record<RequestDecision, string> = { approve: 'Onayla ve gönder', unavailable: 'Uygun değilim ve gönder', cancel: 'İptal et ve gönder' };
const DECISION_TITLE: Record<RequestDecision, string> = { approve: 'Onay e-postası', unavailable: '"Uygun değilim" e-postası', cancel: 'İptal e-postası' };

const whenOf = (r: BookingRequest) => `${formatDay(r.day, 'tr')}, ${r.time.replace(':', '.')}`;
/** Whole days until the request is deleted (review E4: an approved one not before its appointment has passed). */
const daysLeft = (r: BookingRequest) => Math.max(0, Math.ceil((requestKeepUntil(r) - Date.now()) / (24 * 3600e3)));
const DAY_MS = 24 * 3600e3;
/** When the request came: "20 Ekim 2026, Salı, 09.12". */
const sentAt = (ms: number) => {
  const d = new Date(ms + 3 * 3600e3).toISOString();
  return `${formatDay(d.slice(0, 10), 'tr')}, ${d.slice(11, 16).replace(':', '.')}`;
};
/** How long ago: "2 sa 15 dk", "45 dk". */
export const elapsed = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60e3));
  const h = Math.floor(m / 60);
  return h ? `${h} sa ${m % 60} dk` : `${m} dk`;
};
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

/** What the request is, in its own box beside the date, the same size and type (owner's reviews a4, a5). */
function KindBox({ r }: { r: BookingRequest }) {
  return r.kind === 'intro' ? (
    <span className="rq-kindbox is-intro">
      <b>Ön görüşme</b>
      <span>Ücretsiz</span>
    </span>
  ) : (
    <span className="rq-kindbox">
      <b>Seans</b>
      <span>Randevusu</span>
    </span>
  );
}

/** When the request came and how long ago; past 24 hours, a warning (the hold has run out). */
function SentLine({ r, now }: { r: BookingRequest; now: number }) {
  const late = now - r.createdAt >= DAY_MS;
  return (
    <span className={`rq-status ${late ? 'rq-late' : 'rq-wait'}`}>
      {`${r.source === 'manual' ? 'Eklendi' : 'Gönderildi'}: ${sentAt(r.createdAt)} · ${elapsed(now - r.createdAt)} önce`}
      {late && <b>{r.holdId ? ' · 24 saat geçti, saat artık tutulmuyor' : ' · 24 saat geçti'}</b>}
    </span>
  );
}

/** The session type under the name: "Bireysel terapi · 50 dakika". */
function typeLine(r: BookingRequest): string {
  if (r.kind === 'intro') return 'Ücretsiz ön görüşme · 30 dakika';
  const t = SESSION_TYPES.find((s) => s.id === r.type) ?? SESSION_TYPES[0];
  return `${t.tr} · ${t.minutes} dakika${r.source === 'manual' ? ' · elle eklendi' : ''}`;
}

/**
 * A request as a closed card (owner's review 2026-10-21): name, kind, the wished time and the buttons
 * show; the person's details open with the card's head ("Ayrıntılar"), so a busy list stays short.
 */
function RequestCard({ r, open, onToggle, children }: { r: BookingRequest; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const forWhom = INTRO_FOR.find((f) => f.id === r.forWhom);
  const [d, mon] = formatDay(r.day, 'tr').split(/[ ,]+/);
  const detailsId = `rq-details-${r.id}`;
  return (
    <li className={`rq-card rq-is-${r.kind}${open ? ' is-open' : ''}`}>
      <header className="rq-head">
        <span className="rq-avatar" aria-hidden="true">
          {initialsOf(r.name)}
        </span>
        <span className="rq-who">
          <b>{r.name}</b>
          <span className="rq-type">{typeLine(r)}</span>
        </span>
        <KindBox r={r} />
        <span className="rq-when" aria-label={`İstenen zaman: ${whenOf(r)}`}>
          <b>
            {d} {mon}
          </b>
          <span>
            {formatDay(r.day, 'tr').split(', ')[1]} · {r.time.replace(':', '.')}
          </span>
        </span>
        <button type="button" className="rq-toggle" aria-expanded={open} aria-controls={detailsId} onClick={onToggle}>
          <span>{open ? 'Gizle' : 'Ayrıntılar'}</span>
          <Icon as={ChevronDown} size={16} />
        </button>
      </header>
      <dl className="rq-rows" id={detailsId} hidden={!open}>
        <Row label="İstenen zaman">{whenOf(r)}</Row>
        <Row label="E-posta">
          <a href={`mailto:${r.email}`}>{r.email}</a> <VerifiedMark ok={!!r.verified} />
        </Row>
        {r.phone && (
          <Row label="Telefon">
            <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`}>{r.phone}</a>
          </Row>
        )}
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
        <Row label="Konuşma dili">{r.lang === 'en' ? 'İngilizce (e-postalar İngilizce gider)' : 'Türkçe'}</Row>
      </dl>
      {children}
    </li>
  );
}

type Sending = { title: string; send: string; tone: 'primary' | 'danger'; r: BookingRequest; mail: Mail; revert?: boolean; run: (m: Mail) => Promise<string> };
type View = 'pending' | 'approved' | 'waitlist';

export function RequestsPage({ add, list = false }: { add: { day: string; time: string; type: string } | null; list?: boolean }) {
  const { api } = usePanel();
  const fresh = useFreshData(api);
  const [requests, setRequests] = useState<BookingRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; link?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>(list ? 'waitlist' : 'pending');
  /** Cards whose details are open (closed by default). */
  const [openCards, setOpenCards] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState<Sending | null>(null);
  const [moving, setMoving] = useState<{ r: BookingRequest; weekday: number; time: string; since: string } | null>(null);
  const [adding, setAdding] = useState<{ initial: AddInitial; from?: WaitlistEntry } | null>(add ? { initial: { day: add.day, time: add.time, kind: add.type } } : null);
  const [booking, setBooking] = useState<{ open: { tr: boolean; en: boolean }; waiting: number } | null>(null);
  // The fee and payment details go into a session's approval e-mail (Faz 1).
  const [payment, setPayment] = useState<PaymentSettings | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api
      .paymentGet()
      .then(({ payment }) => alive && setPayment(payment))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, fresh]);
  // The "… önce" times move on every minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60e3);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .requestsList()
      .then(({ requests }) => alive && setRequests(requests))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Talepler yüklenemedi. Tekrar deneyin.'));
    api
      .bookingState()
      .then((s) => alive && setBooking(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [api, attempt, fresh]);
  const reload = () => setAttempt((n) => n + 1);

  const decide = (r: BookingRequest, decision: RequestDecision) =>
    setSending({
      title: DECISION_TITLE[decision],
      send: DECISION_SEND[decision],
      tone: decision === 'approve' ? 'primary' : 'danger',
      r,
      mail: decisionMail(r, decision, payment),
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
      revert: true,
      mail: revertMail(r),
      run: async (m) => {
        await api.requestRevert({ id: r.id, ...m });
        setView('pending');
        return 'Özür e-postası gönderildi. Talep yeniden "Aktif talepler" bölümünde; onaylı saat takvimden kaldırıldı.';
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
          Randevu Talepleri
        </h2>
        <div className="head-actions">
          {booking && (
            // Opened and closed in Ayarlar › Önemli Ayarlar, per language (owner's request 2026-10-21).
            <a className={`intake ${booking.open.tr ? 'is-open' : 'is-closed'}`} href="#/ayarlar/onemli">
              <span className="intake-dot" aria-hidden="true" />
              {`Randevu alımı: Türkçe ${booking.open.tr ? 'açık' : 'kapalı'} · İngilizce ${booking.open.en ? 'açık' : 'kapalı'}`}
            </a>
          )}
          <Button variant="primary" onClick={() => setAdding({ initial: {} })}>
            <Icon as={Plus} />
            Randevu ekle
          </Button>
        </div>
      </div>
      <p className="settings-intro">
        Siteden gelen randevu ve ön görüşme talepleri. Kararınızı verdiğinizde kişiye hazır bir e-posta gider. Reddedilen ve iptal edilen taleplerin bilgileri hemen silinir. Hiçbir
        talep {KEEP_DAYS} günden uzun tutulmaz.
      </p>
      {booking && !booking.open.tr && (
        <Banner tone="warning" action={<a href="#/ayarlar/onemli">Önemli Ayarlar →</a>}>
          Türkçe randevu alımı kapalı: sitede randevu ve ön görüşme sayfalarında "Randevu alımı şu an kapalı" yazıyor ve "Haber et" formu görünüyor.
        </Banner>
      )}

      <div className="appt-layout">
        <div className="appt-main">
          <div className="segmented" role="group" aria-label="Talepler">
            <button type="button" aria-pressed={view === 'pending'} onClick={() => setView('pending')}>
              <Icon as={Inbox} size={16} />
              {`Aktif talepler (${pending.length})`}
            </button>
            <button type="button" aria-pressed={view === 'approved'} onClick={() => setView('approved')}>
              <Icon as={CircleCheck} size={16} />
              {`Onaylanan (${approved.length})`}
            </button>
            <button type="button" aria-pressed={view === 'waitlist'} onClick={() => setView('waitlist')}>
              <Icon as={BellRing} size={16} />
              {`Bekleme listesi (${booking?.waiting ?? 0})`}
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

          {view === 'waitlist' ? (
            <WaitlistTab
              version={attempt}
              onCount={(waiting) => setBooking((b) => (b ? { ...b, waiting } : b))}
              onBook={(from, initial) => setAdding({ initial, from })}
            />
          ) : (
            <>
              {!requests && !error && <Spinner label="Talepler yükleniyor…" />}
              {requests && shown.length === 0 && (
                <EmptyState icon={Inbox}>{view === 'pending' ? 'Aktif talep yok.' : 'Seans takibe geçirilmeyi bekleyen onaylı talep yok.'}</EmptyState>
              )}
              {requests && shown.length > 0 && (
                <>
                <div className="rq-list-head">
                  <span className="k-hint">{`${shown.length} talep · ayrıntılar kapalı; bir kartın başlığına basarak açın.`}</span>
                  <Button variant="ghost" onClick={() => setOpenCards(openCards.size ? new Set() : new Set(shown.map((x) => x.id)))}>
                    {openCards.size ? 'Tümünü kapat' : 'Tümünü aç'}
                  </Button>
                </div>
                <ul className="rq-list">
                  {shown.map((r) => (
                    <RequestCard
                      key={r.id}
                      r={r}
                      open={openCards.has(r.id)}
                      onToggle={() => {
                        const next = new Set(openCards);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        setOpenCards(next);
                      }}
                    >
                      {r.status === 'pending' ? (
                        <footer className="rq-foot">
                          <SentLine r={r} now={now} />
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
                          {daysLeft(r) <= 5 ? (
                            <span className="rq-status rq-late">{`Onaylandı · Seans takibe geçirilmezse ${daysLeft(r)} gün sonra bilgiler silinecek`}</span>
                          ) : (
                            <span className="rq-status rq-ok">{`Onaylandı · ${daysLeft(r)} gün içinde takibe geçirilmezse bilgiler silinir`}</span>
                          )}
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
                </>
              )}
            </>
          )}
        </div>
        <aside className="appt-side">
          <AppointmentCalendar version={attempt} />
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
          {sending.revert && <p>Yanlışlıkla onayladığınız talep "Aktif talepler" bölümüne döner ve onaylı saat takvimden kalkar. Kişiye teknik bir sorundan özür dileyen bu e-posta gider.</p>}
        </MailDialog>
      )}

      {adding && (
        <AddAppointmentDialog
          initial={adding.initial}
          onClose={() => {
            setAdding(null);
            if (add) go('#/randevular');
          }}
          onAdded={async (r, client) => {
            if (adding.from) await api.waitlistRemove(adding.from.id).catch(() => undefined);
            setAdding(null);
            setNotice(
              client
                ? { text: `${r.name}, ${client.number} numarasıyla Seans takibe alındı: ${weekly(client.weekday, client.time)}.`, link: true }
                : { text: `${r.name} için ${whenOf(r)} eklendi; "Onaylanan" bölümünde duruyor.` },
            );
            if (!client) setView('approved');
            if (add) go('#/randevular');
            reload();
          }}
        />
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
