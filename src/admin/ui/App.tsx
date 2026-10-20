/** Panel root: sign-in gate, shell and routing. */
import { useEffect, useState } from 'react';
import type { Api } from '../api/types';
import type { SessionStore } from '../api/session';
import type { AdminConfig } from '../config';
import { Panel, useRoute } from './context';
import { DeployProvider } from './DeployStatus';
import { Login } from './Login';
import { Shell } from './Shell';
import { Home } from './Home';
import { TrashPage } from './TrashPage';
import { RequestsPage } from './appointments/RequestsPage';
import { TrackingPage } from './appointments/TrackingPage';
import { ClientPage } from './appointments/ClientPage';
import { PostsList } from './PostsList';
import { EditorPage } from './editor/EditorPage';
import { SettingsPage } from './settings/SettingsPage';

export function App({ api, store, config }: { api: Api; store: SessionStore; config: AdminConfig }) {
  const [signedIn, setSignedIn] = useState(() => !!store.get());
  // Once the panel has been open, a lapsed session shows sign-in on top of it, so no open
  // screen (and none of its unsaved text) is thrown away.
  const [opened, setOpened] = useState(signedIn);
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
        <Login />
      ) : (
        <DeployProvider api={api}>
          <Shell route={route}>
            {route.name === 'post' ? (
              <EditorPage key={route.key} postKey={route.key} />
            ) : route.name === 'settings' ? (
              <SettingsPage key={route.screen} screen={route.screen} />
            ) : route.name === 'home' ? (
              <Home />
            ) : route.name === 'trash' ? (
              <TrashPage />
            ) : route.name === 'requests' ? (
              <RequestsPage key={route.list ? 'list' : 'requests'} add={route.add} list={route.list} />
            ) : route.name === 'tracking' ? (
              <TrackingPage />
            ) : route.name === 'client' ? (
              <ClientPage key={route.id} id={route.id} />
            ) : (
              <PostsList tab={route.tab} />
            )}
          </Shell>
          {!signedIn && (
            <div className="k-backdrop">
              <div className="k-dialog" role="dialog" aria-modal="true" aria-label="Yeniden giriş">
                <Login again />
              </div>
            </div>
          )}
        </DeployProvider>
      )}
    </Panel.Provider>
  );
}
