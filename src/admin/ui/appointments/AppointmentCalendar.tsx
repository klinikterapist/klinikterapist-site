/**
 * The appointment calendar, the same on Randevu talepleri and Seans takip (owner's design
 * 2026-10-20): the month with each day's occupancy, a green dot for every confirmed appointment
 * (approved requests, entries put in by hand and the weekly sessions of Seans takip) and an amber
 * ring for every request still waiting for an answer, a key to the marks, the month's holidays in
 * small type and the picked day's appointments (the free intro and closing sessions marked as such).
 * The bar under a day is its occupancy; full, it turns red. Adding one is "Randevu ekle" at the top
 * of the page (AddAppointmentDialog).
 * Faz 2 (owner's decision 2026-10-20): "Saat kapat" closes a whole day or a stretch of it (leave,
 * a conference): taken on the site, grey here, "Aç" opens it again. Appointments in it stay.
 */
import { useEffect, useMemo, useState } from 'react';
import { ApiFailure, type CalendarEntry, type Client } from '../../api/types';
import booking from '../../../data/booking.json';
import { SESSION_TYPES, closedOn, formatDay, holdOf, minutesOf, overlaps, timesFor, type BookingConfig, type BookingKind, type BusyInterval } from '../../../lib/booking-form';
import { FREE_KINDS, clientsBusy, sessionsOf, type SessionKind } from '../../../lib/sessions';
import { istanbulParts } from '../../lib/draft';
import { usePanel } from '../context';
import { useFreshData } from '../fresh-data';
import { Banner, Button, Dialog, Field, Spinner } from '../kit';

export const cfg = booking as BookingConfig;

/** The kinds of appointment as one choice: the three session types and the intro call. */
export const KINDS = [...SESSION_TYPES.map((t) => ({ value: t.id as string, label: `${t.tr} (${t.minutes} dk)` })), { value: 'intro', label: 'Ücretsiz ön görüşme (30 dk)' }];
export const kindOf = (v: string): { kind: BookingKind; type?: string } => (v === 'intro' ? { kind: 'intro' } : { kind: 'session', type: v });
export const labelOf = (e: { kind: BookingKind; type?: string }) => KINDS.find((k) => k.value === (e.kind === 'intro' ? 'intro' : e.type))?.label ?? 'Görüşme';
export const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
/** The usual Turkish short names (Cuma and Cumartesi, Pazar and Pazartesi would clash when cut to three letters). */
export const SHORT_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const partsOf = (ms: number) => istanbulParts(new Date(ms).toISOString());
export const clock = (ms: number) => partsOf(ms).time.replace(':', '.');
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const pad = (n: number) => String(n).padStart(2, '0');
const DAY_MS = 24 * 3600e3;

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

type DayItem = { start: number; minutes: number; label: string; note: string; tone: 'ok' | 'wait' | 'closed'; free?: boolean; entry?: CalendarEntry };

/** How a client's session reads in the day list. */
export const SESSION_KIND_LABEL: Record<SessionKind, string> = {
  weekly: 'Haftalık seans',
  intro: 'Ücretsiz ön görüşme',
  closing: 'Sonlandırma görüşmesi (ücretsiz)',
  extra: 'Ek seans',
};

/** Up to three marks of one kind, then "+n". */
function Marks({ n, tone }: { n: number; tone: 'ok' | 'wait' }) {
  if (!n) return null;
  return (
    <span className={`mk-row mk-${tone}`} aria-hidden="true">
      {Array.from({ length: Math.min(n, 3) }, (_, i) => (
        <i key={i} className="mk" />
      ))}
      {n > 3 && <small>+{n - 3}</small>}
    </span>
  );
}

/** `version`: bump it after the page changed something (an approval, a move), so the calendar loads again. */
export function AppointmentCalendar({ version = 0 }: { version?: number }) {
  const { api } = usePanel();
  const fresh = useFreshData(api);
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [removing, setRemoving] = useState<CalendarEntry | null>(null);
  const today = partsOf(Date.now()).day;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  const [closing, setClosing] = useState<{ day: string; whole: boolean; from: string; to: string; note: string } | null>(null);

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
  }, [api, attempt, version, fresh]);

  const reload = () => setAttempt((n) => n + 1);
  const [y, m] = month.split('-').map(Number);
  const first = Date.parse(`${month}-01T00:00:00+03:00`);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = first + daysInMonth * DAY_MS;

  const busyMonth = useMemo(
    () => [
      ...(entries ?? []).map((e) => ({ start: e.start, end: e.start + (e.minutes + (e.status === 'closed' ? 0 : cfg.restMinutes)) * 60e3 })),
      ...clientsBusy(clients, cfg.restMinutes, first, last),
    ],
    [entries, clients, first, last],
  );

  const itemsOf = (day: string): DayItem[] => {
    const from = Date.parse(`${day}T00:00:00+03:00`);
    const to = from + DAY_MS;
    const one: DayItem[] = (entries ?? [])
      .filter((e) => e.start >= from && e.start < to)
      .map((e) =>
        e.status === 'closed'
          ? { start: e.start, minutes: e.minutes, label: 'Kapalı', note: e.note ?? 'Saat kapat', tone: 'closed', entry: e }
          : e.status === 'confirmed'
            ? { start: e.start, minutes: e.minutes, label: labelOf(e), note: 'Onaylı randevu', tone: 'ok', entry: e }
            : { start: e.start, minutes: e.minutes, label: labelOf(e), note: 'Onay bekleyen talep', tone: 'wait', entry: e },
      );
    const tracked: DayItem[] = clients.flatMap((c) =>
      sessionsOf(c, day, day)
        .filter((s) => s.status !== 'cancelled' && s.status !== 'postponed')
        .map((s) => ({
          start: Date.parse(`${s.day}T${s.time}:00+03:00`),
          minutes: s.minutes,
          label: s.kind === 'weekly' ? labelOf({ kind: 'session', type: c.type }) : SESSION_KIND_LABEL[s.kind],
          note: `Seans takip · ${c.number}`,
          tone: 'ok' as const,
          free: FREE_KINDS.includes(s.kind),
        })),
    );
    return [...one, ...tracked].sort((a, b) => a.start - b.start);
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

  const close = async () => {
    if (!closing) return;
    setBusy(true);
    setError(null);
    try {
      await api.calendarClose({ day: closing.day, from: closing.whole ? '00:00' : closing.from, to: closing.whole ? '24:00' : closing.to, note: closing.note });
      setNotice(`${formatDay(closing.day, 'tr')}${closing.whole ? ' bütün gün' : `, ${closing.from.replace(':', '.')}–${closing.to.replace(':', '.')}`} kapatıldı. Bu aralık sitede dolu görünür.`);
      setPicked(closing.day);
      setClosing(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : 'Kapatılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
    setPicked(null);
  };
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const holidays = cfg.closed.filter((c) => c.date.startsWith(month));
  const pickedItems = picked ? itemsOf(picked) : [];

  return (
    <section className="cal-card" aria-label="Randevu takvimi">
      {notice && <Banner tone="success">{notice}</Banner>}
      {error && (
        <Banner tone="error" action={<Button onClick={reload}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}
      {!entries && !error && <Spinner label="Takvim yükleniyor…" />}

      {entries && (
        <>
          <div className="occ-head">
            <b className="occ-month">
              {MONTHS[m - 1]} <span>{y}</span>
            </b>
            <span className="occ-nav">
              <Button variant="ghost" aria-label="Önceki ay" onClick={() => shift(-1)}>
                ‹
              </Button>
              <Button variant="ghost" onClick={() => (setMonth(today.slice(0, 7)), setPicked(today))}>
                Bugün
              </Button>
              <Button variant="ghost" aria-label="Sonraki ay" onClick={() => shift(1)}>
                ›
              </Button>
            </span>
          </div>
          <Button className="occ-close" onClick={() => setClosing({ day: picked && picked >= today ? picked : today, whole: true, from: '09:00', to: '13:00', note: '' })}>
            Saat kapat
          </Button>
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
              const items = itemsOf(day);
              const ok = items.filter((it) => it.tone === 'ok').length;
              const wait = items.filter((it) => it.tone === 'wait').length;
              const shut = items.some((it) => it.tone === 'closed');
              const counts = [ok ? `${ok} onaylı` : '', wait ? `${wait} bekleyen talep` : '', shut ? 'kapalı saat var' : ''].filter(Boolean).join(', ');
              return (
                <button
                  key={day}
                  type="button"
                  className={`occ-day${shut ? ' has-closed' : ''}${pct === 100 ? ' is-full' : ''}${day === today ? ' is-today' : ''}${picked === day ? ' is-picked' : ''}${holiday && !holiday.from ? ' is-holiday' : ''}${day < today ? ' is-past' : ''}`}
                  style={pct ? ({ '--occ': `${pct}%` } as React.CSSProperties) : undefined}
                  aria-label={`${formatDay(day, 'tr')}${holiday ? `, ${holiday.name}` : ''}${pct === null ? '' : pct === 100 ? ', tamamen dolu' : `, %${pct} dolu`}${counts ? `, ${counts}` : ''}`}
                  aria-pressed={picked === day}
                  onClick={() => setPicked(day)}
                >
                  <span className="occ-n">{i + 1}</span>
                  <span className="occ-marks">
                    <Marks n={ok} tone="ok" />
                    <Marks n={wait} tone="wait" />
                  </span>
                  {pct !== null && <span className="occ-bar" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <ul className="occ-legend" aria-label="Takvim işaretleri">
            <li>
              <span className="mk-row mk-ok" aria-hidden="true">
                <i className="mk" />
              </span>
              Onaylı randevu ya da Seans takipteki danışan
            </li>
            <li>
              <span className="mk-row mk-wait" aria-hidden="true">
                <i className="mk" />
              </span>
              Onay bekleyen talep (talep geldikten sonra 24 saat boyunca sizin için ayrılır)
            </li>
            <li>
              <span className="mk-row mk-closed" aria-hidden="true">
                <i className="mk" />
              </span>
              Kapattığınız saat (Saat kapat); sitede dolu görünür
            </li>
            <li>
              <span className="occ-legend-bar" aria-hidden="true" />
              Alttaki çizgi: günün doluluk oranı; gün tamamen dolunca kırmızı
            </li>
            <li>
              <span className="occ-legend-holiday" aria-hidden="true">
                12
              </span>
              Üstü çizili: tatil, kapalı
            </li>
          </ul>
          {holidays.length > 0 && (
            <ul className="occ-note" aria-label="Bu ayın tatilleri">
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
              {pickedItems.length === 0 ? (
                <p className="k-hint">Bu gün dolu saat yok.</p>
              ) : (
                <ul className="day-list">
                  {pickedItems.map((it) => (
                    <li key={`${it.start}-${it.label}-${it.note}`} className={`day-item day-${it.tone}${it.free ? ' is-free' : ''}`}>
                      <span className="mk-row" aria-hidden="true">
                        <i className="mk" />
                      </span>
                      <span className="day-time">
                        {clock(it.start)}–{clock(it.start + it.minutes * 60e3)}
                      </span>
                      <span className="day-what">
                        {it.label}
                        <small>{it.note}</small>
                      </span>
                      {it.entry && (
                        <Button variant="ghost" onClick={() => setRemoving(it.entry!)}>
                          {it.tone === 'closed' ? 'Aç' : 'Sil'}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

        </>
      )}

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

      {removing && (
        <Dialog
          title={removing.status === 'closed' ? 'Kapalı saat açılsın mı?' : 'Randevu silinsin mi?'}
          history
          onClose={() => !busy && setRemoving(null)}
          actions={
            <>
              <Button onClick={() => setRemoving(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="danger" busy={busy} onClick={() => remove(removing)}>
                {removing.status === 'closed' ? 'Aç' : 'Sil'}
              </Button>
            </>
          }
        >
          <p>
            {formatDay(partsOf(removing.start).day, 'tr')}, {clock(removing.start)}–{clock(removing.start + removing.minutes * 60e3)} · {removing.status === 'closed' ? 'Kapalı' : labelOf(removing)}.{' '}
            {removing.status === 'closed' ? 'Açınca bu aralık sitede yeniden boş görünür.' : 'Silince bu saat sitede yeniden açık görünür.'}
          </p>
        </Dialog>
      )}
    </section>
  );
}
