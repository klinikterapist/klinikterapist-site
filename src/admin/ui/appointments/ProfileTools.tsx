/**
 * Araçlar (owner's reviews 2026-10-21 and 2026-10-23): the steps used most, one press away, as one
 * row: on Randevu Özeti under the seven-day strip, on Danışanlar under the summary tiles (its own set).
 */
import { BellRing, CalendarPlus, CalendarX, ClipboardList, Icon, Inbox, Mail, Wallet, type LucideIcon } from '../icons';

type Tool = { href: string; label: string; note: string; icon: LucideIcon; tone: string };

const TOOLS: Tool[] = [
  { href: '#/randevular', label: 'Randevu ekle', note: 'Telefonla ya da yüz yüze alınan bir randevuyu girin', icon: CalendarPlus, tone: 'adacayi' },
  { href: '#/ayarlar/randevu', label: 'Saat kapat', note: 'İzin, tatil ya da kongre için', icon: CalendarX, tone: 'kiremit' },
  { href: '#/randevular?liste', label: 'Bekleme listesi', note: 'Yer açılınca haber verilecek kişiler', icon: ClipboardList, tone: 'lavanta' },
  { href: '#/ayarlar/ucretler', label: 'Ücretlendirmeler', note: 'Seans ücretleri ve ödeme bilgisi', icon: Wallet, tone: 'gunes' },
  { href: '#/randevular', label: 'Talepleri yanıtla', note: 'Onayla, başka saat öner ya da iptal et', icon: Inbox, tone: 'deniz' },
];

/** Danışanlar's own tools (owner's review 2026-10-23, item 22). */
export const CLIENT_TOOLS: Tool[] = [
  { href: '#/randevular?ekle=yeni', label: 'Seans ekle', note: 'Telefonla ya da yüz yüze kararlaştırılan bir seansı girin', icon: CalendarPlus, tone: 'adacayi' },
  { href: '#/ayarlar/ucretler', label: 'Ücretlendirmeler', note: 'Seans ücretleri ve ödeme bilgisi', icon: Wallet, tone: 'gunes' },
  { href: '#/ayarlar/randevu', label: 'Saat kapat', note: 'İzin, tatil ya da kongre için', icon: CalendarX, tone: 'kiremit' },
  { href: '#/ayarlar/eposta', label: 'Hazır e-postalar', note: 'Danışanlara giden mesajları düzenleyin', icon: Mail, tone: 'lavanta' },
  { href: '#/bildirimler', label: 'Bildirimler', note: 'Ödeme, iptal ve erteleme haberleri', icon: BellRing, tone: 'deniz' },
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
