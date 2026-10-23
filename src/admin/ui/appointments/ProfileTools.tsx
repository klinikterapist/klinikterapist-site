/**
 * Araçlar on Randevu Özeti (owner's reviews 2026-10-21 and 2026-10-23): the steps used most, one press
 * away, as one row under the seven-day strip.
 */
import { CalendarPlus, CalendarX, ClipboardList, Icon, Inbox, Wallet, type LucideIcon } from '../icons';

const TOOLS: { href: string; label: string; note: string; icon: LucideIcon; tone: string }[] = [
  { href: '#/randevular', label: 'Randevu ekle', note: 'Telefonla ya da yüz yüze alınan bir randevuyu girin', icon: CalendarPlus, tone: 'adacayi' },
  { href: '#/ayarlar/randevu', label: 'Saat kapat', note: 'İzin, tatil ya da kongre için', icon: CalendarX, tone: 'kiremit' },
  { href: '#/randevular?liste', label: 'Bekleme listesi', note: 'Yer açılınca haber verilecek kişiler', icon: ClipboardList, tone: 'lavanta' },
  { href: '#/ayarlar/ucretler', label: 'Ücretlendirmeler', note: 'Seans ücretleri ve ödeme bilgisi', icon: Wallet, tone: 'gunes' },
  { href: '#/randevular', label: 'Talepleri yanıtla', note: 'Onayla, başka saat öner ya da iptal et', icon: Inbox, tone: 'deniz' },
];

export function ToolsCard() {
  return (
    <article className="pf-card pf-tools pf-tools-row" aria-labelledby="pf-tools">
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
