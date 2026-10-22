/** Giriş Bilgileri: changes the panel's user name and password (the first lock of sign-in). */
import { useEffect, useState } from 'react';
import { Icon } from '../../icons';
import { Banner } from '../../kit';
import { usePanel } from '../../context';
import { PasswordForm } from '../../PasswordForm';
import { SETTINGS_SCREENS } from '../screens';

export function GirisScreen() {
  const { api } = usePanel();
  const meta = SETTINGS_SCREENS.find((x) => x.id === 'giris')!;
  const [set, setSet] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    api.loginStart().then(
      (r) => setSet(r.password),
      () => setSet(true),
    );
  }, [api]);
  return (
    <section className="settings" aria-labelledby="login-settings-title">
      <div className="screen-head">
        <h2 id="login-settings-title">
          <Icon as={meta.icon} size={22} />
          {meta.label}
        </h2>
      </div>
      <p className="settings-intro">{meta.intro}</p>
      {saved && <Banner tone="success">Kaydedildi. Bir sonraki girişte yeni kullanıcı adınızı ve şifrenizi kullanın.</Banner>}
      {set !== null && (
        <div className="card-panel login-settings">
          <PasswordForm key={String(saved)} change={set} onDone={() => (setSaved(true), setSet(true))} />
        </div>
      )}
      <p className="k-hint">
        Şifrenizi unutursanız: Apps Script düzenleyicisinde (script.google.com › "Klinikterapist Panel" › Proje ayarları › Komut dosyası özellikleri) <code>PANEL_LOGIN</code> satırını silin. Sonraki girişte yalnızca Google hesabınız sorulur ve panel yeni şifre ister.
      </p>
    </section>
  );
}
