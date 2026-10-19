/**
 * Randevu takvimi (owner's design 2026-10-20): the taken times the site's booking calendar marks
 * "Dolu". A request holds its time for 24 hours ("Talep"); the owner confirms it here (the request
 * e-mail's "Takvime işle" link opens this screen with the time filled in), adds one made by phone,
 * or removes a cancelled one. Only times, lengths and kinds are kept — no names.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type CalendarEntry } from '../api/types';
import booking from '../../data/booking.json';
import { SESSION_TYPES, formatDay, minutesOf, timesFor, type BookingConfig, type BookingKind } from '../../lib/booking-form';
import { istanbulParts } from '../lib/draft';
import { go, usePanel } from './context';
import { CalendarDays } from './icons';
import { Banner, Button, Dialog, EmptyState, Field, Select, Spinner } from './kit';

const cfg = booking as BookingConfig;

/** The calendar's kinds of appointment as one choice: the three session types and the intro call. */
const KINDS = [...SESSION_TYPES.map((t) => ({ value: t.id as string, label: `${t.tr} (${t.minutes} dk)` })), { value: 'intro', label: 'Ücretsiz ön görüşme (30 dk)' }];
const kindOf = (v: string): { kind: BookingKind; type?: string } => (v === 'intro' ? { kind: 'intro' } : { kind: 'session', type: v });
const labelOf = (e: Pick<CalendarEntry, 'kind' | 'type'>) => KINDS.find((k) => k.value === (e.kind === 'intro' ? 'intro' : e.type))?.label ?? 'Görüşme';

const partsOf = (ms: number) => istanbulParts(new Date(ms).toISOString());
const clock = (ms: number) => partsOf(ms).time.replace(':', '.');

/** Every template time of a day, whichever kind it belongs to (the owner may book outside the free list too). */
function templateTimes(day: string): string[] {
  const far = Date.parse('2000-01-01T00:00:00Z');
  const all = new Set([...timesFor({ ...cfg, session: { ...cfg.session, minNoticeHours: 0, weeksAhead: 2000 } }, 'session', day, far), ...timesFor({ ...cfg, intro: { ...cfg.intro, minNoticeHours: 0, weeksAhead: 2000 } }, 'intro', day, far)]);
  return [...all].sort();
}

export function CalendarPage({ add }: { add: { day: string; time: string; type: string } | null }) {
  const { api } = usePanel();
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState<CalendarEntry | null>(null);
  const [form, setForm] = useState({ day: '', time: '', kind: 'individual' });

  useEffect(() => {
    let alive = true;
    api
      .calendarList()
      .then(({ entries }) => alive && setEntries(entries))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Takvim yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const reload = () => setAttempt((n) => n + 1);

  const put = async (day: string, time: string, kindValue: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.calendarAdd({ day, time, ...kindOf(kindValue) });
      setNotice(`${formatDay(day, 'tr')}, ${time.replace(':', '.')} takvime işlendi. Bu saat sitede "Dolu" görünüyor.`);
      if (add) go('#/randevular');
      reload();
      return true;
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Takvime işlenemedi. Tekrar deneyin.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: CalendarEntry) => {
    setBusy(true);
    setError(null);
    try {
      await api.calendarRemove(e.id);
      setNotice('Silindi. Bu saat sitede yeniden açık görünüyor.');
      reload();
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : 'Silinemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  };

  const days = new Map<string, CalendarEntry[]>();
  for (const e of entries ?? []) {
    const d = partsOf(e.start).day;
    days.set(d, [...(days.get(d) ?? []), e]);
  }
  const times = form.day ? templateTimes(form.day) : [];

  return (
    <section aria-labelledby="calendar-title">
      <div className="screen-head">
        <h2 id="calendar-title">Randevu takvimi</h2>
      </div>
      <p className="k-hint">
        Burada dolu saatler durur; site bunlarla çakışan saatleri "Dolu" gösterir. Her randevu, süresi kadar ve ardından {cfg.restMinutes} dakika dinlenme payı
        kadar yer tutar. Yalnızca saat ve görüşme türü saklanır; ad ya da iletişim bilgisi saklanmaz.
      </p>

      {add && (
        <div className="cal-confirm" role="region" aria-label="Takvime işlenecek randevu">
          <p>
            <b>Bu randevuyu takvime işleyin:</b> {formatDay(add.day, 'tr')}, {add.time.replace(':', '.')} · {labelOf(kindOf(add.type))}
          </p>
          <div className="row">
            <Button variant="primary" busy={busy} onClick={() => put(add.day, add.time, add.type)}>
              Takvime işle
            </Button>
            <Button variant="ghost" onClick={() => go('#/randevular')}>
              Vazgeç
            </Button>
          </div>
        </div>
      )}
      {notice && <Banner tone="success">{notice}</Banner>}
      {error && (
        <Banner tone="error" action={<Button onClick={reload}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}

      {!entries && !error && <Spinner label="Takvim yükleniyor…" />}
      {entries && entries.length === 0 && <EmptyState icon={CalendarDays}>Önümüzdeki günlerde dolu saat yok.</EmptyState>}
      {entries && entries.length > 0 && (
        <ul className="cal-days">
          {[...days].map(([day, list]) => (
            <li key={day}>
              <h3>{formatDay(day, 'tr')}</h3>
              <ul className="cal-rows">
                {list.map((e) => (
                  <li key={e.id} className="cal-row">
                    <span className="cal-time">
                      {clock(e.start)}–{clock(e.start + e.minutes * 60e3)}
                    </span>
                    <span className="cal-kind">{labelOf(e)}</span>
                    {e.status === 'confirmed' ? (
                      <span className="badge badge-live">Onaylı</span>
                    ) : (
                      <span className="badge badge-planned">Talep · {clock(e.holdUntil ?? e.start)}'e kadar tutuluyor</span>
                    )}
                    <span className="row">
                      {e.status === 'hold' && (
                        <Button busy={busy} onClick={() => put(day, partsOf(e.start).time, e.kind === 'intro' ? 'intro' : (e.type ?? 'individual'))}>
                          Onayla
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => setRemoving(e)}>
                        Sil
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <h3 className="home-section-title">Elle randevu ekle</h3>
      <p className="k-hint">Telefonla ya da e-postayla verdiğiniz bir randevuyu buradan ekleyin; o saat sitede "Dolu" görünür.</p>
      <div className="cal-form">
        <Field label="Tarih" type="date" value={form.day} onChange={(day) => setForm({ ...form, day, time: '' })} />
        <Select
          label="Saat"
          value={form.time}
          options={[{ value: '', label: form.day ? (times.length ? 'Saat seçin…' : 'Bu gün kapalı') : 'Önce tarih seçin' }, ...times.map((t) => ({ value: t, label: t.replace(':', '.') }))]}
          onChange={(time) => setForm({ ...form, time })}
        />
        <Select label="Görüşme" value={form.kind} options={KINDS} onChange={(kind) => setForm({ ...form, kind })} />
        <Button
          variant="primary"
          busy={busy}
          disabled={!form.day || !form.time}
          onClick={async () => {
            if (await put(form.day, form.time, form.kind)) setForm({ day: '', time: '', kind: form.kind });
          }}
        >
          Ekle
        </Button>
      </div>
      <p className="k-hint">{`Süreler: bireysel ${minutesOf('session', 'individual')}, çift ${minutesOf('session', 'couple')}, ön görüşme ${minutesOf('intro')} dakika.`}</p>

      {removing && (
        <Dialog
          title="Randevu silinsin mi?"
          history
          onClose={() => !busy && setRemoving(null)}
          actions={
            <>
              <Button onClick={() => setRemoving(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="danger" busy={busy} onClick={() => remove(removing)}>
                Sil
              </Button>
            </>
          }
        >
          <p>
            {formatDay(partsOf(removing.start).day, 'tr')}, {clock(removing.start)} · {labelOf(removing)}. Silince bu saat sitede yeniden açık görünür.
          </p>
        </Dialog>
      )}
    </section>
  );
}
