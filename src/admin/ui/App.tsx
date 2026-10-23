/** Panel root: sign-in gate, shell and routing. */
import { useEffect, useState } from 'react';
import type { Api, Session } from '../api/types';
import type { SessionStore } from '../api/session';
import type { AdminConfig } from '../config';
import { Panel, useRoute } from './context';
import { DeployProvider } from './DeployStatus';
import { Login } from './Login';
import { PasswordForm } from './PasswordForm';
import { Shell } from './Shell';
import { Home } from './Home';
import { TrashPage } from './TrashPage';
import { RequestsPage } from './appointments/RequestsPage';
import { TrackingPage } from './appointments/TrackingPage';
import { FeesPage } from './appointments/FeesPage';
import { ClientPage } from './appointments/ClientPage';
import { ProfilePage } from './appointments/ProfilePage';
import { NotificationsPage } from './appointments/NotificationsPage';
import { PostsList } from './PostsList';
import { EditorPage } from './editor/EditorPage';
import { SettingsPage } from './settings/SettingsPage';

export function App({ api, store, config }: { api: Api; store: SessionStore; config: AdminConfig }) {
  const [signedIn, setSignedIn] = useState(() => !!store.get());
  // Once the panel has been open, a lapsed session shows sign-in on top of it, so no open
  // screen (and none of its unsaved text) is thrown away.
  const [opened, setOpened] = useState(signedIn);
  // Signed in with Google alone because no panel password is set yet: ask for one before anything else.
  const [mustSetPassword, setMustSetPassword] = useState(false);
  const onSignedIn = (s: Session) => setMustSetPassword(!!s.needsPassword);
  const route = useRoute();
  useEffect(
    () =>
      store.subscribe(() => {
        const now = !!store.get();
        setSignedIn(now);
        if (now) setOpened(true);
      }),
    [store],
  );

  if (!config.apiUrl || !config.googleClientId) {
    return (
      <section className="card-panel" aria-labelledby="setup-title">
        <h2 id="setup-title">Panel henüz kurulmadı</h2>
        <p>Kurulum rehberindeki (docs/kurulum/yonetim-paneli.md) adımlar tamamlanınca giriş ekranı burada görünecek.</p>
      </section>
    );
  }

  return (
    <Panel.Provider value={{ api, config, store }}>
      {!opened ? (
        <Login onSignedIn={onSignedIn} />
      ) : (
        <DeployProvider api={api}>
          <Shell route={route}>
            {route.name === 'post' ? (
              <EditorPage key={route.key} postKey={route.key} intent={route.intent} />
            ) : route.name === 'settings' ? (
              <SettingsPage key={route.screen} screen={route.screen} />
            ) : route.name === 'home' ? (
              <Home />
            ) : route.name === 'trash' ? (
              <TrashPage />
            ) : route.name === 'requests' ? (
              <RequestsPage key={route.list ? 'list' : route.add ? 'add' : 'requests'} add={route.add} list={route.list} />
            ) : route.name === 'profile' ? (
              <ProfilePage />
            ) : route.name === 'notifications' ? (
              <NotificationsPage />
            ) : route.name === 'tracking' ? (
              <TrackingPage />
            ) : route.name === 'fees' ? (
              <FeesPage />
            ) : route.name === 'client' ? (
              <ClientPage key={route.id} id={route.id} />
            ) : (
              <PostsList tab={route.tab} />
            )}
          </Shell>
          {signedIn && mustSetPassword && (
            <div className="k-backdrop">
              <div className="k-dialog login" role="dialog" aria-modal="true" aria-labelledby="first-password-title">
                <h2 id="first-password-title">Panel şifrenizi belirleyin</h2>
                <p>Bundan sonra panele girerken önce bu kullanıcı adı ve şifre, ardından Google hesabınız sorulacak. Bunları yalnızca siz bilin; kimseyle paylaşmayın.</p>
                <PasswordForm change={false} onDone={() => setMustSetPassword(false)} />
              </div>
            </div>
          )}
          {!signedIn && (
            <div className="k-backdrop">
              <div className="k-dialog" role="dialog" aria-modal="true" aria-label="Yeniden giriş">
                <Login again onSignedIn={onSignedIn} />
              </div>
            </div>
          )}
        </DeployProvider>
      )}
    </Panel.Provider>
  );
}
