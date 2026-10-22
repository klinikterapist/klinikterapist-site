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
 * The client's own page (owner's decisions 2026-10-20): the owner sends the secret link from here
 * (an e-mail to edit, or copy it), and can make a new one. What the client does there shows here:
 * a cancelled or postponed session "danışan istedi" (with "tam ücret" when it was less than 24 hours
 * before), and a wish to end therapy.
 * Owner's review a5: Terapiyi sonlandır, Geri al and Sil live here (not in the Seans takip list);
 * review 2026-10-21: they sit with the other steps at the top right (Ek seans ekle, E-posta yaz,
 * Sonlandırma ▾, ⋯), and a session row shows only the step due now, the rest under its "⋯";
 * the side column is the chart, then the session details, then the client's page.
 * Faz 1: each paid session can be marked "Ödendi" (with a thank-you e-mail the owner can edit or
 * leave out) or get a payment reminder; a late cancellation keeps its fee, a postponed session's
 * payment moves with it.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type Client } from '../../api/types';
import { formatDay } from '../../../lib/booking-form';
import { FREE_KINDS, pastAndNext, sessionKey, sessionNumbers, sessionStats, type SessionRecord, type SessionStatus } from '../../../lib/sessions';
import { usePanel } from '../context';
import { useFreshData } from '../fresh-data';
import { ArrowLeft, CalendarCheck, CalendarPlus, CircleCheck, Flag, Icon, Mail as MailIcon, Trash2, Undo2 } from '../icons';
import { ActionMenu } from '../ActionMenu';
import { Banner, Button, Dialog, EmptyState, Field, Select, Spinner } from '../kit';
import { endMail, linkMail, revertMail, sessionChangeMail, type Mail } from '../../lib/booking-mail';
import { CLOSING_PICK_DAYS, closingDeadline, closingState } from '../../../lib/closing';
import { EMPTY_PAYMENT, feeOf, formatFee, parseFee, paymentReminderMail, thanksMail, withClientFee, type PaymentSettings } from '../../../lib/payment';
import { MailDialog } from './MailDialog';
import { hasFee } from '../../lib/attention';
import { SESSION_KIND_LABEL, WEEKDAYS, labelOf, templateTimes } from './AppointmentCalendar';
import { SessionChart } from './SessionChart';

const STATUS_LABEL: Record<SessionStatus, string> = { planned: 'Planlandı', attended: 'Katıldı', noshow: 'Gelmedi', cancelled: 'İptal edildi', postponed: 'Ertelendi' };
const short = (day: string) => {
  const [d, m, , w] = formatDay(day, 'tr').split(/[ ,]+/);
  return { d, m: m.slice(0, 3), w };
};
/** "20 Eki": the day a payment was marked (Istanbul). */
const paidOn = (ms: number) => {
  const { d, m } = short(new Date(ms + 3 * 3600e3).toISOString().slice(0, 10));
  return `${d} ${m}`;
};
const at = (s: { day: string; time: string }) => `${formatDay(s.day, 'tr')}, ${s.time.replace(':', '.')}`;

/** `send`: the client gets an e-mail about it (owner's note 2026-10-22); `mail`: that e-mail, open for editing (the second step). */
type Marking = { s: SessionRecord; status: 'cancelled' | 'postponed'; by: 'client' | 'owner'; note: string; day: string; time: string; send: boolean; mail?: Mail };
type Adding = { kind: 'closing' | 'extra'; day: string; time: string; send: boolean; mail?: Mail };
type Linking = { step: 'mail'; mail: Mail } | { step: 'renew' };
type Ending = { mode: 'complete' | 'closing'; mail: Mail };

const END_CHOICES = [
  { mode: 'complete', label: 'Terapi tamamlandı', hint: 'Kişiye terapi sürecinin sona erdiğini bildiren e-posta gider. Danışan, bilgileriyle birlikte Seans takipten silinir; haftalık saat takvimde ve sitede yeniden açılır.' },
  { mode: 'closing', label: 'Sonlandırma görüşmesi talep et', hint: `Kişiye ücretsiz, 25–30 dakikalık sonlandırma görüşmesini anlatan bir davet gider. Danışan, ${CLOSING_PICK_DAYS} gün içinde kendi randevu sayfasından görüşmenin gününü ve saatini seçer; seçmezse bir sonraki seansı kendiliğinden ücretsiz sonlandırma görüşmesi olur (son günden 1 gün önce ona hatırlatma, size bilgi gider). Danışan takipte kalır; görüşmeden sonra "Terapi tamamlandı" ile kapatırsınız.` },
] as const;

export function ClientPage({ id }: { id: string }) {
  const { api } = usePanel();
  const fresh = useFreshData(api);
  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [marking, setMarking] = useState<Marking | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [linking, setLinking] = useState<Linking | null>(null);
  const [payment, setPayment] = useState<PaymentSettings>(EMPTY_PAYMENT);
  const [paying, setPaying] = useState<{ s: SessionRecord; mail: Mail; send: boolean } | null>(null);
  const [reminding, setReminding] = useState<{ s: SessionRecord; mail: Mail } | null>(null);
  /** "Özel ücret" (owner's note 2026-10-22): the amount as typed, '' for the session type's fee. */
  const [feeEdit, setFeeEdit] = useState<string | null>(null);

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

  /** Ödendi (with or without the thank-you) or taking the mark off. */
  const pay = async (s: SessionRecord, paid: boolean, mail?: Mail) => {
    setBusy(true);
    setError(null);
    try {
      const { client } = await api.clientPay({ id, day: s.day, time: s.time, paid, ...(mail ? { mail } : {}) });
      setClient(client);
      setNotice(paid ? `${at(s)}: ödendi olarak işaretlendi${mail ? '; teşekkür e-postası gönderildi' : ''}.` : `${at(s)}: ödeme işareti kaldırıldı.`);
      setPaying(null);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Kaydedilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };
  const remind = async (s: SessionRecord, mail: Mail) => {
    setBusy(true);
    setError(null);
    try {
      await api.clientMail({ id, ...mail });
      setNotice(`${at(s)} için ödeme hatırlatması gönderildi.`);
      setReminding(null);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'E-posta gönderilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };
  const [ending, setEnding] = useState<Ending | null>(null);
  const [reverting, setReverting] = useState<Mail | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** "E-posta yaz": a free e-mail to the client (owner's review 2026-10-21). */
  const [writing, setWriting] = useState<Mail | null>(null);
  /** What happened when the client left Seans takip (ended, deleted, put back). */
  const [gone, setGone] = useState<{ text: string; requests?: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .clientsList()
      .then(({ clients }) => alive && setClient(clients.find((c) => c.id === id) ?? null))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Danışan yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, id, fresh]);

  /** A session change; with `mail`, the client is told by e-mail once it is saved (owner's note 2026-10-22). */
  const change = async (input: Parameters<typeof api.clientSession>[0], done: string, mail?: Mail) => {
    setBusy(true);
    setError(null);
    let saved = false;
    try {
      const { client } = await api.clientSession(input);
      saved = true;
      setClient(client);
      if (mail) await api.clientMail({ id, ...mail });
      setNotice(mail ? `${done} Danışana e-posta gönderildi.` : done);
      setMarking(null);
      setAdding(null);
    } catch (e) {
      if (saved) {
        setNotice(done);
        setMarking(null);
        setAdding(null);
        setError(`Değişiklik kaydedildi ama danışana e-posta gönderilemedi${e instanceof ApiFailure ? `: ${e.message}` : '.'} "E-posta yaz" ile kendiniz bildirebilirsiniz.`);
      } else {
        setError(e instanceof ApiFailure ? e.message : 'Kaydedilemedi. Tekrar deneyin.');
      }
    } finally {
      setBusy(false);
    }
  };
  /** The client's page: the e-mail with the link, copying it, or a new link. */
  const link = async (what: 'mail' | 'copy' | 'renew') => {
    setBusy(true);
    setError(null);
    try {
      const { link } = await api.clientLink({ id, renew: what === 'renew' });
      if (what === 'copy') {
        await navigator.clipboard.writeText(link);
        setNotice('Bağlantı kopyalandı. Yalnızca bu danışana gönderin.');
      } else if (what === 'renew') {
        setNotice('Yeni bağlantı hazır; eskisi artık açılmıyor. Yenisini danışana gönderin.');
        setLinking(null);
      } else if (client) {
        setLinking({ step: 'mail', mail: linkMail(client.contact, link) });
      }
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : what === 'copy' ? 'Bağlantı kopyalanamadı. Tekrar deneyin.' : 'Bağlantı alınamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };
  const sendLink = async (mail: Mail) => {
    setBusy(true);
    setError(null);
    try {
      await api.clientLinkMail({ id, ...mail });
      setNotice('Randevu sayfasının bağlantısı danışana e-postayla gönderildi.');
      setLinking(null);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'E-posta gönderilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  /** Terapiyi sonlandır: the closing invitation carries the client's page link and the last day to pick a time. */
  const chooseEnd = async (mode: 'complete' | 'closing') => {
    if (!client) return;
    if (mode === 'complete') {
      setEnding({ mode, mail: endMail(client.contact, 'complete') });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { link } = await api.clientLink({ id });
      setEnding({ mode, mail: endMail(client.contact, 'closing', { link, lastDay: closingDeadline(Date.now()).day }) });
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Randevu sayfasının bağlantısı alınamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  /** Terapiyi sonlandır, Geri al, Sil. `leaves`: the client is no longer in Seans takip afterwards. */
  const finish = async (job: () => Promise<void>, done: string, leaves: boolean, requests = false) => {
    setBusy(true);
    setError(null);
    try {
      await job();
      setEnding(null);
      setReverting(null);
      setDeleting(false);
      if (leaves) {
        setGone({ text: done, requests });
        setClient(null);
      } else {
        setNotice(done);
        const now = Date.now();
        setClient((c) => (c ? { ...c, status: 'closing', closingAsk: { at: now, until: closingDeadline(now).until } } : c));
      }
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'İşlem yapılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const mark = (s: SessionRecord, status: SessionStatus) =>
    change({ op: 'mark', id, day: s.day, time: s.time, status }, status === 'planned' ? `${at(s)}: işaret kaldırıldı.` : `${at(s)}: ${STATUS_LABEL[status].toLocaleLowerCase('tr-TR')} olarak işaretlendi.`);

  if (client === undefined && !error) return <Spinner label="Danışan yükleniyor…" />;
  if (!client && gone) {
    return (
      <section className="appt-page">
        <Banner tone="success" action={gone.requests ? <a href="#/randevular">Randevu taleplerine git →</a> : undefined}>
          {gone.text}
        </Banner>
        <a className="back-link" href="#/seans-takip">
          ← Danışanlara dön
        </a>
      </section>
    );
  }
  if (!client) {
    return (
      <section className="appt-page">
        {error && <Banner tone="error">{error}</Banner>}
        <EmptyState icon={CalendarCheck} action={<a href="#/seans-takip">← Danışanlara dön</a>}>
          Bu danışan bulunamadı. Takipten çıkarılmış olabilir.
        </EmptyState>
      </section>
    );
  }

  const now = Date.now();
  const { past, next } = pastAndNext(client, now);
  const stats = sessionStats(client, now);
  const closing = closingState(client, now);
  const numbers = sessionNumbers(client, next.at(-1)?.day ?? past.at(-1)?.day ?? client.since);
  const times = (day: string) => (day ? templateTimes(day) : []);
  /** One session's fee for this client: their own, else their session type's (0: not set in Ücret ve ödeme). */
  const fee = feeOf(payment, client.type, client.fee);

  const standard = feeOf(payment, client.type);
  const saveFee = async (value: number | null) => {
    setBusy(true);
    setError(null);
    try {
      const { client: next } = await api.clientFee({ id, fee: value });
      setClient(next);
      setNotice(value ? `Bu danışanın seans ücreti ${formatFee(value, 'tr')} olarak kaydedildi.` : 'Bu danışan için yeniden görüşme türünün standart ücreti geçerli.');
      setFeeEdit(null);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Kaydedilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };
  /** The e-mail that tells the client about a cancelled or moved session (owner's note 2026-10-22). */
  const markingMail = (m: Marking): Mail =>
    sessionChangeMail(client.contact, {
      mode: m.status === 'cancelled' ? 'cancel' : 'postpone',
      day: m.s.day,
      time: m.s.time,
      type: client.type,
      closing: m.s.kind === 'closing',
      by: m.by,
      ...(m.day && m.time ? { to: { day: m.day, time: m.time } } : {}),
    });
  const addingMail = (a: Adding): Mail => sessionChangeMail(client.contact, { mode: 'add', day: a.day, time: a.time, type: client.type, closing: a.kind === 'closing' });
  const saveMarking = (m: Marking, mail?: Mail) =>
    change(
      { op: 'mark', id, day: m.s.day, time: m.s.time, status: m.status, by: m.by, note: m.note, ...(m.day && m.time ? { newDay: m.day, newTime: m.time } : {}) },
      m.status === 'cancelled' ? `${at(m.s)} iptal edildi; saat açıldı.` : `${at(m.s)} ertelendi${m.day && m.time ? `: yeni tarih ${at(m)}` : ''}.`,
      mail,
    );
  const saveAdding = (a: Adding, mail?: Mail) => change({ op: 'add', id, kind: a.kind, day: a.day, time: a.time }, `${at(a)} eklendi; takvime işlendi.`, mail);

  const row = (s: SessionRecord, past: boolean) => {
    const { d, m, w } = short(s.day);
    const free = FREE_KINDS.includes(s.kind);
    const added = s.kind !== 'weekly';
    const payable = hasFee(s);
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
          {s.late && <small className="ss-late">24 saatten az kala · tam ücret</small>}
          {s.movedTo && <small>{`→ ${short(s.movedTo.day).d} ${short(s.movedTo.day).m} ${s.movedTo.time.replace(':', '.')}`}</small>}
        </span>
        {/* Owner's note 2026-10-22: the payment in a column of its own, a state ("bekleniyor", "alındı") apart from the session's. */}
        <span className="ss-money">
          {free ? (
            <span className="ss-chip is-free">Ücretsiz</span>
          ) : payable && s.paid ? (
            <span className="ss-chip is-paid">
              <Icon as={CircleCheck} size={15} />
              {`Ödeme alındı · ${paidOn(s.paid)}`}
            </span>
          ) : payable ? (
            <span className="ss-chip is-due">
              <span>{`Ödeme bekleniyor${fee ? ` · ${formatFee(fee, 'tr')}` : ''}`}</span>
              <button type="button" className="ss-chip-btn" disabled={busy} onClick={() => setPaying({ s, mail: thanksMail(client.contact, s, client.type), send: true })}>
                Ödeme alındı
              </button>
            </span>
          ) : null}
        </span>
        <span className="ss-actions">
          {/* Owner's review 2026-10-21: the step that is due now as a button, the rest in "Diğer". */}
          {s.status === 'planned' && past && (
            <span className="ss-quick" role="group" aria-label="Seansı işaretle">
              <Button variant="primary" disabled={busy} onClick={() => mark(s, 'attended')}>
                Katıldı
              </Button>
              <Button disabled={busy} onClick={() => mark(s, 'noshow')}>
                Gelmedi
              </Button>
            </span>
          )}
          <ActionMenu
            compact
            label={`${at(s)}: diğer işlemler`}
            items={[
              ...(s.status === 'planned'
                ? [
                    { label: 'İptal', hint: 'Saat takvimde ve sitede açılır', onSelect: () => setMarking({ s, status: 'cancelled', by: 'client', note: '', day: '', time: '', send: true }) },
                    { label: 'Ertele', hint: 'Yeni tarih takvime işlenir', onSelect: () => setMarking({ s, status: 'postponed', by: 'client', note: '', day: '', time: '', send: true }) },
                    ...(added && !s.from ? [{ label: 'Sil', hint: 'Eklenen seansı listeden kaldırır', danger: true, onSelect: () => change({ op: 'remove', id, day: s.day, time: s.time }, `${at(s)} silindi.`) }] : []),
                  ]
                : [{ label: 'İşareti kaldır', hint: 'Seans yeniden işaretlenmemiş olur', onSelect: () => mark(s, 'planned') }]),
              ...(payable
                ? [
                    'divider' as const,
                    ...(s.paid
                      ? [{ label: 'Ödemeyi geri al', hint: '"Ödeme alındı" işareti kalkar', onSelect: () => pay(s, false) }]
                      : [{ label: 'Ödeme hatırlat', hint: 'Ücret ve ödeme bilgisiyle e-posta', onSelect: () => setReminding({ s, mail: paymentReminderMail(client.contact, s, client.type, withClientFee(payment, client.type, client.fee)) }) }]),
                  ]
                : []),
            ]}
          />
        </span>
      </li>
    );
  };

  return (
    <section className="appt-page client-page" aria-labelledby="cl-title">
      <a className="editor-back" href="#/seans-takip" aria-label="Danışanlara dön">
        <Icon as={ArrowLeft} size={18} />
        <span>Danışanlar</span>
      </a>
      <header className="cl-hero">
        <span className="cl-badge" aria-hidden="true">
          <Icon as={CalendarCheck} size={26} />
        </span>
        <div className="cl-hero-text">
          <h2 id="cl-title">
            <span className="tk-number tk-number-lg">{client.number}</span>
            {client.status === 'closing' && <span className="tk-badge">{closing.step === 'wait' ? 'Sonlandırma görüşmesi bekleniyor' : closing.step === 'none' ? 'Sonlandırma aşamasında' : 'Sonlandırma görüşmesi planlandı'}</span>}
          </h2>
          <p>{`${labelOf({ kind: 'session', type: client.type })} · bugüne kadar ${stats.held} seans`}</p>
        </div>
        {/* Owner's review 2026-10-21: every step about this client in one place, grouped by what it does. */}
        <div className="head-actions cl-actions">
          <Button variant="primary" onClick={() => setAdding({ kind: 'extra', day: '', time: '', send: true })}>
            <Icon as={CalendarPlus} size={16} />
            Ek seans ekle
          </Button>
          <Button onClick={() => setWriting({ subject: '', body: '' })}>
            <Icon as={MailIcon} size={16} />
            E-posta yaz
          </Button>
          <ActionMenu
            label="Sonlandırma"
            icon={Flag}
            items={[
              { label: 'Sonlandırma görüşmesi ekle', hint: 'Ücretsiz son görüşmeyi takvime ekler', icon: CalendarPlus, onSelect: () => setAdding({ kind: 'closing', day: '', time: '', send: true }) },
              { label: 'Terapiyi sonlandır', hint: 'Tamamlandı ya da sonlandırma görüşmesi daveti', icon: Flag, onSelect: () => setEnding({ mode: 'complete', mail: endMail(client.contact, 'complete') }) },
            ]}
          />
          <ActionMenu
            compact
            label="Diğer işlemler"
            items={[
              { label: 'Geri al', hint: 'Takipten çıkarır, talebe döndürür ve özür e-postası gönderir', icon: Undo2, onSelect: () => setReverting(revertMail(client.contact)) },
              'divider',
              { label: 'Sil', hint: 'Danışanı ve seanslarını e-posta göndermeden siler', icon: Trash2, danger: true, onSelect: () => setDeleting(true) },
            ]}
          />
        </div>
      </header>
      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      {client.status === 'closing' && closing.step !== 'none' && (
        <Banner tone={closing.step === 'wait' ? 'info' : 'success'}>
          {closing.step === 'wait'
            ? `Danışan, sonlandırma görüşmesinin gününü ve saatini ${formatDay(closing.lastDay, 'tr')} gününün sonuna kadar kendi randevu sayfasından seçebilir. ${closing.target ? `Seçmezse ${at(closing.target)} seansı kendiliğinden ücretsiz, 30 dakikalık sonlandırma görüşmesi olur.` : 'Seçmezse dönüşecek planlı bir seans yok; görüşmeyi buradan siz eklersiniz.'}`
            : closing.step === 'auto'
              ? `Danışan saat seçmedi; ${at(closing.session)} seansı kendiliğinden ücretsiz sonlandırma görüşmesine dönüştü.`
              : `Sonlandırma görüşmesi: ${at(closing.session)}.`}
        </Banner>
      )}
      {client.endAsked && (
        <Banner tone="warning" action={<span className="k-hint">Sağ üstte: Sonlandırma › Terapiyi sonlandır</span>}>
          {`${formatDay(new Date(client.endAsked.at + 3 * 3600e3).toISOString().slice(0, 10), 'tr')} tarihinde kendi sayfasından terapiyi sonlandırmak istediğini bildirdi.`}
          {client.endAsked.note && <span className="ss-note">{`Notu: ${client.endAsked.note}`}</span>}
        </Banner>
      )}

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
            işlenir. Danışan kendi sayfasından bir seansı iptal eder ya da ertelerse burada "danışan istedi" diye görünür; 24 saatten az kala yaptıysa "tam ücret" notu
            düşer (danışan bunu onaylamıştır).
          </p>
        </div>
        <aside className="appt-side cl-side">
          <div className="k-group">
            <h3 className="tk-group-title">Seans grafiği</h3>
            <SessionChart stats={stats} />
          </div>
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
              <div className="cl-fee">
                <dt>Seans ücreti</dt>
                <dd>
                  <b>{fee ? formatFee(fee, 'tr') : 'Girilmedi'}</b>
                  <small>{client.fee ? 'bu danışana özel' : 'görüşme türünün standart ücreti'}</small>
                  <Button variant="ghost" onClick={() => setFeeEdit(client.fee ? String(client.fee) : '')}>
                    {client.fee ? 'Değiştir' : 'Özel ücret belirle'}
                  </Button>
                </dd>
              </div>
            </dl>
          </div>
          <div className="k-group">
            <h3 className="tk-group-title">Danışanın randevu sayfası</h3>
            <div className="cl-card cl-link">
              <p className="k-hint">
                Danışan bu gizli bağlantıyla seans bilgisini, seans grafiğini ve sıradaki seanslarını görür; bir seansı iptal edebilir ya da takvimdeki boş bir saate
                erteleyebilir, terapiyi sonlandırmak istediğini bildirebilir. 24 saatten az kalmışsa önce tam ücret uyarısını onaylar. Her işlem size e-postayla gelir. Sayfada
                adı görünmez.
              </p>
              <div className="row">
                <Button variant="primary" disabled={busy} onClick={() => link('mail')}>
                  Bağlantıyı gönder
                </Button>
                <Button disabled={busy} onClick={() => link('copy')}>
                  Kopyala
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setLinking({ step: 'renew' })}>
                  Yenile
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {marking && !marking.mail && (
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
                onClick={() => (marking.send ? setMarking({ ...marking, mail: markingMail(marking) }) : saveMarking(marking))}
              >
                {marking.send ? 'Devam: e-postayı gör' : 'Kaydet'}
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
          <Field label="Not (isteğe bağlı, yalnızca panelde görünür)" value={marking.note} onChange={(note) => setMarking({ ...marking, note })} maxLength={300} />
          <MailChoice send={marking.send} onSend={(send) => setMarking({ ...marking, send })} />
          <p className="k-hint">
            {marking.status === 'cancelled' ? 'Bu seansın saati takvimde ve sitede açılır.' : 'Yeni tarih seçerseniz takvime işlenir; eski saat açılır.'}{' '}
            {marking.send ? 'Sonraki adımda danışana gidecek e-postayı görüp düzeltebilirsiniz.' : 'Danışana e-posta gitmez.'}
          </p>
        </Dialog>
      )}

      {marking?.mail && (
        <MailDialog
          title={`${at(marking.s)}: ${marking.status === 'cancelled' ? 'iptal' : 'ertele'}`}
          to={client.contact}
          mail={marking.mail}
          onMail={(mail) => setMarking({ ...marking, mail })}
          send="Kaydet ve gönder"
          busy={busy}
          onClose={() => setMarking({ ...marking, mail: undefined })}
          onSend={() => saveMarking(marking, marking.mail)}
        >
          <p className="k-hint">{`Seans ${marking.status === 'cancelled' ? 'iptal edilir' : 'ertelenir'}; ardından bu e-posta danışana gider. Vazgeç ile bir önceki adıma dönersiniz.`}</p>
        </MailDialog>
      )}

      {ending && (
        <MailDialog
          title={`${client.number}: terapiyi sonlandır`}
          to={client.contact}
          mail={ending.mail}
          onMail={(mail) => setEnding({ ...ending, mail })}
          send={ending.mode === 'complete' ? 'Gönder ve takipten çıkar' : 'Daveti gönder'}
          tone={ending.mode === 'complete' ? 'danger' : 'primary'}
          busy={busy}
          onClose={() => setEnding(null)}
          onSend={() =>
            ending.mode === 'complete'
              ? finish(() => api.clientEnd({ id, mode: 'complete', ...ending.mail }), `E-posta gönderildi. ${client.number} Seans takipten çıkarıldı, bilgileri silindi; haftalık saat yeniden açık.`, true)
              : finish(() => api.clientEnd({ id, mode: 'closing', ...ending.mail }), `Sonlandırma görüşmesi daveti gönderildi. ${client.number} Seans takipte "Sonlandırma aşamasında" bölümünde.`, false)
          }
        >
          <div className="segmented end-choice" role="group" aria-label="E-posta türü">
            {END_CHOICES.map((o) => (
              <button key={o.mode} type="button" aria-pressed={ending.mode === o.mode} onClick={() => void chooseEnd(o.mode)}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="k-hint">{END_CHOICES.find((o) => o.mode === ending.mode)!.hint}</p>
        </MailDialog>
      )}

      {reverting && (
        <MailDialog
          title={`${client.number}: geri al`}
          to={client.contact}
          mail={reverting}
          onMail={setReverting}
          send="Gönder ve geri al"
          busy={busy}
          onClose={() => setReverting(null)}
          onSend={() =>
            finish(
              () => api.clientRevert({ id, ...reverting }),
              `Özür e-postası gönderildi. Talep yeniden Randevu taleplerinde "Aktif talepler" bölümünde duruyor; ${client.number} numaralı haftalık saat açıldı.`,
              true,
              true,
            )
          }
        >
          <p>Yanlışlıkla takibe aldığınız kişi Randevu taleplerine, onay bekleyen bir talep olarak döner. Kişiye teknik bir sorundan özür dileyen ve doğru yanıtın bir sonraki e-postada geleceğini söyleyen bu e-posta gider.</p>
        </MailDialog>
      )}

      {deleting && (
        <Dialog
          title={`${client.number} silinsin mi?`}
          history
          onClose={() => !busy && setDeleting(false)}
          actions={
            <>
              <Button onClick={() => setDeleting(false)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="danger" busy={busy} onClick={() => finish(() => api.clientEnd({ id, mode: 'delete' }), `${client.number} silindi. Haftalık saat yeniden açık.`, true)}>
                Sil
              </Button>
            </>
          }
        >
          <p>Kişiye e-posta gitmez. Danışan bilgileriyle birlikte silinir; haftalık saat takvimde ve sitede yeniden açılır.</p>
        </Dialog>
      )}

      {paying &&
        (paying.send ? (
          <MailDialog
            title={`${at(paying.s)}: ödeme alındı`}
            to={client.contact}
            mail={paying.mail}
            onMail={(mail) => setPaying({ ...paying, mail })}
            send="İşaretle ve gönder"
            busy={busy}
            onClose={() => setPaying(null)}
            onSend={() => pay(paying.s, true, paying.mail)}
          >
            <div className="segmented end-choice" role="group" aria-label="Teşekkür e-postası">
              <button type="button" aria-pressed={paying.send} onClick={() => setPaying({ ...paying, send: true })}>
                Teşekkür e-postası gönder
              </button>
              <button type="button" aria-pressed={!paying.send} onClick={() => setPaying({ ...paying, send: false })}>
                Yalnızca işaretle
              </button>
            </div>
          </MailDialog>
        ) : (
          <Dialog
            title={`${at(paying.s)}: ödeme alındı`}
            history
            onClose={() => !busy && setPaying(null)}
            actions={
              <>
                <Button onClick={() => setPaying(null)} disabled={busy}>
                  Vazgeç
                </Button>
                <Button variant="primary" busy={busy} onClick={() => pay(paying.s, true)}>
                  İşaretle
                </Button>
              </>
            }
          >
            <div className="segmented end-choice" role="group" aria-label="Teşekkür e-postası">
              <button type="button" aria-pressed={paying.send} onClick={() => setPaying({ ...paying, send: true })}>
                Teşekkür e-postası gönder
              </button>
              <button type="button" aria-pressed={!paying.send} onClick={() => setPaying({ ...paying, send: false })}>
                Yalnızca işaretle
              </button>
            </div>
            <p className="k-hint">Seansın ödemesi alındı olarak işaretlenir; danışana e-posta gitmez.</p>
          </Dialog>
        ))}

      {feeEdit !== null && (
        <Dialog
          title={`${client.number}: seans ücreti`}
          history
          onClose={() => !busy && setFeeEdit(null)}
          actions={
            <>
              <Button onClick={() => setFeeEdit(null)} disabled={busy}>
                Vazgeç
              </Button>
              {client.fee && (
                <Button variant="ghost" disabled={busy} onClick={() => saveFee(null)}>
                  Standart ücrete dön
                </Button>
              )}
              <Button variant="primary" busy={busy} disabled={feeEdit.trim() !== '' && !parseFee(feeEdit)} onClick={() => saveFee(parseFee(feeEdit) ?? null)}>
                Kaydet
              </Button>
            </>
          }
        >
          <Field
            label="Bu danışana özel ücret (TL)"
            type="number"
            value={feeEdit}
            onChange={setFeeEdit}
            placeholder={standard ? `${standard} (standart)` : ''}
            hint={`Boş bırakırsanız ${labelOf({ kind: 'session', type: client.type }).toLocaleLowerCase('tr-TR')} standart ücreti ${standard ? `(${formatFee(standard, 'tr')})` : '(Ücret ve ödeme ayarlarında girilmedi)'} geçerli olur.`}
          />
          <p className="k-hint">Ödeme hatırlatmaları, 3 gün önceki seans hatırlatması ve geç iptal e-postası bu danışana bu ücreti yazar.</p>
        </Dialog>
      )}

      {writing && (
        <MailDialog
          title={`${client.number}: e-posta yaz`}
          to={client.contact}
          mail={writing}
          onMail={setWriting}
          send="Gönder"
          busy={busy}
          onClose={() => setWriting(null)}
          onSend={async () => {
            setBusy(true);
            setError(null);
            try {
              await api.clientMail({ id, ...writing });
              setNotice('E-posta gönderildi.');
              setWriting(null);
            } catch (e) {
              setError(e instanceof ApiFailure ? e.message : 'E-posta gönderilemedi. Tekrar deneyin.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="k-hint">Danışanın adresine sizin adınıza gider. Sağlık bilgisi yazmamaya özen gösterin.</p>
        </MailDialog>
      )}

      {reminding && (
        <MailDialog
          title={`${at(reminding.s)}: ödeme hatırlatması`}
          to={client.contact}
          mail={reminding.mail}
          onMail={(mail) => setReminding({ ...reminding, mail })}
          send="Gönder"
          busy={busy}
          onClose={() => setReminding(null)}
          onSend={() => remind(reminding.s, reminding.mail)}
        >
          {!payment.bank && !payment.link && <p className="k-hint">Ödeme bilgileri henüz girilmedi (Seans takip › Ücret ve ödeme). Metin "ödeme bilgilerini ayrıca ileteceğim" diyor.</p>}
        </MailDialog>
      )}

      {linking?.step === 'mail' && (
        <MailDialog
          title={`${client.number}: randevu sayfası bağlantısı`}
          to={client.contact}
          mail={linking.mail}
          onMail={(mail) => setLinking({ step: 'mail', mail })}
          send="Gönder"
          busy={busy}
          onClose={() => setLinking(null)}
          onSend={() => sendLink(linking.mail)}
        >
          <p className="k-hint">Bağlantı metnin içinde; onu silmeyin.</p>
        </MailDialog>
      )}

      {linking?.step === 'renew' && (
        <Dialog
          title={`${client.number}: bağlantıyı yenile`}
          history
          onClose={() => !busy && setLinking(null)}
          actions={
            <>
              <Button onClick={() => setLinking(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="danger" busy={busy} onClick={() => link('renew')}>
                Yenile
              </Button>
            </>
          }
        >
          <p>Yeni bir bağlantı yapılır; danışanın elindeki eski bağlantı artık açılmaz. Bağlantının başkasının eline geçtiğini düşünüyorsanız kullanın. Sonra yenisini danışana gönderin.</p>
        </Dialog>
      )}

      {adding && !adding.mail && (
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
                onClick={() => (adding.send ? setAdding({ ...adding, mail: addingMail(adding) }) : saveAdding(adding))}
              >
                {adding.send ? 'Devam: e-postayı gör' : 'Ekle'}
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
          <MailChoice send={adding.send} onSend={(send) => setAdding({ ...adding, send })} />
          <p className="k-hint">{adding.send ? 'Sonraki adımda danışana gidecek e-postayı görüp düzeltebilirsiniz.' : 'Danışana e-posta gitmez.'}</p>
        </Dialog>
      )}

      {adding?.mail && (
        <MailDialog
          title={adding.kind === 'closing' ? 'Sonlandırma görüşmesi ekle' : 'Ek seans ekle'}
          to={client.contact}
          mail={adding.mail}
          onMail={(mail) => setAdding({ ...adding, mail })}
          send="Ekle ve gönder"
          busy={busy}
          onClose={() => setAdding({ ...adding, mail: undefined })}
          onSend={() => saveAdding(adding, adding.mail)}
        >
          <p className="k-hint">Görüşme takvime işlenir; ardından bu e-posta danışana gider. Vazgeç ile bir önceki adıma dönersiniz.</p>
        </MailDialog>
      )}
    </section>
  );
}

/** "Danışana e-posta gönder" or "Yalnızca kaydet", in the session dialogs (owner's note 2026-10-22). */
function MailChoice({ send, onSend }: { send: boolean; onSend: (send: boolean) => void }) {
  return (
    <div className="segmented end-choice" role="group" aria-label="Danışana e-posta">
      <button type="button" aria-pressed={send} onClick={() => onSend(true)}>
        Danışana e-posta gönder
      </button>
      <button type="button" aria-pressed={!send} onClick={() => onSend(false)}>
        Yalnızca kaydet
      </button>
    </div>
  );
}
