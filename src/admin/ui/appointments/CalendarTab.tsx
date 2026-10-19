/**
 * Randevular › Takvim (owner's design 2026-10-20): the month at a glance with each day's occupancy,
 * the month's holidays in small type, the day's appointments (one-off entries and the weekly
 * sessions of Randevu takibi), and adding one by hand. Only times, lengths and kinds — no names.
 */
import { useEffect, useMemo, useState } from 'react';
import { ApiFailure, type CalendarEntry, type Client } from '../../api/types';
import booking from '../../../data/booking.json';
import {
  SESSION_TYPES, closedOn, formatDay, holdOf, minutesOf, overlaps, timesFor, weeklyBusy, type BookingConfig, type BookingKind, type BusyInterval,
} from '../../../lib/booking-form';
import { istanbulParts } from '../../lib/draft';
import { go, usePanel } from '../context';
import { CalendarDays } from '../icons';
import { Banner, Button, Dialog, EmptyState, Field, Select, Spinner } from '../kit';

export const cfg = booking as BookingConfig;

/** The kinds of appointment as one choice: the three session types and the intro call. */
export const KINDS = [...SESSION_TYPES.map((t) => ({ value: t.id as string, label: `${t.tr} (${t.minutes} dk)` })), { value: 'intro', label: 'Ücretsiz ön görüşme (30 dk)' }];
export const kindOf = (v: string): { kind: BookingKind; type?: string } => (v === 'intro' ? { kind: 'intro' } : { kind: 'session', type: v });
export const labelOf = (e: { kind: BookingKind; type?: string }) => KINDS.find((k) => k.value === (e.kind === 'intro' ? 'intro' : e.type))?.label ?? 'Görüşme';
export const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const partsOf = (ms: number) => istanbulParts(new Date(ms).toISOString());
export const clock = (ms: number) => partsOf(ms).time.replace(':', '.');
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Every template time of a day, whichever kind it belongs to, ignoring notice and window. */
export function templateTimes(day: string, kind?: BookingKind): string[] {
  const far = Date.parse('2000-01-01T00:00:00Z');
  const open = (k: BookingKind) => timesFor({ ...cfg, [k]: { ...cfg[k], minNoticeHours: 0, weeksAhead: 5000 } }, k, day, far);
  return [...new Set(kind ? open(kind) : [...open('session'), ...open('intro')])].sort();
}

/** Share of a day's template times that are taken (0–1), or null when the day has no times. */
function occupancy(day: string, busy: BusyInterval[]): number | null {
  const times = templateTimes(day);
  if (!times.length) return null;
  const kind: BookingKind = templateTimes(day, 'session').length ? 'session' : 'intro';
  const taken = times.filter((t) => busy.some((b) => overlaps(holdOf(day, t, minutesOf(kind), cfg.restMinutes), b))).length;
  return taken / times.length;
}

type DayItem = { start: number; minutes: number; label: string; note: string; entry?: CalendarEntry };

export function CalendarTab({ add }: { add: { day: string; time: string; type: string } | null }) {
  const { api } = usePanel();
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState<CalendarEntry | null>(null);
  const [form, setForm] = useState({ day: '', time: '', kind: 'individual' });
  const today = partsOf(Date.now()).day;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.calendarList(), api.clientsList()])
      .then(([cal, cl]) => {
        if (!alive) return;
        setEntries(cal.entries);
        setClients(cl.clients);
      })
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Takvim yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const reload = () => setAttempt((n) => n + 1);
  const [y, m] = month.split('-').map(Number);
  const first = Date.parse(`${month}-01T00:00:00+03:00`);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = first + daysInMonth * 24 * 3600e3;

  const busyMonth = useMemo(
    () => [
      ...(entries ?? []).map((e) => ({ start: e.start, end: e.start + (e.minutes + cfg.restMinutes) * 60e3 })),
      ...weeklyBusy(clients, cfg.restMinutes, first, last),
    ],
    [entries, clients, first, last],
  );

  const itemsOf = (day: string): DayItem[] => {
    const from = Date.parse(`${day}T00:00:00+03:00`);
    const to = from + 24 * 3600e3;
    const one: DayItem[] = (entries ?? [])
      .filter((e) => e.start >= from && e.start < to)
      .map((e) => ({ start: e.start, minutes: e.minutes, label: labelOf(e), note: e.status === 'confirmed' ? 'Onaylı' : 'Talep (24 saat tutuluyor)', entry: e }));
    const weekly: DayItem[] = weeklyBusy(clients, 0, from, to).map((b) => {
      const c = clients.find((x) => partsOf(b.start).time === x.time && new Date(`${day}T12:00:00Z`).getUTCDay() === x.weekday)!;
      return { start: b.start, minutes: c?.minutes ?? 50, label: labelOf({ kind: 'session', type: c?.type }), note: `Haftalık seans · ${c?.number ?? ''}` };
    });
    return [...one, ...weekly].sort((a, b) => a.start - b.start);
  };

  const put = async (day: string, time: string, kindValue: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.calendarAdd({ day, time, ...kindOf(kindValue) });
      setNotice(`${formatDay(day, 'tr')}, ${time.replace(':', '.')} takvime işlendi. Bu saat sitede "Dolu" görünüyor.`);
      if (add) go('#/randevular/takvim');
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

  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
    setPicked(null);
  };
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const holidays = cfg.closed.filter((c) => c.date.startsWith(month));
  const times = form.day ? templateTimes(form.day) : [];

  return (
    <div className="appt-tab">
      <p className="k-hint">
        Her randevu, süresi kadar ve ardından {cfg.restMinutes} dakika dinlenme payı kadar yer tutar; site bunlarla çakışan saatleri "Dolu" gösterir. Takvimde yalnızca saat ve
        görüşme türü saklanır.
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
            <Button variant="ghost" onClick={() => go('#/randevular/takvim')}>
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

      {entries && (
        <section className="occ" aria-label="Aylık doluluk">
          <div className="occ-head">
            <Button variant="ghost" aria-label="Önceki ay" onClick={() => shift(-1)}>
              ‹
            </Button>
            <b>
              {MONTHS[m - 1]} {y}
            </b>
            <Button variant="ghost" aria-label="Sonraki ay" onClick={() => shift(1)}>
              ›
            </Button>
          </div>
          <div className="occ-grid" role="grid">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
              <span key={d} className="occ-wd" aria-hidden="true">
                {d}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`l${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = `${month}-${pad(i + 1)}`;
              const occ = occupancy(day, busyMonth);
              const holiday = closedOn(cfg, day);
              const pct = occ === null ? null : Math.round(occ * 100);
              return (
                <button
                  key={day}
                  type="button"
                  className={`occ-day${day === today ? ' is-today' : ''}${picked === day ? ' is-picked' : ''}${holiday && !holiday.from ? ' is-holiday' : ''}`}
                  style={pct ? ({ '--occ': `${pct}%` } as React.CSSProperties) : undefined}
                  aria-label={`${formatDay(day, 'tr')}${holiday ? `, ${holiday.name}` : ''}${pct === null ? '' : `, %${pct} dolu`}`}
                  aria-pressed={picked === day}
                  onClick={() => setPicked(day)}
                >
                  <span className="occ-n">{i + 1}</span>
                  {pct !== null && <span className="occ-pct">%{pct}</span>}
                </button>
              );
            })}
          </div>
          {holidays.length > 0 && (
            <ul className="occ-note">
              {holidays.map((h) => (
                <li key={h.date}>
                  {Number(h.date.slice(8))} {MONTHS[m - 1]}: {h.name} ({h.from ? `${h.from.replace(':', '.')}’ten sonra kapalı` : 'kapalı'})
                </li>
              ))}
            </ul>
          )}
          {picked && (
            <div className="occ-detail">
              <h3>{formatDay(picked, 'tr')}</h3>
              {itemsOf(picked).length === 0 ? (
                <p className="k-hint">Bu gün dolu saat yok.</p>
              ) : (
                <ul className="cal-rows">
                  {itemsOf(picked).map((it) => (
                    <li key={`${it.start}-${it.label}`} className="cal-row">
                      <span className="cal-time">
                        {clock(it.start)}–{clock(it.start + it.minutes * 60e3)}
                      </span>
                      <span className="cal-kind">{it.label}</span>
                      <span className={`badge ${it.entry?.status === 'hold' ? 'badge-planned' : 'badge-live'}`}>{it.note}</span>
                      {it.entry && (
                        <Button variant="ghost" onClick={() => setRemoving(it.entry!)}>
                          Sil
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
      {entries && entries.length === 0 && clients.length === 0 && <EmptyState icon={CalendarDays}>Önümüzdeki günlerde dolu saat yok.</EmptyState>}

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
    </div>
  );
}
