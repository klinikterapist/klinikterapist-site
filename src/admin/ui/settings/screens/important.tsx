/**
 * Önemli ayarlar (owner's request 2026-10-21): switches that change what every visitor can do, set
 * apart in a red frame and asked twice. For now Randevu alımı, per language (it used to be one
 * switch on Randevu Talepleri). Closing writes booking.json (booking.ts `setOpen`): the forms of that
 * language close at once and offer "Haber et"; the site's "Randevu Al" buttons say "Randevu alımına
 * kapalı" after the next publish, a few minutes later. More switches of this weight come here later.
 */
import { useEffect, useState } from 'react';
import { ApiFailure } from '../../../api/types';
import { usePanel } from '../../context';
import { CalendarCheck, CalendarX, Icon } from '../../icons';
import { Banner, Button, Dialog, Spinner } from '../../kit';
import { SETTINGS_SCREENS } from '../screens';

type Lang = 'tr' | 'en';
type State = { open: Record<Lang, boolean>; waiting: number };

const LANGS: { lang: Lang; title: string; where: string }[] = [
  { lang: 'tr', title: 'Türkçe randevu alımı', where: 'Türkçe sitedeki randevu ve ön görüşme formları' },
  { lang: 'en', title: 'İngilizce randevu alımı', where: 'İngilizce sitedeki ("Book a Session") randevu ve ön görüşme formları' },
];

export function OnemliScreen() {
  const { api } = usePanel();
  const meta = SETTINGS_SCREENS.find((s) => s.id === 'onemli')!;
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ lang: Lang; open: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    api
      .bookingState()
      .then((s) => alive && setState(s))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Randevu alımının durumu okunamadı. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const apply = async () => {
    if (!asking) return;
    const { lang, open } = asking;
    const name = LANGS.find((l) => l.lang === lang)!.title;
    setBusy(true);
    setError(null);
    try {
      await api.bookingSetOpen(open, lang);
      setState((s) => (s ? { ...s, open: { ...s.open, [lang]: open } } : s));
      setAsking(null);
      setNotice(
        open
          ? `${name} açıldı. Formlar hemen açıldı; "Randevu Al" düğmeleri birkaç dakika içinde, site yeniden yayınlanınca normale döner.${state?.waiting ? ` Bekleme listesinde ${state.waiting} kişi var: Randevu Talepleri › "Bekleme listesi"nden onlara haber verebilirsiniz.` : ''}`
          : `${name} kapatıldı. Formların yerinde "Randevu alımı şu an kapalı" yazısı ve "Haber et" formu var; "Randevu Al" düğmeleri birkaç dakika içinde "Randevu alımına kapalı" olur.`,
      );
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Değiştirilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const asked = asking && LANGS.find((l) => l.lang === asking.lang)!;

  return (
    <section className="settings" aria-labelledby="settings-screen-title">
      <div className="screen-head">
        <h2 id="settings-screen-title">
          <Icon as={meta.icon} size={22} />
          {meta.label}
        </h2>
      </div>
      <p className="settings-intro">{meta.intro}</p>
      {error && (
        <Banner tone="error" action={!state ? <Button onClick={() => setAttempt((n) => n + 1)}>Tekrar dene</Button> : undefined}>
          {error}
        </Banner>
      )}
      {notice && <Banner tone="success">{notice}</Banner>}
      {!state && !error && <Spinner />}
      {state && (
        <div className="danger-zone" role="group" aria-labelledby="dz-booking">
          <h3 id="dz-booking">Randevu alımı</h3>
          <p className="k-hint">
            Resmi bir süreç, sağlık ya da izin gibi bir nedenle yeni randevu almayı hemen durdurmanız gerekirse buradan kapatın. Gelmiş talepler, onaylı randevular ve danışanlarınızın seansları olduğu gibi kalır.
          </p>
          {LANGS.map(({ lang, title }) => {
            const open = state.open[lang];
            return (
              <div key={lang} className="danger-row">
                <span className={`tone-tile ${open ? 'tone-adacayi' : 'tone-kiremit'}`} aria-hidden="true">
                  <Icon as={open ? CalendarCheck : CalendarX} size={18} />
                </span>
                <span className="danger-text">
                  <b>{title}</b>
                  <small>{open ? 'Açık: ziyaretçiler randevu ve ön görüşme talebi gönderebilir.' : 'Kapalı: sitede "Randevu alımına kapalı" yazıyor, yalnızca "Haber et" formu açık.'}</small>
                </span>
                <Button variant={open ? 'danger' : 'primary'} onClick={() => setAsking({ lang, open: !open })}>
                  {open ? 'Kapat' : 'Aç'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {asking && asked && (
        <Dialog
          title={`${asked.title} ${asking.open ? 'açılsın mı?' : 'kapatılsın mı?'}`}
          history
          onClose={() => !busy && setAsking(null)}
          actions={
            <>
              <Button onClick={() => setAsking(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant={asking.open ? 'primary' : 'danger'} busy={busy} onClick={apply}>
                {asking.open ? 'Randevu alımını aç' : 'Randevu alımını kapat'}
              </Button>
            </>
          }
        >
          {asking.open ? (
            <>
              <p>{asked.where} hemen açılır; takvim yeniden görünür.</p>
              <p>"Randevu Al" düğmeleri birkaç dakika içinde, site yeniden yayınlanınca normale döner.</p>
            </>
          ) : (
            <>
              <p>{asked.where} hemen kapanır. Yerlerinde "Randevu alımı şu an kapalı" yazısı ve "Haber et" formu görünür; formu dolduranlar "Bekleme listesi"ne düşer.</p>
              <p>"Randevu Al" düğmelerinde birkaç dakika içinde, site yeniden yayınlanınca "Randevu alımına kapalı" yazar.</p>
              <p>Gelmiş talepler, onaylı randevular ve danışanlarınızın seansları olduğu gibi kalır.</p>
            </>
          )}
        </Dialog>
      )}
    </section>
  );
}
