/**
 * "Takvim kapatma" (owner's decision 2026-10-20; named so on 2026-10-23): closes a whole day or a stretch
 * of it at once, in the backend: taken on the site, grey in the calendar, where "Aç" opens it again.
 * Opened from Danışanlar' tools and from Ayarlar › Randevu Ayarları.
 */
import { useState } from 'react';
import { ApiFailure } from '../../api/types';
import { formatDay } from '../../../lib/booking-form';
import { usePanel } from '../context';
import { Banner, Button, Dialog, Field } from '../kit';

const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

export function CloseHoursDialog({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const { api } = usePanel();
  const [c, setC] = useState({ day: today(), whole: true, from: '09:00', to: '13:00', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.calendarClose({ day: c.day, from: c.whole ? '00:00' : c.from, to: c.whole ? '24:00' : c.to, note: c.note });
      onDone(`${formatDay(c.day, 'tr')}${c.whole ? ' bütün gün' : `, ${c.from.replace(':', '.')}–${c.to.replace(':', '.')}`} kapatıldı. Bu aralık sitede dolu görünür; takvimde gri görünür, oradan "Aç" ile açabilirsiniz.`);
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : 'Kapatılamadı. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="Takvim kapatma"
      history
      onClose={() => !busy && onClose()}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant="primary" busy={busy} disabled={!c.day || (!c.whole && c.to <= c.from)} onClick={close}>
            Kapat
          </Button>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      <Field label="Gün" type="date" value={c.day} onChange={(day) => setC({ ...c, day })} />
      <div className="segmented end-choice" role="group" aria-label="Kapatılacak süre">
        <button type="button" aria-pressed={c.whole} onClick={() => setC({ ...c, whole: true })}>
          Bütün gün
        </button>
        <button type="button" aria-pressed={!c.whole} onClick={() => setC({ ...c, whole: false })}>
          Saat aralığı
        </button>
      </div>
      {!c.whole && (
        <div className="add-grid">
          <Field label="Başlangıç" type="time" value={c.from} onChange={(from) => setC({ ...c, from })} />
          <Field label="Bitiş" type="time" value={c.to} onChange={(to) => setC({ ...c, to })} />
        </div>
      )}
      <Field label="Not (isteğe bağlı, yalnızca siz görürsünüz)" value={c.note} maxLength={80} onChange={(note) => setC({ ...c, note })} />
      <p className="k-hint">Bu aralık sitede dolu görünür; danışanlar da kendi sayfalarından buraya erteleyemez. İçindeki mevcut randevular değişmez.</p>
    </Dialog>
  );
}
