/**
 * Randevular › Danışanlar (Randevu takibi): clients by number with their weekly session. Nothing
 * here names anyone. "Terapi sona erdi" removes the client and frees their weekly time.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type Client } from '../../api/types';
import { formatDay } from '../../../lib/booking-form';
import { usePanel } from '../context';
import { UserRound } from '../icons';
import { Banner, Button, Dialog, EmptyState, Spinner } from '../kit';
import { WEEKDAYS, labelOf } from './CalendarTab';

export const weeklyText = (c: Client) => `Her ${WEEKDAYS[c.weekday].toLocaleLowerCase('tr-TR')} ${c.time.replace(':', '.')} · ${labelOf({ kind: 'session', type: c.type })}`;

export function ClientsTab({ moved }: { moved: Client | null }) {
  const { api } = usePanel();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ending, setEnding] = useState<Client | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .clientsList()
      .then(({ clients }) => alive && setClients(clients))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Danışanlar yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const end = async (c: Client) => {
    setBusy(true);
    try {
      await api.clientEnd(c.id);
      setEnding(null);
      setAttempt((n) => n + 1);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Kaldırılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="appt-tab">
      <p className="k-hint">Randevu takibindeki danışanlar. Burada yalnızca danışan numarası ve haftalık seans saati tutulur; ad ya da iletişim bilgisi tutulmaz.</p>
      {moved && <Banner tone="success">{`Danışan ${moved.number} olarak takibe alındı: ${weeklyText(moved)}. Kişinin bilgileri panelden silindi.`}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      {!clients && !error && <Spinner label="Danışanlar yükleniyor…" />}
      {clients && clients.length === 0 && <EmptyState icon={UserRound}>Takipte danışan yok.</EmptyState>}
      {clients && clients.length > 0 && (
        <ul className="cal-rows">
          {clients.map((c) => (
            <li key={c.id} className="cal-row">
              <span className="cal-time">{c.number}</span>
              <span className="cal-kind">{weeklyText(c)}</span>
              <span className="k-hint">{`${formatDay(c.since, 'tr')} tarihinden beri`}</span>
              <Button variant="ghost" onClick={() => setEnding(c)}>
                Terapi sona erdi
              </Button>
            </li>
          ))}
        </ul>
      )}
      {ending && (
        <Dialog
          title={`${ending.number} takipten çıkarılsın mı?`}
          history
          onClose={() => !busy && setEnding(null)}
          actions={
            <>
              <Button onClick={() => setEnding(null)} disabled={busy}>
                Vazgeç
              </Button>
              <Button variant="danger" busy={busy} onClick={() => end(ending)}>
                Takipten çıkar
              </Button>
            </>
          }
        >
          <p>{`${weeklyText(ending)}. Haftalık seans saati takvimde ve sitede yeniden açılır.`}</p>
        </Dialog>
      )}
    </div>
  );
}
