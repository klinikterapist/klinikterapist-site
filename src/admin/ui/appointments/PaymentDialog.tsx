/**
 * Ücret ve ödeme (owner's decisions 2026-10-20, roadmap Faz 1): the fees for the year, the bank
 * details, an optional payment link and how long before a session the payment is due. Kept in the
 * backend only; they go into the e-mails of people with an appointment (approval, reminders).
 */
import { useEffect, useRef, useState } from 'react';
import { ApiFailure } from '../../api/types';
import { SESSION_TYPES } from '../../../lib/booking-form';
import { EMPTY_PAYMENT, istanbulYear, type PaymentSettings } from '../../../lib/payment';
import { usePanel } from '../context';
import { Banner, Button, Dialog, Field, Spinner } from '../kit';

type Form = Omit<PaymentSettings, 'year' | 'fees' | 'qr'> & { year: string; fees: Record<string, string>; qr: string };

/** About 150 KB: the QR code goes inline in every e-mail with the payment details. */
const QR_MAX = 150_000;

export function PaymentDialog({ onClose, onSaved }: { onClose: () => void; onSaved?: (p: PaymentSettings) => void }) {
  const { api } = usePanel();
  const [form, setForm] = useState<Form | null>(null);
  const qrInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .paymentGet()
      .then(({ payment }) => {
        if (!alive) return;
        const p = payment.year ? payment : { ...EMPTY_PAYMENT, year: istanbulYear(Date.now()) };
        setForm({
          year: String(p.year),
          fees: Object.fromEntries(SESSION_TYPES.map((t) => [t.id, p.fees[t.id] ? String(p.fees[t.id]) : ''])),
          bank: p.bank,
          holder: p.holder,
          bankName: p.bankName,
          iban: p.iban,
          link: p.link,
          dueHours: p.dueHours,
          qr: p.qr ?? '',
        });
      })
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Ayarlar yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api]);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const fees = Object.fromEntries(SESSION_TYPES.map((t) => [t.id, Number(form.fees[t.id].replace(/\D/g, '')) || 0]));
      const { payment } = await api.paymentSet({ ...form, year: Number(form.year) || 0, fees });
      onSaved?.(payment);
      onClose();
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Kaydedilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Ücret ve ödeme"
      history
      onClose={() => !busy && onClose()}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant="primary" busy={busy} disabled={!form} onClick={save}>
            Kaydet
          </Button>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      {!form ? (
        !error && <Spinner label="Ayarlar yükleniyor…" />
      ) : (
        <div className="stack pay-form">
          <p className="k-hint">
            Bu bilgiler yalnızca Google tarafında saklanır; sitede ve kodda görünmez. Yalnızca randevusu onaylanan kişilere giden e-postalarda kullanılır: onay e-postası,
            seanstan 3 gün önceki hatırlatma ve ödeme hatırlatmaları.
          </p>
          <Field label="Ücretlerin geçerli olduğu yıl" type="number" value={form.year} onChange={(year) => setForm({ ...form, year })} hint="Her yılbaşından sonra ücretleri ve yılı güncelleyin; panel size hatırlatır." />
          <div className="add-grid">
            {SESSION_TYPES.map((t) => (
              <Field key={t.id} label={`${t.tr} (TL)`} type="number" value={form.fees[t.id]} onChange={(v) => setForm({ ...form, fees: { ...form.fees, [t.id]: v } })} />
            ))}
          </div>
          <Field label="Hesap sahibi" value={form.holder} maxLength={120} onChange={(holder) => setForm({ ...form, holder })} />
          <div className="add-grid">
            <Field label="Banka" value={form.bankName} maxLength={120} onChange={(bankName) => setForm({ ...form, bankName })} />
            <Field label="IBAN" value={form.iban} maxLength={60} placeholder="TR00 0000 …" onChange={(iban) => setForm({ ...form, iban })} />
          </div>
          <p className="k-hint">E-postalarda her biri ayrı satırda görünür; para birimi "Türk lirası (TL)" olarak yazılır.</p>
          {form.bank && !form.holder && !form.bankName && !form.iban && (
            <Banner tone="info">Şu an e-postalarda eski yazdığınız ödeme bilgisi kullanılıyor: "{form.bank}". Yukarıdaki alanları doldurunca onların yerine geçer.</Banner>
          )}
          <div className="k-field image-field">
            <span className="k-label">Ödeme karekodu (isteğe bağlı)</span>
            {form.qr ? <img className="image-preview" src={form.qr} alt="Ödeme karekodu" style={{ maxWidth: 160 }} /> : <div className="image-empty">Karekod yok</div>}
            <div className="row">
              <Button onClick={() => qrInput.current?.click()}>{form.qr ? 'Değiştir' : 'Karekod seç'}</Button>
              {form.qr && (
                <Button variant="ghost" onClick={() => setForm({ ...form, qr: '' })}>
                  Kaldır
                </Button>
              )}
            </div>
            <p className="k-hint">Bankanızın uygulamasından aldığınız karekod görseli (PNG ya da JPG). Ödeme bilgilerinin altında görünür.</p>
            <input
              ref={qrInput}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > QR_MAX) {
                  setError("Karekod görseli PNG ya da JPG olmalı ve 150 KB'ı geçmemeli.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setForm((f) => (f ? { ...f, qr: String(reader.result) } : f));
                reader.readAsDataURL(file);
              }}
            />
          </div>
          <Field label="Ödeme bağlantısı (isteğe bağlı)" type="url" placeholder="https://" value={form.link} onChange={(link) => setForm({ ...form, link })} hint="Bir ödeme hizmetinden aldığınız bağlantı. https:// ile başlamalı." />
          <div className="segmented end-choice" role="group" aria-label="Ödeme son zamanı">
            {([24, 48] as const).map((h) => (
              <button key={h} type="button" aria-pressed={form.dueHours === h} onClick={() => setForm({ ...form, dueHours: h })}>
                {`Seanstan ${h} saat önce`}
              </button>
            ))}
          </div>
          <p className="k-hint">
            Seanstan 3 gün önce hatırlatma ve ödeme isteği, 2 gün önce (ödenmediyse) ikinci hatırlatma gider. Ödeme son zamanı geçtiğinde size e-posta gelir; seans kendiliğinden
            ertelenmez.
          </p>
        </div>
      )}
    </Dialog>
  );
}
