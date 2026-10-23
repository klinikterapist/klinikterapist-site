/**
 * Araçlar on Randevu Özeti (owner's reviews 2026-10-21 and 2026-10-23): the steps used most, one press
 * away, as one row under the seven-day strip. Danışanlar has its own row (ClientTools).
 */
import { CalendarPlus, CalendarX, ClipboardList, Icon, Inbox, Wallet, type LucideIcon } from '../icons';

type Tool = { href: string; label: string; note: string; icon: LucideIcon; tone: string };

const TOOLS: Tool[] = [
  { href: '#/randevular', label: 'Randevu ekle', note: 'Telefonla ya da yüz yüze alınan bir randevuyu girin', icon: CalendarPlus, tone: 'adacayi' },
  { href: '#/ayarlar/randevu', label: 'Takvim kapatma', note: 'İzin, tatil ya da kongre için', icon: CalendarX, tone: 'kiremit' },
  { href: '#/randevular?liste', label: 'Bekleme listesi', note: 'Yer açılınca haber verilecek kişiler', icon: ClipboardList, tone: 'lavanta' },
  { href: '#/ucretlendirme', label: 'Ücretlendirmeler', note: 'Seans ücretleri ve ödeme bilgisi', icon: Wallet, tone: 'gunes' },
  { href: '#/randevular', label: 'Talepleri yanıtla', note: 'Onayla, başka saat öner ya da iptal et', icon: Inbox, tone: 'deniz' },
];

export function ToolsCard({ tools = TOOLS, id = 'pf-tools' }: { tools?: Tool[]; id?: string }) {
  return (
    <article className="pf-card pf-tools pf-tools-row" aria-labelledby={id}>
      <h3 id={id}>Araçlar</h3>
      <ul>
        {tools.map((t) => (
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
