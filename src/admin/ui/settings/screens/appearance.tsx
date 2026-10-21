/**
 * Görünüm (owner's brief 2026-10-21): the panel's theme (Gündüz, Gece or the device's), the menu's
 * width (full or the icon rail) and the "Gün & Gece" tones with what each one marks, shown in the
 * open theme. All of it is kept in this browser only; nothing is saved to the site.
 */
import { setThemeChoice, useTheme, type ThemeChoice } from '../../theme';
import { RAIL_KEY, usePref } from '../../prefs';
import { CalendarCheck, FileText, Globe, House, Icon, Inbox, Settings, type LucideIcon } from '../../icons';
import { SETTINGS_SCREENS } from '../screens';
import type { Tone } from '../../Shell';

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Gündüz' },
  { value: 'dark', label: 'Gece' },
  { value: 'system', label: 'Cihaza göre' },
];

const TONES: { tone: Tone; name: string; use: string; icon: LucideIcon }[] = [
  { tone: 'gunes', name: 'Güneş', use: 'Genel Bakış, yeni olanlar, vurgu', icon: House },
  { tone: 'adacayi', name: 'Adaçayı', use: 'Danışanlar, seanslar, olumlu durumlar', icon: CalendarCheck },
  { tone: 'kiremit', name: 'Kiremit', use: 'Talepler, ön görüşmeler, dikkat', icon: Inbox },
  { tone: 'lavanta', name: 'Lavanta', use: 'İçerik: yazılar ve kategoriler', icon: FileText },
  { tone: 'deniz', name: 'Deniz', use: 'Site sayfaları ve istatistikler', icon: Globe },
  { tone: 'lacivert', name: 'Lacivert', use: 'Marka, ana düğmeler, ayarlar', icon: Settings },
];

export function GorunumScreen() {
  const [, , choice] = useTheme();
  const [rail, setRail] = usePref<boolean>(RAIL_KEY, false);
  const meta = SETTINGS_SCREENS.find((x) => x.id === 'gorunum')!;
  return (
    <section className="settings" aria-labelledby="look-title">
      <div className="screen-head">
        <h2 id="look-title">
          <Icon as={meta.icon} size={22} />
          {meta.label}
        </h2>
      </div>
      <p className="settings-intro">{meta.intro}</p>

      <div className="k-group-card look-card">
        <div className="look-row">
          <span>
            <b>Tema</b>
            <span className="k-hint">Cihaza göre seçilirse bilgisayarınız gece moduna geçtiğinde panel de geçer.</span>
          </span>
          <div className="segmented" role="group" aria-label="Tema">
            {THEMES.map((t) => (
              <button key={t.value} type="button" aria-pressed={choice === t.value} onClick={() => setThemeChoice(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="look-row">
          <span>
            <b>Menü</b>
            <span className="k-hint">Dar menüde yalnızca simgeler görünür; adlar üzerine gelince çıkar.</span>
          </span>
          <div className="segmented" role="group" aria-label="Menü genişliği">
            <button type="button" aria-pressed={!rail} onClick={() => setRail(false)}>
              Geniş
            </button>
            <button type="button" aria-pressed={rail} onClick={() => setRail(true)}>
              Dar
            </button>
          </div>
        </div>
      </div>

      <h3 className="look-title">Renk paleti: Gün &amp; Gece</h3>
      <p className="k-hint look-intro">Sitenin lacivert, krem ve güneş renklerine eşlik eden altı ton. Her bölüm kendi tonunu taşır; renk tek başına bilgi vermez, her zaman bir simge ya da yazıyla birlikte gelir.</p>
      <ul className="look-swatches">
        {TONES.map((t) => (
          <li key={t.tone} className={`look-swatch tone-${t.tone}`}>
            <span className="look-swatch-color" aria-hidden="true">
              <Icon as={t.icon} size={22} />
            </span>
            <b>{t.name}</b>
            <span className="k-hint">{t.use}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
