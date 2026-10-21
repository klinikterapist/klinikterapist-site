/**
 * Gizlilik ve Analitik (owner's decision 2026-10-21): the switch that keeps the owner's own visits out of
 * the site's counter, moved here from the bottom of the menu. It is a setting of this browser only
 * (localStorage `kt.noTrack`, read by Counter.astro), so there is nothing to save to the site.
 */
import { useNoTrack } from '../../no-track';
import { Icon } from '../../icons';
import { Toggle } from '../../kit';
import { SETTINGS_SCREENS } from '../screens';

export function GizlilikScreen() {
  const [noTrack, setNoTrack] = useNoTrack();
  const meta = SETTINGS_SCREENS.find((x) => x.id === 'gizlilik')!;
  return (
    <section className="settings" aria-labelledby="privacy-title">
      <div className="screen-head">
        <h2 id="privacy-title">
          <Icon as={meta.icon} size={22} />
          {meta.label}
        </h2>
      </div>
      <p className="settings-intro">{meta.intro}</p>
      <div className="k-group-card privacy-card">
        <Toggle label="Kendi ziyaretlerimi sayma" checked={noTrack} onChange={setNoTrack} />
        <p className="k-hint">
          Açıkken bu tarayıcıdan siteye yaptığınız ziyaretler istatistiklere eklenmez. Ayar yalnızca bu cihazda ve bu tarayıcıda geçerlidir; başka bir cihazdan girerseniz orada da açın.
        </p>
      </div>
    </section>
  );
}
