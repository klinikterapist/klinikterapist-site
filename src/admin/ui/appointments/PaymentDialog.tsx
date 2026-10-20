/**
 * Ücret ve ödeme (owner's decisions 2026-10-20, roadmap Faz 1): the fees for the year, the bank
 * details, an optional payment link and how long before a session the payment is due. Kept in the
 * backend only; they go into the e-mails of people with an appointment (approval, reminders).
 */
import { useEffect, useState } from 'react';
import { ApiFailure } from '../../api/types';
import { SESSION_TYPES } from '../../../lib/booking-form';
import { EMPTY_PAYMENT, istanbulYear, type PaymentSettings } from '../../../lib/payment';
import { usePanel } from '../context';
import { Banner, Button, Dialog, Field, Spinner } from '../kit';

export function PaymentDialog({ onClose, onSaved }: { onClose: () => void; onSaved?: (p: PaymentSettings) => void }) {
  const { api } = usePanel();
  const [form, setForm] = useState<{ year: string; fees: Record<string, string>; bank: string; link: string; dueHours: 24 | 48 } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .paymentGet()
      .then(({ payment }) => {
        if (!alive) return;
        const p = payment.year ? payment : { ...EMPTY_PAYMENT, year: istanbulYear(Date.now()) };
        setForm({ year: String(p.year), fees: Object.fromEntries(SESSION_TYPES.map((t) => [t.id, p.fees[t.id] ? String(p.fees[t.id]) : ''])), bank: p.bank, link: p.link, dueHours: p.dueHours });
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
      const { payment } = await api.paymentSet({ year: Number(form.year) || 0, fees, bank: form.bank, link: form.link, dueHours: form.dueHours });
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
          <Field
            label="Ödeme bilgileri"
            multiline
            rows={4}
            maxLength={600}
            value={form.bank}
            onChange={(bank) => setForm({ ...form, bank })}
            hint="Örneğin: hesap sahibinin adı, banka, IBAN. E-postada olduğu gibi görünür."
          />
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
