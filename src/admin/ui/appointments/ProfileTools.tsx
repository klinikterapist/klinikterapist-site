/**
 * The cards under Randevu Özeti's lists (owner's review 2026-10-21: the left side stood empty; new
 * tools): Bu ay (this month's sessions, attendance as a ring, what is not marked or not paid yet),
 * Haftalık doluluk (how full each of the next seven days is, as bars) and Araçlar (the steps used
 * most, one press away).
 */
import type { Client } from '../../api/types';
import { slotInstant } from '../../../lib/booking-form';
import { sessionsOf } from '../../../lib/sessions';
import { hasFee } from '../../lib/attention';
import { CalendarPlus, CalendarX, ClipboardList, Icon, Inbox, Wallet, type LucideIcon } from '../icons';
import { SHORT_DAYS, templateTimes } from './AppointmentCalendar';

const istanbulDay = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** This month so far: paid sessions held, attended and missed, still unmarked, not marked paid. */
export function monthSummary(clients: Client[], now: number) {
  const today = istanbulDay(now);
  const first = `${today.slice(0, 7)}-01`;
  const t = { held: 0, attended: 0, noshow: 0, cancelled: 0, unmarked: 0, unpaid: 0, planned: 0 };
  for (const c of clients) {
    const last = `${today.slice(0, 7)}-31`;
    for (const s of sessionsOf(c, first, last)) {
      if (!hasFee(s)) continue;
      const past = slotInstant(s.day, s.time) <= now;
      if (!past) {
        if (s.status === 'planned') t.planned++;
        continue;
      }
      if (s.status === 'attended') t.attended++;
      else if (s.status === 'noshow') t.noshow++;
      else if (s.status === 'cancelled') t.cancelled++;
      else if (s.status === 'planned') t.unmarked++;
      if (s.status === 'attended' || s.status === 'noshow' || s.late) t.held++;
      if (s.status !== 'planned' && !s.paid) t.unpaid++;
    }
  }
  return t;
}

export function MonthCard({ clients, now }: { clients: Client[]; now: number }) {
  const m = monthSummary(clients, now);
  const marked = m.attended + m.noshow;
  const rate = marked ? Math.round((m.attended / marked) * 100) : null;
  const month = MONTHS[Number(istanbulDay(now).slice(5, 7)) - 1];
  return (
    <article className="pf-card" aria-labelledby="pf-month">
      <h3 id="pf-month">{`${month} ayı`}</h3>
      <div className="pf-month">
        <span
          className="pf-ring"
          role="img"
          aria-label={rate === null ? 'Katılım oranı: henüz işaretli seans yok' : `Katılım oranı yüzde ${rate}`}
          style={{ background: `conic-gradient(var(--p-tone-adacayi) ${rate ?? 0}%, color-mix(in srgb, var(--p-text) 10%, transparent) 0)` }}
        >
          <b>{rate === null ? '–' : `%${rate}`}</b>
          <span>katılım</span>
        </span>
        <dl className="pf-facts">
          <div>
            <dt>Yapılan seans</dt>
            <dd>{m.held}</dd>
          </div>
          <div>
            <dt>Ay sonuna kadar planlı</dt>
            <dd>{m.planned}</dd>
          </div>
          <div className={m.unmarked ? 'is-warn' : ''}>
            <dt>İşaretlenmemiş</dt>
            <dd>{m.unmarked}</dd>
          </div>
          <div className={m.unpaid ? 'is-err' : ''}>
            <dt>Ödemesi işaretlenmemiş</dt>
            <dd>{m.unpaid}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

/** Share of each day's session times taken by the clients' sessions, for the next seven days. */
export function occupancyWeek(clients: Client[], now: number) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = istanbulDay(now + i * 864e5);
    const slots = templateTimes(day, 'session').length;
    const taken = clients.reduce((n, c) => n + sessionsOf(c, day, day).filter((s) => s.status !== 'cancelled' && s.status !== 'postponed').length, 0);
    return { day, slots, taken, share: slots ? Math.min(1, taken / slots) : null };
  });
}

export function OccupancyCard({ clients, now }: { clients: Client[]; now: number }) {
  const week = occupancyWeek(clients, now);
  const open = week.filter((d) => d.share !== null);
  const avg = open.length ? Math.round((open.reduce((a, d) => a + (d.share ?? 0), 0) / open.length) * 100) : null;
  return (
    <article className="pf-card" aria-labelledby="pf-occ">
      <h3 id="pf-occ">Haftalık doluluk</h3>
      <p className="pf-lead">{avg === null ? 'Önümüzdeki 7 günde çalışma saati yok.' : `Önümüzdeki 7 günün ortalaması %${avg}.`}</p>
      <ul className="pf-bars">
        {week.map((d, i) => (
          <li key={d.day} title={d.share === null ? 'Çalışma günü değil' : `${d.taken} / ${d.slots} saat dolu`}>
            <span className="pf-bar">
              <i className={d.share === null ? 'is-off' : d.share >= 1 ? 'is-full' : ''} style={{ height: `${d.share === null ? 100 : Math.max(6, d.share * 100)}%` }} />
            </span>
            <span className="pf-bar-day">{i === 0 ? 'Bugün' : SHORT_DAYS[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</span>
            <span className="pf-bar-n">{d.share === null ? '–' : `${d.taken}/${d.slots}`}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

const TOOLS: { href: string; label: string; note: string; icon: LucideIcon; tone: string }[] = [
  { href: '#/randevular', label: 'Randevu ekle', note: 'Telefonla ya da yüz yüze alınan bir randevuyu girin', icon: CalendarPlus, tone: 'adacayi' },
  { href: '#/seans-takip', label: 'Saat kapat', note: 'İzin, tatil ya da kongre için', icon: CalendarX, tone: 'kiremit' },
  { href: '#/randevular?liste', label: 'Bekleme listesi', note: 'Yer açılınca haber verilecek kişiler', icon: ClipboardList, tone: 'lavanta' },
  { href: '#/seans-takip', label: 'Ücret ve ödeme', note: 'Bu yılın ücretleri ve banka bilgisi', icon: Wallet, tone: 'gunes' },
  { href: '#/randevular', label: 'Talepleri yanıtla', note: 'Onayla, başka saat öner ya da iptal et', icon: Inbox, tone: 'deniz' },
];

export function ToolsCard() {
  return (
    <article className="pf-card pf-tools" aria-labelledby="pf-tools">
      <h3 id="pf-tools">Araçlar</h3>
      <ul>
        {TOOLS.map((t) => (
          <li key={t.label}>
            <a className={`pf-tool tone-${t.tone}`} href={t.href}>
              <span className="tone-tile" aria-hidden="true">
                <Icon as={t.icon} size={18} />
              </span>
              <span>
                <b>{t.label}</b>
                <span>{t.note}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
