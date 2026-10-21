/**
 * The next seven days at a glance (owner's brief 2026-10-21: visualise): one column a day, today first,
 * each session as a small chip with its time and who, sage for paid sessions and terracotta for the
 * free ones (intro and closing calls); a day without anything says so quietly.
 */
import { WEEKDAYS } from './AppointmentCalendar';

export type WeekItem = { key: string; day: string; time: string; who: string; what: string; link: string; free: boolean };

const istanbulDay = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);

export function WeekStrip({ items, now }: { items: WeekItem[]; now: number }) {
  const days = Array.from({ length: 7 }, (_, i) => istanbulDay(now + i * 864e5));
  return (
    <section className="week" aria-label="Önümüzdeki 7 gün">
      {days.map((d, i) => {
        const date = new Date(`${d}T12:00:00Z`);
        const list = items.filter((x) => x.day === d);
        return (
          <div key={d} className={`week-day${i === 0 ? ' is-today' : ''}`}>
            <span className="week-name">{i === 0 ? 'Bugün' : WEEKDAYS[date.getUTCDay()].slice(0, 3)}</span>
            <span className="week-date">{date.getUTCDate()}</span>
            {list.length ? (
              <ul>
                {list.map((x) => (
                  <li key={x.key} className={x.free ? 'tone-kiremit' : 'tone-adacayi'}>
                    <a href={x.link} title={`${x.what}${x.free ? ' · ücretsiz' : ''}`}>
                      <b>{x.time.replace(':', '.')}</b>
                      <span>{x.who}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="week-empty">Boş</span>
            )}
          </div>
        );
      })}
    </section>
  );
}
