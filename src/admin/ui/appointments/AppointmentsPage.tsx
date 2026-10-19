/** Randevular: Talepler, Takvim and Danışanlar (Randevu takibi) as tabs (owner's design 2026-10-20). */
import { useState } from 'react';
import type { Client } from '../../api/types';
import { go, type AppointmentsTab } from '../context';
import { CalendarTab } from './CalendarTab';
import { ClientsTab } from './ClientsTab';
import { RequestsTab } from './RequestsTab';

const TABS: { id: AppointmentsTab; label: string; href: string }[] = [
  { id: 'requests', label: 'Talepler', href: '#/randevular' },
  { id: 'calendar', label: 'Takvim', href: '#/randevular/takvim' },
  { id: 'clients', label: 'Danışanlar', href: '#/randevular/danisanlar' },
];

export function AppointmentsPage({ tab, add }: { tab: AppointmentsTab; add: { day: string; time: string; type: string } | null }) {
  const [moved, setMoved] = useState<Client | null>(null);
  return (
    <section aria-labelledby="appt-title">
      <div className="screen-head">
        <h2 id="appt-title">Randevular</h2>
      </div>
      <nav className="tabs" aria-label="Randevu bölümleri">
        {TABS.map((t) => (
          <a key={t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} href={t.href} aria-current={tab === t.id ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      {tab === 'requests' && (
        <RequestsTab
          onMoved={(c) => {
            setMoved(c);
            go('#/randevular/danisanlar');
          }}
        />
      )}
      {tab === 'calendar' && <CalendarTab add={add} />}
      {tab === 'clients' && <ClientsTab moved={moved} />}
    </section>
  );
}
