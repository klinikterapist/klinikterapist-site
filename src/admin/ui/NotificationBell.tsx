/**
 * The bell in the top right corner (owner's request 2026-10-21): a badge with the number of events
 * since the last look, and on a press a short preview of the latest ones with "Tümünü gör" to
 * Bildirimler. Opening it counts as a look; the "yeni" marks stay while it is open.
 */
import { useEffect, useRef, useState } from 'react';
import type { PanelEvent } from '../api/types';
import { formatDay } from '../../lib/booking-form';
import { Bell, Icon } from './icons';
import { markSeen, unseenOf } from './notifications';

const PREVIEW = 5;
const dayOf = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
const timeOf = (ms: number) => new Date(ms + 3 * 3600e3).toISOString().slice(11, 16).replace(':', '.');

function when(ms: number, now: number): string {
  const day = dayOf(ms);
  if (day === dayOf(now)) return `Bugün ${timeOf(ms)}`;
  if (day === dayOf(now - 864e5)) return `Dün ${timeOf(ms)}`;
  return `${formatDay(day, 'tr')} · ${timeOf(ms)}`;
}

export function NotificationBell({ events, seen, failed }: { events: PanelEvent[]; seen: number; failed: boolean }) {
  const [open, setOpen] = useState(false);
  // What counted as new when the preview opened, so the marks do not vanish under the reader.
  const [openedSeen, setOpenedSeen] = useState(seen);
  const box = useRef<HTMLDivElement>(null);
  const unseen = unseenOf(events, seen);

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

  const toggle = () => {
    if (!open) {
      setOpenedSeen(seen);
      if (unseen) markSeen();
    }
    setOpen(!open);
  };
  const now = Date.now();

  return (
    <div className="bell" ref={box}>
      <button
        type="button"
        className="bell-button"
        aria-expanded={open}
        aria-controls="bell-preview"
        aria-label={unseen ? `Bildirimler, ${unseen} yeni` : 'Bildirimler'}
        onClick={toggle}
      >
        <Icon as={Bell} size={20} />
        {unseen > 0 && (
          <span className="bell-badge" aria-hidden="true">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>
      {open && (
        <div id="bell-preview" className="bell-preview" role="dialog" aria-label="Son bildirimler">
          <div className="bell-head">
            <b>Bildirimler</b>
            <a href="#/bildirimler" onClick={() => setOpen(false)}>
              Tümünü gör
            </a>
          </div>
          {failed && !events.length ? (
            <p className="k-hint">Bildirimler şu an alınamadı.</p>
          ) : !events.length ? (
            <p className="k-hint">Henüz bildirim yok.</p>
          ) : (
            <ul className="bell-list">
              {events.slice(0, PREVIEW).map((e) => (
                <li key={e.id} className={e.at > openedSeen ? 'is-new' : undefined}>
                  {e.link ? (
                    <a href={e.link} onClick={() => setOpen(false)}>
                      {e.text}
                    </a>
                  ) : (
                    <span>{e.text}</span>
                  )}
                  <span className="bell-when">
                    {e.at > openedSeen && <span className="bell-new">Yeni · </span>}
                    {when(e.at, now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
