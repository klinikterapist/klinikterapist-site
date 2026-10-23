/**
 * Danışanlar' tools (owner's review 2026-10-23): one quiet row of buttons. "Danışana e-posta" opens the
 * writing window (ComposeDialog), "Takvim kapatma" closes a day or hours (CloseHoursDialog); "Seans
 * ekle" and "Ücretlendirme" open their pages.
 */
import { useState } from 'react';
import type { Client } from '../../api/types';
import { CalendarPlus, CalendarX, Icon, Mail, Wallet } from '../icons';
import { Banner } from '../kit';
import { CloseHoursDialog } from './CloseHoursDialog';
import { ComposeDialog } from './ComposeDialog';

export function ClientTools({ clients, onChanged }: { clients: Client[]; onChanged?: () => void }) {
  const [open, setOpen] = useState<'mail' | 'close' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const done = (message: string) => {
    setOpen(null);
    setNotice(message);
    onChanged?.();
  };
  return (
    <div className="client-tools">
      <nav className="tool-row" aria-label="Araçlar">
        <button type="button" className="tool-btn tone-lavanta" onClick={() => setOpen('mail')}>
          <Icon as={Mail} size={16} />
          Danışana e-posta
        </button>
        <a className="tool-btn tone-adacayi" href="#/randevular?ekle=yeni">
          <Icon as={CalendarPlus} size={16} />
          Seans ekle
        </a>
        <button type="button" className="tool-btn tone-kiremit" onClick={() => setOpen('close')}>
          <Icon as={CalendarX} size={16} />
          Takvim kapatma
        </button>
        <a className="tool-btn tone-gunes" href="#/ucretlendirme">
          <Icon as={Wallet} size={16} />
          Ücretlendirme
        </a>
      </nav>
      {notice && <Banner tone="success">{notice}</Banner>}
      {open === 'mail' && <ComposeDialog clients={clients} onClose={() => setOpen(null)} onSent={done} />}
      {open === 'close' && <CloseHoursDialog onClose={() => setOpen(null)} onDone={done} />}
    </div>
  );
}
