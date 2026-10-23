/** Site settings screens (spec §8.3, without the booking screens, which come in Phase 3). */
import type { ComponentType } from 'react';
import { HakkimdaScreen } from './screens/about';
import { KategorilerScreen } from './screens/categories';
import { SssScreen } from './screens/faq';
import { YasalScreen } from './screens/legal';
import { AnaSayfaScreen, KaynaklarScreen, LinklerScreen } from './screens/lists';
import { IletisimScreen, ProfilScreen, SeoScreen } from './screens/simple';
import { GizlilikScreen } from './screens/privacy';
import { GorunumScreen } from './screens/appearance';
import { GirisScreen } from './screens/login';
import { EpostaScreen } from './screens/mail';
import { OnemliScreen } from './screens/important';
import { RandevuScreen } from './screens/booking';

const SCREENS: Record<string, ComponentType> = {
  profil: ProfilScreen,
  'ana-sayfa': AnaSayfaScreen,
  linkler: LinklerScreen,
  hakkimda: HakkimdaScreen,
  sss: SssScreen,
  kaynaklar: KaynaklarScreen,
  iletisim: IletisimScreen,
  kategoriler: KategorilerScreen,
  seo: SeoScreen,
  gizlilik: GizlilikScreen,
  randevu: RandevuScreen,
  eposta: EpostaScreen,
  giris: GirisScreen,
  gorunum: GorunumScreen,
  yasal: YasalScreen,
  onemli: OnemliScreen,
};

export function SettingsPage({ screen }: { screen: string }) {
  const Screen = Object.prototype.hasOwnProperty.call(SCREENS, screen) ? SCREENS[screen] : null;
  if (!Screen) {
    return (
      <section>
        <h2>Ayarlar</h2>
        <p>
          Bu ayar ekranı bulunamadı. <a href="#/yazilar">Yazılara dön</a>
        </p>
      </section>
    );
  }
  return <Screen />;
}
