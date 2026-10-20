/**
 * Randevu ekle (owner's request 2026-10-20): an appointment given by phone or e-mail, with the
 * person's name and e-mail typed in by the owner. It goes into the calendar for good and into
 * Randevu talepleri as approved; optionally the confirmation e-mail goes (with the e-mail check
 * link under it) and the person goes straight to Seans takip.
 */
import { useMemo, useState } from 'react';
import { ApiFailure, type BookingRequest, type Client } from '../../api/types';
import { suggestEmail } from '../../../lib/email-check';
import { formatDay } from '../../../lib/booking-form';
import { decisionMail, type Mail } from '../../lib/booking-mail';
import { usePanel } from '../context';
import { Banner, Button, Dialog, Field, Select } from '../kit';
import { KINDS, kindOf, templateTimes } from './AppointmentCalendar';

export type AddInitial = Partial<{ name: string; email: string; phone: string; lang: 'tr' | 'en'; day: string; time: string; kind: string }>;

export function AddAppointmentDialog({ initial = {}, onClose, onAdded }: { initial?: AddInitial; onClose: () => void; onAdded: (r: BookingRequest, c: Client | null) => void }) {
  const { api } = usePanel();
  const [f, setF] = useState({
    name: initial.name ?? '',
    email: initial.email ?? '',
    phone: initial.phone ?? '',
    lang: initial.lang ?? ('tr' as 'tr' | 'en'),
    day: initial.day ?? '',
    time: initial.time ?? '',
    kind: initial.kind ?? 'individual',
    note: '',
  });
  const [sendMail, setSendMail] = useState(true);
  const [track, setTrack] = useState(false);
  const [edited, setEdited] = useState<Mail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const k = kindOf(f.kind);
  const times = f.day ? templateTimes(f.day) : [];
  const better = suggestEmail(f.email);
  const ready = f.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()) && f.day && f.time;
  const draft: BookingRequest = { id: '', createdAt: 0, ...k, day: f.day || '2026-01-01', time: f.time || '00:00', name: f.name || 'Ad Soyad', email: f.email, phone: f.phone, note: '', lang: f.lang, status: 'approved', holdId: '' };
  const auto = useMemo(() => decisionMail(draft, 'approve'), [f.name, f.day, f.time, f.kind, f.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const mail = edited ?? auto;

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const { request } = await api.requestAdd({ ...k, day: f.day, time: f.time, name: f.name, email: f.email, phone: f.phone, lang: f.lang, note: f.note, ...(sendMail ? { mail } : {}) });
      let client: Client | null = null;
      if (track && k.kind === 'session') client = (await api.requestToClient({ id: request.id })).client;
      onAdded(request, client);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Randevu eklenemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Randevu ekle"
      history
      onClose={() => !busy && onClose()}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant="primary" busy={busy} disabled={!ready} onClick={add}>
            {sendMail ? 'Ekle ve e-postayı gönder' : 'Randevuyu ekle'}
          </Button>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      <div className="add-grid">
        <Field label="Ad soyad" value={f.name} onChange={(name) => setF({ ...f, name })} maxLength={100} />
        <div className="add-email">
          <Field label="E-posta" type="email" value={f.email} onChange={(email) => setF({ ...f, email })} maxLength={254} />
          {better && (
            <p className="email-suggest">
              Bunu mu demek istediniz: <b>{better}</b>{' '}
              <button type="button" onClick={() => setF({ ...f, email: better })}>
                Düzelt
              </button>
            </p>
          )}
        </div>
        <Field label="Telefon (isteğe bağlı)" type="tel" value={f.phone} onChange={(phone) => setF({ ...f, phone })} maxLength={20} />
        <Select label="Konuşma dili" value={f.lang} options={[{ value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'İngilizce' }]} onChange={(lang) => setF({ ...f, lang })} />
        <Field label="Tarih" type="date" value={f.day} onChange={(day) => setF({ ...f, day, time: '' })} />
        <Select
          label="Saat"
          value={f.time}
          options={[{ value: '', label: f.day ? (times.length ? 'Saat seçin…' : 'Bu gün kapalı') : 'Önce tarih seçin' }, ...times.map((t) => ({ value: t, label: t.replace(':', '.') }))]}
          onChange={(time) => setF({ ...f, time })}
        />
        <Select label="Görüşme" value={f.kind} options={KINDS} onChange={(kind) => setF({ ...f, kind })} />
        <Field label="Not (yalnızca sizin için, isteğe bağlı)" value={f.note} onChange={(note) => setF({ ...f, note })} maxLength={500} />
      </div>
      {f.day && f.time && <p className="k-hint">{`${formatDay(f.day, 'tr')}, ${f.time.replace(':', '.')} takvime onaylı olarak işlenir; sitede "Dolu" görünür.`}</p>}
      {k.kind === 'session' && (
        <label className="k-check">
          <input type="checkbox" checked={track} onChange={(e) => setTrack(e.target.checked)} />
          <span>Haftalık seans olarak doğrudan Seans takibe al (her hafta aynı gün ve saat)</span>
        </label>
      )}
      <label className="k-check">
        <input type="checkbox" checked={sendMail} onChange={(e) => setSendMail(e.target.checked)} />
        <span>Kişiye onay e-postası gönder</span>
      </label>
      {sendMail && (
        <div className="stack">
          <Field label="Konu" value={mail.subject} onChange={(subject) => setEdited({ ...mail, subject })} maxLength={200} />
          <Field label="E-posta metni" multiline rows={9} value={mail.body} onChange={(body) => setEdited({ ...mail, body })} maxLength={5000} />
          <p className="k-hint">E-postanın altına, adresin doğru olduğunu onaylatan bir bağlantı kendiliğinden eklenir. Kişi tıklayınca panelde "E-posta doğrulandı" görünür.</p>
        </div>
      )}
    </Dialog>
  );
}
