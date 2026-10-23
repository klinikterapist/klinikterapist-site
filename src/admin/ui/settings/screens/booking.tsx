/**
 * Ayarlar › Randevu Ayarları (owner's request 2026-10-23): everything about appointments in one place,
 * written to booking.json. Görüşme türleri: each session type on or off, together with its intro-call
 * choice (the two are one setting); supervision has no intro call. Then the weekly times of sessions
 * and of intro calls, the booking rules (notice, how far ahead, rest between appointments) and the
 * closed days (public holidays, leave). "Saat kapat" (a whole day or a stretch of it, at once, without
 * publishing) moved here from the calendar. Opening or closing booking itself stays in Önemli Ayarlar.
 * Saved like the other settings: the site is published again, and the request forms follow within
 * about ten minutes (the backend reads booking.json from the repository).
 */
import { useState } from 'react';
import { ApiFailure } from '../../../api/types';
import { INTRO_FOR, SESSION_TYPES, formatDay, typeOn, type Availability, type BookingConfig, type ClosedDay } from '../../../../lib/booking-form';
import { parseBooking } from '../../../../lib/schemas';
import { usePanel } from '../../context';
import { Banner, Button, Dialog, Field, Toggle } from '../../kit';
import { ListEditor, SettingsForm } from '../fields';
import { useSettingsFile } from '../useSettingsFile';

/** Monday first, as the owner's week runs. */
const DAYS: { key: keyof Availability['weekdays']; name: string }[] = [
  { key: '1', name: 'Pazartesi' },
  { key: '2', name: 'Salı' },
  { key: '3', name: 'Çarşamba' },
  { key: '4', name: 'Perşembe' },
  { key: '5', name: 'Cuma' },
  { key: '6', name: 'Cumartesi' },
  { key: '0', name: 'Pazar' },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** One kind's weekly start times: a row per day, each time a chip with ×, and a time field to add one. */
function WeekTimes({ value, onChange, label }: { value: Availability['weekdays']; onChange: (v: Availability['weekdays']) => void; label: string }) {
  const [adding, setAdding] = useState<Record<string, string>>({});
  const setDay = (key: string, times: string[]) => {
    const next = { ...value };
    if (times.length) next[key as keyof typeof next] = [...new Set(times)].sort();
    else delete next[key as keyof typeof next];
    onChange(next);
  };
  return (
    <div className="week-times" aria-label={label}>
      {DAYS.map((d) => {
        const times = value[d.key] ?? [];
        const draft = adding[d.key] ?? '';
        return (
          <div key={d.key} className="wt-row">
            <span className="wt-day">{d.name}</span>
            <ul className="wt-chips">
              {times.length ? (
                times.map((t) => (
                  <li key={t}>
                    <span>{t.replace(':', '.')}</span>
                    <button
                      type="button"
                      aria-label={`${d.name} ${t} saatini kaldır`}
                      onClick={() =>
                        setDay(
                          d.key,
                          times.filter((x) => x !== t),
                        )
                      }
                    >
                      ×
                    </button>
                  </li>
                ))
              ) : (
                <li className="wt-off">Kapalı</li>
              )}
            </ul>
            <span className="wt-add">
              <input className="k-input" type="time" aria-label={`${d.name} için saat`} value={draft} onChange={(e) => setAdding({ ...adding, [d.key]: e.target.value })} />
              <Button
                disabled={!TIME_RE.test(draft)}
                onClick={() => {
                  setDay(d.key, [...times, draft]);
                  setAdding({ ...adding, [d.key]: '' });
                }}
              >
                Ekle
              </Button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const num = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * "Saat kapat" (owner's decision 2026-10-20; on the calendar until 2026-10-23): closes a whole day or a
 * stretch of it at once, in the backend: taken on the site, grey in the calendar, where "Aç" opens it.
 */
export function CloseHours() {
  const { api } = usePanel();
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const [closing, setClosing] = useState<{
    day: string;
    whole: boolean;
    from: string;
    to: string;
    note: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const close = async () => {
    if (!closing) return;
    setBusy(true);
    setError(null);
    try {
      await api.calendarClose({
        day: closing.day,
        from: closing.whole ? '00:00' : closing.from,
        to: closing.whole ? '24:00' : closing.to,
        note: closing.note,
      });
      setNotice(
        `${formatDay(closing.day, 'tr')}${closing.whole ? ' bütün gün' : `, ${closing.from.replace(':', '.')}–${closing.to.replace(':', '.')}`} kapatıldı. Bu aralık sitede dolu görünür; takvimde gri görünür, oradan "Aç" ile açabilirsiniz.`,
      );
      setClosing(null);
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : 'Kapatılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="k-group">
      <h3 className="k-group-title">Saat Kapat</h3>
      <div className="k-group-card">
        <p className="k-hint">İzin, kongre ya da kişisel bir iş için bir günü ya da bir saat aralığını hemen kapatın. Kaydet'e gerek yoktur; site yayını beklenmez.</p>
        {notice && <Banner tone="success">{notice}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}
        <div>
          <Button
            onClick={() =>
              setClosing({
                day: today,
                whole: true,
                from: '09:00',
                to: '13:00',
                note: '',
              })
            }
          >
            Saat kapat
          </Button>
        </div>
      </div>
      {closing && (
        <Dialog
          title="Saat kapat"
          history
          onClose={() => !busy && setClosing(null)}
          actions={
            <>
              <Button onClick={() => setClosing(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="primary" busy={busy} disabled={!closing.day || (!closing.whole && closing.to <= closing.from)} onClick={close}>
                Kapat
              </Button>
            </>
          }
        >
          <Field label="Gün" type="date" value={closing.day} onChange={(day) => setClosing({ ...closing, day })} />
          <div className="segmented end-choice" role="group" aria-label="Kapatılacak süre">
            <button type="button" aria-pressed={closing.whole} onClick={() => setClosing({ ...closing, whole: true })}>
              Bütün gün
            </button>
            <button type="button" aria-pressed={!closing.whole} onClick={() => setClosing({ ...closing, whole: false })}>
              Saat aralığı
            </button>
          </div>
          {!closing.whole && (
            <div className="add-grid">
              <Field label="Başlangıç" type="time" value={closing.from} onChange={(from) => setClosing({ ...closing, from })} />
              <Field label="Bitiş" type="time" value={closing.to} onChange={(to) => setClosing({ ...closing, to })} />
            </div>
          )}
          <Field label="Not (isteğe bağlı, yalnızca siz görürsünüz)" value={closing.note} maxLength={80} onChange={(note) => setClosing({ ...closing, note })} />
          <p className="k-hint">Bu aralık sitede dolu görünür; danışanlar da kendi sayfalarından buraya erteleyemez. İçindeki mevcut randevular değişmez.</p>
        </Dialog>
      )}
    </div>
  );
}

export function RandevuScreen() {
  const file = useSettingsFile<BookingConfig>('src/data/booking.json', parseBooking, 'Randevu Ayarları');
  return (
    <>
      <SettingsForm title="Randevu Ayarları" screen="randevu" file={file}>
        {(b) => {
          const set = (patch: Partial<BookingConfig>) => file.setValue((x) => ({ ...x, ...patch }));
          const setKind = (kind: 'session' | 'intro', patch: Partial<Availability>) => set({ [kind]: { ...b[kind], ...patch } });
          return (
            <>
              <h3>Görüşme Türleri</h3>
              <p className="k-hint">
                Açık türler seans formunda seçilebilir. Ön görüşme formundaki eşi de türle birlikte açılır ve kapanır. Grup ve yüz yüze terapi kapalıyken formlarda soluk olarak
                "Yakında" / "Şu an uygun değil" yazısıyla görünür; diğer kapalı türler hiç görünmez.
              </p>
              <ul className="type-switches">
                {SESSION_TYPES.map((t) => {
                  const intro = INTRO_FOR.find((f) => f.id === t.id);
                  return (
                    <li key={t.id}>
                      <span className="ts-text">
                        <b>{t.tr}</b>
                        <span className="k-hint">{`${t.minutes} dakika · Ön görüşmede: ${intro ? `“${intro.tr.replace(/\s*\(.*\)$/, '')}”` : 'yok (siz yönlendirirsiniz)'}`}</span>
                        {t.id === 'supervision' && (
                          <span className="k-hint">Sembolik ücretli; görüşmeler süpervizörünüzle paylaşılabileceği için danışandan ayrı bir bilgilendirilmiş onam alınır.</span>
                        )}
                      </span>
                      <Toggle label={typeOn(b, t.id) ? 'Açık' : 'Kapalı'} checked={typeOn(b, t.id)} onChange={(on) => set({ types: { ...b.types, [t.id]: on } })} />
                    </li>
                  );
                })}
              </ul>

              <h3>Seans Saatleri</h3>
              <p className="k-hint">Her gün için seansların başlayabileceği saatler. Saati olmayan gün kapalıdır.</p>
              <WeekTimes label="Seans saatleri" value={b.session.weekdays} onChange={(weekdays) => setKind('session', { weekdays })} />

              <h3>Ön Görüşme Saatleri</h3>
              <p className="k-hint">Ücretsiz ön görüşmelerin başlayabileceği saatler.</p>
              <WeekTimes label="Ön görüşme saatleri" value={b.intro.weekdays} onChange={(weekdays) => setKind('intro', { weekdays })} />

              <h3>Kurallar</h3>
              <div className="add-grid">
                <Field
                  label="Seans: en az kaç saat önceden"
                  type="number"
                  value={String(b.session.minNoticeHours)}
                  onChange={(v) =>
                    setKind('session', {
                      minNoticeHours: num(v, b.session.minNoticeHours),
                    })
                  }
                  error={file.issues['session.minNoticeHours']}
                />
                <Field
                  label="Seans: kaç hafta ileriye"
                  type="number"
                  value={String(b.session.weeksAhead)}
                  onChange={(v) =>
                    setKind('session', {
                      weeksAhead: num(v, b.session.weeksAhead),
                    })
                  }
                  error={file.issues['session.weeksAhead']}
                />
                <Field
                  label="Ön görüşme: en az kaç saat önceden"
                  type="number"
                  value={String(b.intro.minNoticeHours)}
                  onChange={(v) =>
                    setKind('intro', {
                      minNoticeHours: num(v, b.intro.minNoticeHours),
                    })
                  }
                  error={file.issues['intro.minNoticeHours']}
                />
                <Field
                  label="Ön görüşme: kaç hafta ileriye"
                  type="number"
                  value={String(b.intro.weeksAhead)}
                  onChange={(v) => setKind('intro', { weeksAhead: num(v, b.intro.weeksAhead) })}
                  error={file.issues['intro.weeksAhead']}
                />
              </div>
              <Field
                label="Her görüşmeden sonra dinlenme (dakika)"
                type="number"
                value={String(b.restMinutes)}
                onChange={(v) => set({ restMinutes: num(v, b.restMinutes) })}
                hint="Bir randevu, kendi süresi ve bu dinlenme süresi kadar takvimi doldurur."
                error={file.issues.restMinutes}
              />

              <h3>Kapalı Günler</h3>
              <p className="k-hint">
                Resmi tatiller, izin ve kongre günleri. Bu günlerde formlarda saat görünmez. "Şu saatten itibaren" doluysa gün o saatten sonra kapanır (örneğin bayram arifesi
                13.00).
              </p>
              <ListEditor<ClosedDay>
                items={b.closed}
                onChange={(closed) => set({ closed })}
                itemLabel={(c) => (c.date ? `${c.date.split('-').reverse().join('.')} · ${c.name || 'Adsız'}` : 'Yeni kapalı gün')}
                newItem={() => ({ date: '', name: '' })}
                addLabel="Kapalı gün ekle"
                render={(c, update, i) => (
                  <div className="add-grid">
                    <Field label="Tarih" type="date" value={c.date} onChange={(date) => update({ date })} error={file.issues[`closed.${i}.date`]} />
                    <Field label="Açıklama" value={c.name} placeholder="Örneğin: İzin" onChange={(name) => update({ name })} error={file.issues[`closed.${i}.name`]} />
                    <Field label="Şu saatten itibaren (isteğe bağlı)" type="time" value={c.from ?? ''} onChange={(from) => update({ from: from || undefined })} />
                  </div>
                )}
              />

              <h3>Randevu Alımı</h3>
              <p className="k-hint">
                Formları tamamen açıp kapatmak (Türkçe ve İngilizce ayrı) <a href="#/ayarlar/onemli">Önemli Ayarlar</a> ekranındadır.
              </p>
            </>
          );
        }}
      </SettingsForm>
      <section className="settings settings-extra" aria-label="Saat kapat">
        <CloseHours />
      </section>
    </>
  );
}
