/**
 * Seans takip (owner's design 2026-10-20): clients by number (KT001OGO) with their weekly session,
 * beside the appointment calendar.
 *   - Terapiyi sonlandır: one of two ready e-mails — "Terapi tamamlandı" (the client and their
 *     details are deleted, the weekly time is free) or "Sonlandırma görüşmesi talep et" (a free
 *     closing session; the client is marked and stays until therapy is complete);
 *   - Geri al: moved by mistake — an apology e-mail, and the request is back in Randevu talepleri;
 *   - Sil: removed with no e-mail.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type Client } from '../../api/types';
import { formatDay } from '../../../lib/booking-form';
import { endMail, revertMail, type Mail } from '../../lib/booking-mail';
import { usePanel } from '../context';
import { CalendarCheck, Icon, Plus } from '../icons';
import { Banner, Button, Dialog, EmptyState, Spinner } from '../kit';
import { AddAppointmentDialog } from './AddAppointmentDialog';
import { AppointmentCalendar, WEEKDAYS, labelOf } from './AppointmentCalendar';
import { MailDialog } from './MailDialog';

export const weeklyText = (c: Pick<Client, 'weekday' | 'time' | 'type'>) =>
  `Her ${WEEKDAYS[c.weekday].toLocaleLowerCase('tr-TR')} ${c.time.replace(':', '.')} · ${labelOf({ kind: 'session', type: c.type })}`;

const END_CHOICES = [
  { mode: 'complete', label: 'Terapi tamamlandı', hint: 'Kişiye terapi sürecinin sona erdiğini bildiren e-posta gider. Danışan, bilgileriyle birlikte Seans takipten silinir; haftalık saat takvimde ve sitede yeniden açılır.' },
  { mode: 'closing', label: 'Sonlandırma görüşmesi talep et', hint: 'Kişiye ücretsiz, 25–30 dakikalık sonlandırma görüşmesini anlatan bir davet gider. Danışan takipte kalır ve "Sonlandırma görüşmesi bekleniyor" diye işaretlenir; görüşmeden sonra "Terapi tamamlandı" ile kapatırsınız.' },
] as const;

type Ending = { c: Client; mode: 'complete' | 'closing'; mail: Mail };

export function TrackingPage() {
  const { api } = usePanel();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; link?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [reverting, setReverting] = useState<{ c: Client; mail: Mail } | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [adding, setAdding] = useState(false);

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

  const run = async (job: () => Promise<void>, done: string, link = false) => {
    setBusy(true);
    setError(null);
    try {
      await job();
      setNotice({ text: done, link });
      setEnding(null);
      setReverting(null);
      setDeleting(null);
      setAttempt((n) => n + 1);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'İşlem yapılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const startEnd = (c: Client) => setEnding({ c, mode: 'complete', mail: endMail(c.contact, 'complete') });

  const active = (clients ?? []).filter((c) => c.status !== 'closing');
  const closing = (clients ?? []).filter((c) => c.status === 'closing');

  const row = (c: Client) => (
    <li key={c.id} className="tk-row">
      <a className="tk-open" href={`#/seans-takip/${c.id}`} aria-label={`${c.number}: seansları aç`}>
        <span className="tk-number">{c.number}</span>
        <span className="tk-what">
          <b>{weeklyText(c)}</b>
          <span>{`${formatDay(c.since, 'tr')} tarihinden beri · seansları görmek için tıklayın`}</span>
        </span>
      </a>
      {c.status === 'closing' && <span className="tk-badge">Sonlandırma görüşmesi bekleniyor</span>}
      <span className="row tk-actions">
        <Button variant="primary" onClick={() => startEnd(c)}>
          Terapiyi sonlandır
        </Button>
        <Button onClick={() => setReverting({ c, mail: revertMail(c.contact) })}>Geri al</Button>
        <Button variant="ghost" onClick={() => setDeleting(c)}>
          Sil
        </Button>
      </span>
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
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Icon as={Plus} />
            Randevu ekle
          </Button>
        </div>
      </div>
      <p className="settings-intro">
        Seans takipteki danışanlar ve haftalık seansları. Danışanlar numarayla görünür. Ad ve e-posta yalnızca onlara e-posta gönderebilmeniz için şifreli saklanır; terapi sonlandırılınca
        silinir.
      </p>

      <div className="appt-layout">
        <div className="appt-main">
          {notice && (
            <Banner tone="success" action={notice.link ? <a href="#/randevular">Randevu taleplerine git →</a> : undefined}>
              {notice.text}
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
            <div className="k-group">
              <h3 className="tk-group-title">{`Devam eden (${active.length})`}</h3>
              <ul className="tk-list">{active.map(row)}</ul>
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

      {ending && (
        <MailDialog
          title={`${ending.c.number}: terapiyi sonlandır`}
          to={ending.c.contact}
          mail={ending.mail}
          onMail={(mail) => setEnding({ ...ending, mail })}
          send={ending.mode === 'complete' ? 'Gönder ve takipten çıkar' : 'Daveti gönder'}
          tone={ending.mode === 'complete' ? 'danger' : 'primary'}
          busy={busy}
          onClose={() => setEnding(null)}
          onSend={() =>
            run(
              () => api.clientEnd({ id: ending.c.id, mode: ending.mode, ...ending.mail }),
              ending.mode === 'complete'
                ? `E-posta gönderildi. ${ending.c.number} Seans takipten çıkarıldı, bilgileri silindi; haftalık saat yeniden açık.`
                : `Sonlandırma görüşmesi daveti gönderildi. ${ending.c.number} "Sonlandırma aşamasında" bölümünde.`,
            )
          }
        >
          <div className="segmented end-choice" role="group" aria-label="E-posta türü">
            {END_CHOICES.map((o) => (
              <button key={o.mode} type="button" aria-pressed={ending.mode === o.mode} onClick={() => setEnding({ ...ending, mode: o.mode, mail: endMail(ending.c.contact, o.mode) })}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="k-hint">{END_CHOICES.find((o) => o.mode === ending.mode)!.hint}</p>
        </MailDialog>
      )}

      {adding && (
        <AddAppointmentDialog
          initial={{}}
          onClose={() => setAdding(false)}
          onAdded={(r, client) => {
            setAdding(false);
            setNotice(
              client
                ? { text: `${r.name}, ${client.number} numarasıyla Seans takibe alındı: ${weeklyText(client)}.` }
                : { text: `${r.name} için randevu eklendi. Randevu taleplerinde "Onaylanan" bölümünden Seans takibe geçirebilirsiniz.`, link: true },
            );
            setAttempt((n) => n + 1);
          }}
        />
      )}

      {reverting && (
        <MailDialog
          title={`${reverting.c.number}: geri al`}
          to={reverting.c.contact}
          mail={reverting.mail}
          onMail={(mail) => setReverting({ ...reverting, mail })}
          send="Gönder ve geri al"
          busy={busy}
          onClose={() => setReverting(null)}
          onSend={() =>
            run(
              () => api.clientRevert({ id: reverting.c.id, ...reverting.mail }),
              `Özür e-postası gönderildi. Talep yeniden Randevu taleplerinde "Bekleyen" olarak duruyor; ${reverting.c.number} numaralı haftalık saat açıldı.`,
              true,
            )
          }
        >
          <p>Yanlışlıkla takibe aldığınız kişi Randevu taleplerine, onay bekleyen bir talep olarak döner. Kişiye teknik bir sorundan özür dileyen ve doğru yanıtın bir sonraki e-postada geleceğini söyleyen bu e-posta gider.</p>
        </MailDialog>
      )}

      {deleting && (
        <Dialog
          title={`${deleting.number} silinsin mi?`}
          history
          onClose={() => !busy && setDeleting(null)}
          actions={
            <>
              <Button onClick={() => setDeleting(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="danger" busy={busy} onClick={() => run(() => api.clientEnd({ id: deleting.id, mode: 'delete' }), `${deleting.number} silindi. Haftalık saat yeniden açık.`)}>
                Sil
              </Button>
            </>
          }
        >
          <p>{`${weeklyText(deleting)}. Kişiye e-posta gitmez. Danışan bilgileriyle birlikte silinir; haftalık saat takvimde ve sitede yeniden açılır.`}</p>
        </Dialog>
      )}
    </section>
  );
}
