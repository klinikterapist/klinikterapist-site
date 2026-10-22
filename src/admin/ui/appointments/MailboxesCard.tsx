/**
 * E-posta adresleri (owner's decision 2026-10-20, Faz 4), on Terapist profili: where the system's
 * notices go (bildirim@) and which addresses e-mails to people come from (randevu@, bilgi@), the
 * e-mails left today, and a test send. A sender must first be added in Gmail as "Send mail as"
 * (docs/kurulum/eposta-takma-adlari.md); the backend refuses any other address.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type MailSettings, type MailboxKey } from '../../api/types';
import { usePanel } from '../context';
import { Banner, Button, Dialog, Field, Spinner } from '../kit';

const BOXES: { key: MailboxKey; label: string; hint: string; example: string }[] = [
  { key: 'notify', label: 'Bildirimler', hint: 'Yeni talepler, iptaller, ödenmeyen seanslar gibi sistem bildirimleri bu adrese gelir.', example: 'bildirim@klinikterapist.com' },
  { key: 'booking', label: 'Randevu e-postaları', hint: 'Danışanlara giden onay, hatırlatma ve ödeme e-postaları bu adresten gider; cevaplar da buraya gelir.', example: 'randevu@klinikterapist.com' },
  { key: 'info', label: 'Bilgi cevapları', hint: '"Önce bilgi almak istiyorum" formunun cevapları bu adresten gider.', example: 'bilgi@klinikterapist.com' },
  { key: 'contact', label: 'İletişim formu', hint: 'Sitedeki Türkçe iletişim formundan gelen mesajlar bu adrese gelir.', example: 'iletisim@klinikterapist.com' },
  { key: 'contactEn', label: 'İletişim formu (İngilizce)', hint: 'İngilizce iletişim formundan gelen mesajlar bu adrese gelir. Boşsa Türkçe formun adresi kullanılır.', example: 'hello@klinikterapist.com' },
];

export function MailboxesCard() {
  const { api } = usePanel();
  const [data, setData] = useState<MailSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .mailSettings()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'E-posta ayarları yüklenemedi.'));
    return () => {
      alive = false;
    };
  }, [api]);

  const test = async () => {
    setTesting(true);
    setNote(null);
    setError(null);
    try {
      const { sent } = await api.mailTest();
      setNote(`${sent} deneme e-postası gönderildi. Gelen kutunuza bakın: her biri hangi adrese geldiğini ya da hangi adresten gittiğini söyler.`);
      setData(await api.mailSettings());
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Deneme gönderilemedi. Tekrar deneyin.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="k-group mail-boxes">
      <h3 className="tk-group-title">E-posta adresleri</h3>
      {error && <Banner tone="error">{error}</Banner>}
      {note && <Banner tone="success">{note}</Banner>}
      {!data ? (
        !error && <Spinner label="Yükleniyor…" />
      ) : (
        <div className="cl-card">
          <dl className="mb-list">
            {BOXES.map((b) => (
              <div key={b.key}>
                <dt>{b.label}</dt>
                <dd>{data.mailboxes[b.key] || <span className="k-hint">{`Ana adresiniz (${data.owner || 'ayarlanmadı'})`}</span>}</dd>
              </div>
            ))}
          </dl>
          {data.quota !== null && (
            <p className={`mb-quota${data.quota < 20 ? ' is-low' : ''}`}>
              {`Bugün gönderilebilecek e-posta: ${data.quota}`}
              {data.quota < 20 && ' · Az kaldı; hak gece yarısından sonra yenilenir.'}
            </p>
          )}
          <div className="mb-actions">
            <Button onClick={() => setEditing(true)}>Düzenle</Button>
            <Button busy={testing} onClick={test}>
              Deneme gönder
            </Button>
          </div>
        </div>
      )}
      {editing && data && (
        <MailboxesDialog
          data={data}
          onClose={() => setEditing(false)}
          onSaved={(d) => {
            setData(d);
            setNote('Kaydedildi.');
          }}
        />
      )}
    </div>
  );
}

function MailboxesDialog({ data, onClose, onSaved }: { data: MailSettings; onClose: () => void; onSaved: (d: MailSettings) => void }) {
  const { api } = usePanel();
  const [form, setForm] = useState(data.mailboxes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.mailSettingsSet(form));
      onClose();
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Kaydedilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="E-posta adresleri"
      history
      onClose={() => !busy && onClose()}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant="primary" busy={busy} onClick={save}>
            Kaydet
          </Button>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      <div className="stack">
        <p className="k-hint">
          Boş bırakılan alan için ana adresiniz kullanılır. Gönderen adresler önce Gmail'de "Farklı adresten gönder" olarak eklenmelidir (kurulum rehberi:
          eposta-takma-adlari).
        </p>
        {BOXES.map((b) => (
          <Field key={b.key} label={b.label} type="email" placeholder={b.example} value={form[b.key]} onChange={(v) => setForm({ ...form, [b.key]: v })} hint={b.hint} />
        ))}
        <p className="k-hint">
          {data.aliases.length
            ? `Gmail'de ekli gönderen adresler: ${data.aliases.join(', ')}`
            : 'Gmail\'de ekli gönderen adres görünmüyor. Gmail izni yeni verildiyse ya da adres yeni eklendiyse birkaç dakika sonra tekrar bakın.'}
        </p>
      </div>
    </Dialog>
  );
}
