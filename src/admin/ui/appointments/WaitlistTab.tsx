/**
 * Randevu talepleri › Bekleme listesi (owner's request 2026-10-20): people who used "Haber et"
 * while booking was closed, kept apart from requests, at most 90 days. The owner offers them a
 * freed time (or tells them booking is open again), books them with Randevu ekle, takes them off
 * the list with a kind e-mail, or deletes them without one.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type WaitlistEntry } from '../../api/types';
import { WAITLIST_KEEP_DAYS, WAITLIST_LABELS } from '../../../lib/waitlist-form';
import { formatDay } from '../../../lib/booking-form';
import { waitlistMail, type Mail } from '../../lib/booking-mail';
import { usePanel } from '../context';
import { Inbox } from '../icons';
import { Banner, Button, Dialog, EmptyState, Field, Select, Spinner } from '../kit';
import { templateTimes } from './AppointmentCalendar';
import { MailDialog } from './MailDialog';
import { initialsOf } from './shared';
import type { AddInitial } from './AddAppointmentDialog';

const L = WAITLIST_LABELS.tr;
const daysLeft = (e: WaitlistEntry) => Math.max(0, WAITLIST_KEEP_DAYS - Math.floor((Date.now() - e.createdAt) / 864e5));

type Writing = { e: WaitlistEntry; mode: 'offer' | 'open' | 'remove'; day: string; time: string; mail: Mail };

export function WaitlistTab({ version, onCount, onBook }: { version: number; onCount: (n: number) => void; onBook: (e: WaitlistEntry, initial: AddInitial) => void }) {
  const { api } = usePanel();
  const [entries, setEntries] = useState<WaitlistEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [writing, setWriting] = useState<Writing | null>(null);
  const [deleting, setDeleting] = useState<WaitlistEntry | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .waitlistList()
      .then(({ entries }) => {
        if (!alive) return;
        setEntries(entries);
        onCount(entries.length);
      })
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Bekleme listesi yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const write = (e: WaitlistEntry, mode: Writing['mode']) => setWriting({ e, mode, day: '', time: '', mail: waitlistMail(e, mode) });
  const remake = (w: Writing, patch: Partial<Writing>) => {
    const n = { ...w, ...patch };
    setWriting({ ...n, mail: waitlistMail(n.e, n.mode, n.day && n.time ? { day: n.day, time: n.time } : undefined) });
  };

  const run = async (job: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await job();
      setNotice(done);
      setWriting(null);
      setDeleting(null);
      setAttempt((n) => n + 1);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'İşlem yapılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="k-hint">{`Randevu alımı kapalıyken sitede "Haber et" formunu dolduranlar. Boşalan bir saat olduğunda onlara buradan yazın. Kayıtlar en fazla ${WAITLIST_KEEP_DAYS} gün tutulur.`}</p>
      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      {!entries && !error && <Spinner label="Bekleme listesi yükleniyor…" />}
      {entries && entries.length === 0 && <EmptyState icon={Inbox}>Bekleme listesinde kimse yok.</EmptyState>}
      {entries && entries.length > 0 && (
        <ul className="rq-list">
          {entries.map((e) => (
            <li key={e.id} className="rq-card rq-is-wait">
              <header className="rq-head">
                <span className="rq-avatar" aria-hidden="true">
                  {initialsOf(e.name)}
                </span>
                <span className="rq-who">
                  <b>{e.name}</b>
                  <span className="rq-type">{e.kinds.map((k) => L[k as keyof typeof L]).join(' · ')}</span>
                  <span>{`${formatDay(new Date(e.createdAt + 3 * 3600e3).toISOString().slice(0, 10), 'tr')} tarihinden beri bekliyor`}</span>
                </span>
                {e.offeredAt && <span className="rq-pill rq-pill-ok">Saat önerildi</span>}
                <span className="rq-kindbox is-wait">
                  <b>Bekleme</b>
                  <small>Listesi</small>
                </span>
              </header>
              <dl className="rq-rows">
                <div>
                  <dt>E-posta</dt>
                  <dd>
                    <a href={`mailto:${e.email}`}>{e.email}</a> <VerifiedMark ok={!!e.verified} />
                  </dd>
                </div>
                <div>
                  <dt>Telefon</dt>
                  <dd>
                    <a href={`tel:${e.phone.replace(/[^\d+]/g, '')}`}>{e.phone}</a>
                  </dd>
                </div>
                <div>
                  <dt>Uygun zamanlar</dt>
                  <dd>{e.times.map((t) => L[t as keyof typeof L]).join(', ') || 'Belirtmedi'}</dd>
                </div>
                <div>
                  <dt>Konuşma dili</dt>
                  <dd>{e.lang === 'en' ? 'İngilizce' : 'Türkçe'}</dd>
                </div>
                {e.reason && (
                  <div className="is-wide">
                    <dt>Başvuru sebebi</dt>
                    <dd>{e.reason}</dd>
                  </div>
                )}
              </dl>
              <footer className="rq-foot">
                <span className="rq-status rq-wait">{`${daysLeft(e)} gün sonra listeden kendiliğinden silinir`}</span>
                <span className="row">
                  <Button variant="primary" onClick={() => write(e, 'offer')}>
                    Saat öner
                  </Button>
                  <Button onClick={() => onBook(e, { name: e.name, email: e.email, phone: e.phone, lang: e.lang, kind: e.kinds[0] ?? 'individual' })}>Randevu ekle</Button>
                  <Button variant="ghost" onClick={() => write(e, 'remove')}>
                    Listeden çıkar
                  </Button>
                  <Button variant="ghost" onClick={() => setDeleting(e)}>
                    Sil
                  </Button>
                </span>
              </footer>
            </li>
          ))}
        </ul>
      )}

      {writing && (
        <MailDialog
          title={writing.mode === 'remove' ? 'Listeden çıkar' : 'Saat öner'}
          to={writing.e}
          mail={writing.mail}
          onMail={(mail) => setWriting({ ...writing, mail })}
          send={writing.mode === 'remove' ? 'Gönder ve listeden çıkar' : 'Gönder'}
          tone={writing.mode === 'remove' ? 'danger' : 'primary'}
          busy={busy}
          onClose={() => setWriting(null)}
          onSend={() =>
            run(
              () => api.waitlistMail({ id: writing.e.id, ...writing.mail, remove: writing.mode === 'remove' }),
              writing.mode === 'remove' ? `E-posta gönderildi; ${writing.e.name} listeden çıkarıldı, bilgileri silindi.` : `E-posta gönderildi. ${writing.e.name} yanıt verene kadar listede kalır.`,
            )
          }
        >
          {writing.mode !== 'remove' && (
            <>
              <div className="segmented end-choice" role="group" aria-label="E-posta türü">
                <button type="button" aria-pressed={writing.mode === 'offer'} onClick={() => remake(writing, { mode: 'offer' })}>
                  Belirli bir saat öner
                </button>
                <button type="button" aria-pressed={writing.mode === 'open'} onClick={() => remake(writing, { mode: 'open' })}>
                  Randevu alımı açıldı
                </button>
              </div>
              {writing.mode === 'offer' && (
                <div className="add-grid">
                  <Field label="Tarih (isteğe bağlı)" type="date" value={writing.day} onChange={(day) => remake(writing, { day, time: '' })} />
                  <Select
                    label="Saat"
                    value={writing.time}
                    options={[{ value: '', label: writing.day ? 'Saat seçin…' : 'Önce tarih seçin' }, ...(writing.day ? templateTimes(writing.day) : []).map((t) => ({ value: t, label: t.replace(':', '.') }))]}
                    onChange={(time) => remake(writing, { time })}
                  />
                </div>
              )}
              <p className="k-hint">Kişi kabul ederse "Randevu ekle" ile randevusunu oluşturun; liste kaydı o zaman silinir.</p>
            </>
          )}
          {writing.mode === 'remove' && <p>Kişiye nazik bir e-posta gider ve listeden çıkarılır; bilgileri silinir.</p>}
        </MailDialog>
      )}

      {deleting && (
        <Dialog
          title={`${deleting.name} silinsin mi?`}
          history
          onClose={() => !busy && setDeleting(null)}
          actions={
            <>
              <Button onClick={() => setDeleting(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="danger" busy={busy} onClick={() => run(() => api.waitlistRemove(deleting.id), `${deleting.name} listeden silindi.`)}>
                Sil
              </Button>
            </>
          }
        >
          <p>Kişiye e-posta gitmez; kaydı ve bilgileri silinir.</p>
        </Dialog>
      )}
    </>
  );
}

export function VerifiedMark({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="rq-pill rq-pill-ok" title="Kişi alındı e-postasındaki bağlantıyı açtı: adres doğru.">
      ✓ E-posta doğrulandı
    </span>
  ) : (
    <span className="rq-pill rq-pill-wait" title="Kişi alındı e-postasındaki bağlantıyı henüz açmadı. Adres yanlış yazılmış olabilir; e-postanız geri dönerse Gmail'de görürsünüz.">
      E-posta henüz doğrulanmadı
    </span>
  );
}
