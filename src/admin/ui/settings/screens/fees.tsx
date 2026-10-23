/**
 * Ayarlar › Ücretlendirmeler (owner's request 2026-10-23; it was the "Ücret ve ödeme" window on
 * Danışanlar): the fees for the year per session type in TL, euro and US dollar (each set by the owner,
 * no exchange rate), the bank details, how to pay from abroad, an optional payment link and QR code,
 * and how long before a session the payment is due. Kept in the backend only; the TL fees and bank
 * details go into the e-mails of people with an appointment (approval, reminders). A client's own fee
 * stays on their page.
 */
import { useEffect, useRef, useState } from 'react';
import { ApiFailure } from '../../../api/types';
import { SESSION_TYPES } from '../../../../lib/booking-form';
import { EMPTY_PAYMENT, istanbulYear, type PaymentSettings } from '../../../../lib/payment';
import { usePanel } from '../../context';
import { Icon } from '../../icons';
import { Banner, Button, Field, Spinner } from '../../kit';
import { SETTINGS_SCREENS } from '../screens';

type Cur = 'TL' | 'EUR' | 'USD';
type Form = Omit<PaymentSettings, 'year' | 'fees' | 'feesFx' | 'fxInfo' | 'qr'> & { year: string; fees: Record<string, Record<Cur, string>>; fxInfo: string; qr: string };

/** About 150 KB: the QR code goes inline in every e-mail with the payment details. */
const QR_MAX = 150_000;
const CURRENCIES: Cur[] = ['TL', 'EUR', 'USD'];

const digits = (v: string) => Number(v.replace(/\D/g, '')) || 0;
const shown = (n: number | undefined) => (n ? String(n) : '');

export function UcretlerScreen() {
  const { api } = usePanel();
  const meta = SETTINGS_SCREENS.find((x) => x.id === 'ucretler')!;
  const [form, setForm] = useState<Form | null>(null);
  const qrInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .paymentGet()
      .then(({ payment }) => {
        if (!alive) return;
        const p = payment.year ? payment : { ...EMPTY_PAYMENT, year: istanbulYear(Date.now()) };
        setForm({
          year: String(p.year),
          fees: Object.fromEntries(SESSION_TYPES.map((t) => [t.id, { TL: shown(p.fees[t.id]), EUR: shown(p.feesFx?.[t.id]?.EUR), USD: shown(p.feesFx?.[t.id]?.USD) }])),
          fxInfo: p.fxInfo ?? '',
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
    setNotice(null);
    try {
      const { fees: typed, ...rest } = form;
      const fees = Object.fromEntries(SESSION_TYPES.map((t) => [t.id, digits(typed[t.id].TL)]));
      const feesFx = Object.fromEntries(SESSION_TYPES.map((t) => [t.id, { EUR: digits(typed[t.id].EUR), USD: digits(typed[t.id].USD) }]));
      await api.paymentSet({ ...rest, year: Number(form.year) || 0, fees, feesFx });
      setNotice('Kaydedildi. Bundan sonra giden onay ve hatırlatma e-postaları bu bilgileri kullanır.');
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Kaydedilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const setFee = (id: string, cur: Cur, v: string) => setForm((f) => (f ? { ...f, fees: { ...f.fees, [id]: { ...f.fees[id], [cur]: v } } } : f));

  return (
    <section className="settings" aria-labelledby="settings-screen-title">
      <div className="screen-head">
        <h2 id="settings-screen-title">
          <Icon as={meta.icon} size={22} />
          {meta.label}
        </h2>
      </div>
      <p className="settings-intro">{meta.intro}</p>
      {error && <Banner tone="error">{error}</Banner>}
      {!form ? (
        !error && <Spinner label="Ayarlar yükleniyor…" />
      ) : (
        <div className="settings-form pay-form">
          <div className="k-group">
            <h3 className="k-group-title">Seans Ücretleri</h3>
            <div className="k-group-card">
              <Field label="Ücretlerin geçerli olduğu yıl" type="number" value={form.year} onChange={(year) => setForm({ ...form, year })} hint="Her yılbaşından sonra ücretleri ve yılı güncelleyin; panel size hatırlatır." />
              <table className="fee-table">
                <thead>
                  <tr>
                    <th scope="col">Görüşme türü</th>
                    {CURRENCIES.map((c) => (
                      <th key={c} scope="col">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SESSION_TYPES.map((t) => (
                    <tr key={t.id}>
                      <th scope="row">{t.tr}</th>
                      {CURRENCIES.map((c) => (
                        <td key={c}>
                          <input className="k-input" inputMode="numeric" aria-label={`${t.tr}, ${c}`} value={form.fees[t.id][c]} onChange={(e) => setFee(t.id, c, e.target.value)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="k-hint">
                Her ücreti siz girersiniz; kur çevrilmez. Boş bırakılan ücret girilmemiş sayılır. E-postalar şimdilik TL ücretini kullanır; EUR ve USD ücretleri yurt dışındaki
                danışanlar için saklanır. Bir danışana özel ücreti onun sayfasından girersiniz.
              </p>
            </div>
          </div>

          <div className="k-group">
            <h3 className="k-group-title">Ödeme Bilgileri</h3>
            <div className="k-group-card">
              <p className="k-hint">
                Bu bilgiler yalnızca Google tarafında saklanır; sitede ve kodda görünmez. Yalnızca randevusu onaylanan kişilere giden e-postalarda kullanılır: onay e-postası,
                seanstan 3 gün önceki hatırlatma ve ödeme hatırlatmaları.
              </p>
              <Field label="Hesap sahibi" value={form.holder} maxLength={120} onChange={(holder) => setForm({ ...form, holder })} />
              <div className="add-grid">
                <Field label="Banka" value={form.bankName} maxLength={120} onChange={(bankName) => setForm({ ...form, bankName })} />
                <Field label="IBAN" value={form.iban} maxLength={60} placeholder="TR00 0000 …" onChange={(iban) => setForm({ ...form, iban })} />
              </div>
              <p className="k-hint">E-postalarda her biri ayrı satırda görünür; para birimi "Türk lirası (TL)" olarak yazılır.</p>
              {form.bank && !form.holder && !form.bankName && !form.iban && (
                <Banner tone="info">Şu an e-postalarda eski yazdığınız ödeme bilgisi kullanılıyor: "{form.bank}". Yukarıdaki alanları doldurunca onların yerine geçer.</Banner>
              )}
              <Field
                label="Yurt dışından ödeme bilgisi"
                multiline
                rows={3}
                maxLength={600}
                value={form.fxInfo}
                onChange={(fxInfo) => setForm({ ...form, fxInfo })}
                hint="Euro ya da dolarla ödeme için hesap ya da ödeme hizmeti bilgisi (örneğin döviz IBAN'ı). Yurt dışındaki danışanlara ileteceğiniz metin."
              />
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
            </div>
          </div>

          <div className="k-group">
            <h3 className="k-group-title">Ödeme Zamanı</h3>
            <div className="k-group-card">
              <div className="segmented end-choice" role="group" aria-label="Ödeme son zamanı">
                {([24, 48] as const).map((h) => (
                  <button key={h} type="button" aria-pressed={form.dueHours === h} onClick={() => setForm({ ...form, dueHours: h })}>
                    {`Seanstan ${h} saat önce`}
                  </button>
                ))}
              </div>
              <p className="k-hint">
                Seanstan 3 gün önce hatırlatma ve ödeme isteği, 2 gün önce (ödenmediyse) ikinci hatırlatma gider. Ödeme son zamanı geçtiğinde size e-posta gelir; seans
                kendiliğinden ertelenmez.
              </p>
            </div>
          </div>

          <div className="save-bar">
            {notice && <Banner tone="success">{notice}</Banner>}
            <Button variant="primary" busy={busy} onClick={save}>
              Kaydet
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
