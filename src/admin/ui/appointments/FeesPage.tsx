/**
 * Danışanlar ve Randevular › Ücretlendirme (owner's reviews 2026-10-23; it was Ayarlar › Ücretlendirmeler
 * and before that the "Ücret ve ödeme" window): on top, what came in this month and this year, what is
 * still due and what the next seven days bring (fee-stats.ts); then, side by side, the fees per session
 * type in TL, euro and US dollar with the sessions still waiting for payment, and the payment details
 * (bank, paying from abroad, link, QR code) with the payment time. Kept in the backend only; the TL fees
 * and bank details go into the e-mails of people with an appointment. A client's own fee stays on their page.
 * Each card has its own Kaydet (owner's review 2026-10-23) that saves only that card's fields.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiFailure, type Client } from '../../api/types';
import { SESSION_TYPES, formatDay } from '../../../lib/booking-form';
import { EMPTY_PAYMENT, formatFee, istanbulYear, type PaymentSettings } from '../../../lib/payment';
import { feeStats } from '../../lib/fee-stats';
import { usePanel } from '../context';
import { CalendarClock, CalendarRange, ChevronRight, CircleAlert, Icon, Wallet, type LucideIcon } from '../icons';
import { Banner, Button, Field, Spinner } from '../kit';
import { NowClock } from './TrackingPage';

type Cur = 'TL' | 'EUR' | 'USD';
type Form = Omit<PaymentSettings, 'year' | 'fees' | 'feesFx' | 'fxInfo' | 'qr'> & { year: string; fees: Record<string, Record<Cur, string>>; fxInfo: string; qr: string };

/** About 150 KB: the QR code goes inline in every e-mail with the payment details. */
const QR_MAX = 150_000;
const CURRENCIES: Cur[] = ['TL', 'EUR', 'USD'];

/** The cards with their own Kaydet, and the fields each one saves. */
const PARTS = {
  fees: { keys: ['year', 'fees'], save: 'Ücretleri kaydet' },
  bank: { keys: ['holder', 'bankName', 'iban', 'bank', 'fxInfo', 'link', 'qr'], save: 'Ödeme bilgilerini kaydet' },
  time: { keys: ['dueHours'], save: 'Ödeme zamanını kaydet' },
} satisfies Record<string, { keys: (keyof Form)[]; save: string }>;
type PartId = keyof typeof PARTS;

const digits = (v: string) => Number(v.replace(/\D/g, '')) || 0;
const shown = (n: number | undefined) => (n ? String(n) : '');

const formOf = (p: PaymentSettings): Form => ({
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

const paymentOf = (form: Form): PaymentSettings => {
  const { fees: typed, ...rest } = form;
  return {
    ...rest,
    year: Number(form.year) || 0,
    fees: Object.fromEntries(SESSION_TYPES.map((t) => [t.id, digits(typed[t.id].TL)])),
    feesFx: Object.fromEntries(SESSION_TYPES.map((t) => [t.id, { EUR: digits(typed[t.id].EUR), USD: digits(typed[t.id].USD) }])),
  };
};

export function FeesPage() {
  const { api } = usePanel();
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<PaymentSettings | null>(null);
  const [clients, setClients] = useState<Client[] | null>(null);
  const qrInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<PartId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ part: PartId; tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .paymentGet()
      .then(({ payment }) => {
        if (!alive) return;
        const p = payment.year ? payment : { ...EMPTY_PAYMENT, year: istanbulYear(Date.now()) };
        setSaved(p);
        setForm(formOf(p));
      })
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Ayarlar yüklenemedi. Tekrar deneyin.'));
    api
      .clientsList()
      .then(({ clients }) => alive && setClients(clients))
      .catch(() => alive && setClients([]));
    return () => {
      alive = false;
    };
  }, [api]);

  const dirty = (part: PartId) => !!form && !!saved && PARTS[part].keys.some((k) => JSON.stringify(form[k]) !== JSON.stringify(formOf(saved)[k]));

  /** Saves one card: its fields as on the screen, the others as last saved. */
  const save = async (part: PartId) => {
    if (!form || !saved) return;
    setBusy(part);
    setNotice(null);
    try {
      const base = formOf(saved);
      const p = paymentOf({ ...base, ...Object.fromEntries(PARTS[part].keys.map((k) => [k, form[k]])) });
      await api.paymentSet(p);
      setSaved(p);
      setNotice({ part, tone: 'success', text: 'Kaydedildi. Bundan sonra giden e-postalar bu bilgileri kullanır.' });
    } catch (e) {
      setNotice({ part, tone: 'error', text: e instanceof ApiFailure ? e.message : 'Kaydedilemedi. Tekrar deneyin.' });
    } finally {
      setBusy(null);
    }
  };

  /** A card's foot: the result of its last save, whether it has unsaved changes, and its Kaydet. */
  const foot = (part: PartId): ReactNode => (
    <div className="part-foot">
      {notice?.part === part && <Banner tone={notice.tone}>{notice.text}</Banner>}
      <span className="k-hint">{dirty(part) ? 'Kaydedilmemiş değişiklik var.' : 'Kayıtlı.'}</span>
      <Button variant="primary" busy={busy === part} disabled={!dirty(part) || busy !== null} onClick={() => save(part)}>
        {PARTS[part].save}
      </Button>
    </div>
  );

  const setFee = (id: string, cur: Cur, v: string) => setForm((f) => (f ? { ...f, fees: { ...f.fees, [id]: { ...f.fees[id], [cur]: v } } } : f));
  const stats = saved && clients ? feeStats(clients, saved, Date.now()) : null;
  const tiles: { label: string; sum: { amount: number; count: number }; icon: LucideIcon; tone: string }[] = stats
    ? [
        { label: 'Bu ay alınan', sum: stats.month, icon: Wallet, tone: 'adacayi' },
        { label: 'Bekleyen ödeme', sum: stats.due, icon: CircleAlert, tone: 'kiremit' },
        { label: 'Önümüzdeki 7 gün', sum: stats.next7, icon: CalendarClock, tone: 'lavanta' },
        { label: `${new Date(Date.now() + 3 * 3600e3).getUTCFullYear()} yılında alınan`, sum: stats.year, icon: CalendarRange, tone: 'gunes' },
      ]
    : [];

  return (
    <section className="appt-page fees-page" aria-labelledby="fees-title">
      <div className="screen-head">
        <h2 id="fees-title">
          <Icon as={Wallet} size={22} />
          Ücretlendirme
        </h2>
        <div className="head-actions">
          <NowClock />
        </div>
      </div>
      <p className="settings-intro">Seans ücretleri, ödeme bilgileri ve ödemelerin durumu. Bir danışana özel ücreti onun sayfasından girersiniz.</p>
      {error && <Banner tone="error">{error}</Banner>}

      {stats ? (
        <ul className="v2-tiles fee-tiles" aria-label="Ödemelerin özeti">
          {tiles.map((t) => (
            <li key={t.label} className={`v2-tile tone-${t.tone}`}>
              <span className="tone-tile" aria-hidden="true">
                <Icon as={t.icon} size={18} />
              </span>
              <b>{formatFee(t.sum.amount, 'tr')}</b>
              <span>{`${t.label} · ${t.sum.count} seans`}</span>
            </li>
          ))}
        </ul>
      ) : (
        !error && <Spinner label="Ödemeler hesaplanıyor…" />
      )}

      {form && (
        <div className="fees-grid">
          <div className="fees-col">
            <article className="pf-card" aria-labelledby="fees-table-title">
              <div className="fees-card-head">
                <h3 id="fees-table-title">Seans Ücretleri</h3>
                <label className="fees-year">
                  <span>Yıl</span>
                  <input className="k-input" inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
                </label>
              </div>
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
                          <input
                            className="k-input"
                            inputMode="numeric"
                            placeholder="–"
                            aria-label={`${t.tr}, ${c}`}
                            value={form.fees[t.id][c]}
                            onChange={(e) => setFee(t.id, c, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="k-hint">Her ücreti siz girersiniz; kur çevrilmez. E-postalar şimdilik TL ücretini kullanır; EUR ve USD yurt dışındaki danışanlar için saklanır.</p>
              {foot('fees')}
            </article>

            <article className="pf-card" aria-labelledby="fees-due-title">
              <h3 id="fees-due-title">{`Ödeme Bekleyen Seanslar${stats ? ` (${stats.dueList.length})` : ''}`}</h3>
              {stats && stats.dueList.length ? (
                <ul className="tk-list">
                  {stats.dueList.slice(0, 8).map((d) => (
                    <li key={`${d.clientId}${d.day}${d.time}`} className="tk-row">
                      <span className="tk-number">{d.number}</span>
                      <span className="tk-what">
                        <b>{formatFee(d.fee, 'tr')}</b>
                        <span>{`${formatDay(d.day, 'tr')}, ${d.time.replace(':', '.')}`}</span>
                      </span>
                      <a className="k-btn k-btn-secondary tk-go" href={`#/seans-takip/${d.clientId}`} aria-label={`${d.number}: danışanın sayfasına git`}>
                        Aç
                        <Icon as={ChevronRight} size={16} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="k-hint">{stats ? 'Ödemesi bekleyen seans yok.' : 'Yükleniyor…'}</p>
              )}
              {stats && stats.dueList.length > 8 && <p className="k-hint">{`İlk 8 seans görünüyor; diğerleri danışanların sayfalarında.`}</p>}
            </article>
          </div>

          <div className="fees-col">
            <article className="pf-card" aria-labelledby="fees-bank-title">
              <h3 id="fees-bank-title">Ödeme Bilgileri</h3>
              <Field label="Hesap sahibi" value={form.holder} maxLength={120} onChange={(holder) => setForm({ ...form, holder })} />
              <div className="add-grid">
                <Field label="Banka" value={form.bankName} maxLength={120} onChange={(bankName) => setForm({ ...form, bankName })} />
                <Field label="IBAN" value={form.iban} maxLength={60} placeholder="TR00 0000 …" onChange={(iban) => setForm({ ...form, iban })} />
              </div>
              {form.bank && !form.holder && !form.bankName && !form.iban && (
                <Banner tone="info">Şu an e-postalarda eski yazdığınız ödeme bilgisi kullanılıyor: "{form.bank}". Yukarıdaki alanları doldurunca onların yerine geçer.</Banner>
              )}
              <Field
                label="Yurt dışından ödeme"
                multiline
                rows={3}
                maxLength={600}
                value={form.fxInfo}
                onChange={(fxInfo) => setForm({ ...form, fxInfo })}
                hint="Euro ya da dolarla ödeme için hesap ya da ödeme hizmeti bilgisi."
              />
              <Field label="Ödeme bağlantısı (isteğe bağlı)" type="url" placeholder="https://" value={form.link} onChange={(link) => setForm({ ...form, link })} />
              <div className="fees-qr">
                {form.qr ? <img src={form.qr} alt="Ödeme karekodu" /> : <span className="image-empty">Karekod yok</span>}
                <div className="stack">
                  <b>Ödeme karekodu</b>
                  <span className="k-hint">Bankanızın uygulamasından aldığınız görsel (PNG ya da JPG, en çok 150 KB).</span>
                  <div className="row">
                    <Button onClick={() => qrInput.current?.click()}>{form.qr ? 'Değiştir' : 'Karekod seç'}</Button>
                    {form.qr && (
                      <Button variant="ghost" onClick={() => setForm({ ...form, qr: '' })}>
                        Kaldır
                      </Button>
                    )}
                  </div>
                </div>
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
              {foot('bank')}
            </article>

            <article className="pf-card" aria-labelledby="fees-due-time">
              <h3 id="fees-due-time">Ödeme Zamanı</h3>
              <div className="segmented end-choice" role="group" aria-label="Ödeme son zamanı">
                {([24, 48] as const).map((h) => (
                  <button key={h} type="button" aria-pressed={form.dueHours === h} onClick={() => setForm({ ...form, dueHours: h })}>
                    {`Seanstan ${h} saat önce`}
                  </button>
                ))}
              </div>
              <p className="k-hint">
                Seanstan 3 gün önce hatırlatma ve ödeme isteği, 2 gün önce (ödenmediyse) ikinci hatırlatma gider. Ödeme son zamanı geçince size e-posta gelir.
              </p>
              {foot('time')}
            </article>
          </div>
        </div>
      )}
    </section>
  );
}
