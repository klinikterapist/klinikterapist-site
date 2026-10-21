/**
 * The bell beside the clock on the appointment screens (owner's requests 2026-10-21): a badge with the number of events
 * since the last look; on a press, a notification centre: "Şimdi ilgilenin" (what needs attention,
 * worked out from the clients and requests), then the latest events by day (Bugün, Dün, Daha önce),
 * each with its kind's icon and tone, filtered by tabs, "Tümünü okundu say" and "Tüm bildirimler".
 * Opening it does not clear the marks; reading them does ("Tümünü okundu say", or Bildirimler).
 */
import { useEffect, useRef, useState } from 'react';
import type { PanelEvent, PanelEventKind } from '../api/types';
import { formatDay } from '../../lib/booking-form';
import { Bell, BellDot, CalendarClock, CheckCheck, CircleAlert, HandHeart, Icon, Inbox, TriangleAlert, UserRoundCheck, Wallet, type LucideIcon } from './icons';
import { markSeen, unseenOf, useNotes, type NotificationState } from './notifications';

const EMPTY: NotificationState = { events: [], pending: 0, attention: [], seen: 0, loaded: false, failed: false };
import type { Tone } from './Shell';

/** How each kind of event looks, here and on Bildirimler. */
export const EVENT_LOOK: Record<PanelEventKind, { icon: LucideIcon; tone: Tone; label: string }> = {
  request: { icon: Inbox, tone: 'kiremit', label: 'Talep' },
  decision: { icon: UserRoundCheck, tone: 'adacayi', label: 'Karar' },
  client: { icon: HandHeart, tone: 'adacayi', label: 'Danışan' },
  payment: { icon: Wallet, tone: 'gunes', label: 'Ödeme' },
  reminder: { icon: CalendarClock, tone: 'lavanta', label: 'Hatırlatma' },
  waitlist: { icon: BellDot, tone: 'deniz', label: 'Bekleme listesi' },
  info: { icon: CircleAlert, tone: 'lacivert', label: 'Bilgi' },
};

const TABS: { id: string; label: string; kinds?: PanelEventKind[] }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'request', label: 'Talepler', kinds: ['request', 'decision', 'waitlist', 'info'] },
  { id: 'client', label: 'Danışanlar', kinds: ['client', 'reminder'] },
  { id: 'payment', label: 'Ödemeler', kinds: ['payment'] },
];

/** The preview stays short (owner's review 2026-10-21); everything else is on Bildirimler. */
const PREVIEW = 5;
const dayOf = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
export const timeOf = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(11, 16).replace(':', '.');

/** "Bugün" / "Dün" / "Daha önce", for the day groups. */
export function dayGroup(ms: number, now: number): 'Bugün' | 'Dün' | 'Daha önce' {
  const day = dayOf(ms);
  if (day === dayOf(now)) return 'Bugün';
  if (day === dayOf(now - 864e5)) return 'Dün';
  return 'Daha önce';
}

export function EventRow({ e, isNew, now, onGo }: { e: PanelEvent; isNew: boolean; now: number; onGo?: () => void }) {
  const look = EVENT_LOOK[e.kind] ?? EVENT_LOOK.info;
  const group = dayGroup(e.at, now);
  return (
    <li className={`ev-row${isNew ? ' is-new' : ''}`}>
      <span className={`tone-tile tone-${look.tone}`} aria-hidden="true">
        <Icon as={look.icon} size={16} />
      </span>
      <span className="ev-body">
        {e.link ? (
          <a href={e.link} onClick={onGo}>
            {e.text}
          </a>
        ) : (
          <span>{e.text}</span>
        )}
        <span className="ev-meta">
          {look.label} · {group === 'Daha önce' ? `${formatDay(dayOf(e.at), 'tr')}, ${timeOf(e.at)}` : timeOf(e.at)}
        </span>
      </span>
      {isNew && (
        <span className="ev-dot" aria-label="yeni">
          <span aria-hidden="true" />
        </span>
      )}
    </li>
  );
}

export function NotificationBell() {
  const notes = useNotes() ?? EMPTY;
  const { events, seen, failed, attention } = notes;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const box = useRef<HTMLDivElement>(null);
  const unseen = unseenOf(events, seen);
  const urgent = attention.filter((a) => a.tone === 'err').length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const now = Date.now();
  const kinds = TABS.find((t) => t.id === tab)?.kinds;
  const shown = events.filter((e) => !kinds || kinds.includes(e.kind)).slice(0, PREVIEW);
  const groups = (['Bugün', 'Dün', 'Daha önce'] as const).map((g) => ({ g, rows: shown.filter((e) => dayGroup(e.at, now) === g) })).filter((x) => x.rows.length);
  const label = unseen ? `Bildirimler, ${unseen} yeni` : 'Bildirimler';

  return (
    <div className="bell" ref={box}>
      <button type="button" className={`bell-button${unseen ? ' has-new' : ''}`} aria-expanded={open} aria-controls="bell-preview" aria-label={label} title={label} onClick={() => setOpen(!open)}>
        <Icon as={Bell} size={20} />
        {unseen > 0 && (
          <span className="bell-badge" aria-hidden="true">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
        {!unseen && urgent > 0 && <span className="bell-urgent" aria-hidden="true" />}
      </button>
      {open && (
        <div id="bell-preview" className="bell-preview" role="dialog" aria-label="Son bildirimler">
          <div className="bell-head">
            <div>
              <b>Bildirimler</b>
              <span className="bell-sub">{unseen ? `${unseen} okunmamış` : 'Hepsi okundu'}</span>
            </div>
            <button type="button" className="bell-read" onClick={() => markSeen()} disabled={!unseen}>
              <Icon as={CheckCheck} size={16} />
              Tümünü okundu say
            </button>
          </div>

          {attention.length > 0 && (
            <section className="bell-attention" aria-label="Şimdi ilgilenin">
              <h4>Şimdi ilgilenin</h4>
              <ul>
                {attention.slice(0, 2).map((a) => (
                  <li key={a.key} className={`bell-att bell-att-${a.tone}`}>
                    <Icon as={a.tone === 'err' ? CircleAlert : TriangleAlert} size={16} />
                    <a href={a.link} onClick={() => setOpen(false)}>
                      {a.text}
                    </a>
                  </li>
                ))}
              </ul>
              {attention.length > 2 && <p className="bell-more">{`ve ${attention.length - 2} konu daha`}</p>}
            </section>
          )}

          <div className="segmented bell-tabs" role="group" aria-label="Bildirim türü">
            {TABS.map((t) => (
              <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="bell-scroll">
            {failed && !events.length ? (
              <p className="k-hint">Bildirimler şu an alınamadı.</p>
            ) : !shown.length ? (
              <div className="bell-empty">
                <span className="tone-tile tone-tile-lg tone-gunes" aria-hidden="true">
                  <Icon as={Bell} size={22} />
                </span>
                <p>{events.length ? 'Bu türde bildirim yok.' : 'Henüz bildirim yok.'}</p>
              </div>
            ) : (
              groups.map(({ g, rows }) => (
                <div key={g} className="bell-group">
                  <h4>{g}</h4>
                  <ul className="ev-list">
                    {rows.map((e) => (
                      <EventRow key={e.id} e={e} isNew={e.at > seen} now={now} onGo={() => setOpen(false)} />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          <a className="bell-all" href="#/bildirimler" onClick={() => setOpen(false)}>
            Tüm bildirimler
          </a>
        </div>
      )}
    </div>
  );
}
