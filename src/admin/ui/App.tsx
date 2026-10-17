/** Panel root: sign-in gate, shell and routing. */
import { useEffect, useState } from 'react';
import type { Api } from '../api/types';
import type { SessionStore } from '../api/session';
import type { AdminConfig } from '../config';
import { Panel, useRoute } from './context';
import { DeployProvider } from './DeployStatus';
import { Login } from './Login';
import { Shell } from './Shell';
import { PostsList } from './PostsList';
import { EditorPage } from './editor/EditorPage';
import { SettingsPage } from './settings/SettingsPage';

export function App({ api, store, config }: { api: Api; store: SessionStore; config: AdminConfig }) {
  const [signedIn, setSignedIn] = useState(() => !!store.get());
  const route = useRoute();
  useEffect(() => store.subscribe(() => setSignedIn(!!store.get())), [store]);

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
      {!signedIn ? (
        <Login />
      ) : (
        <DeployProvider api={api}>
          <Shell route={route}>
            {route.name === 'post' ? (
              <EditorPage key={route.key} postKey={route.key} />
            ) : route.name === 'settings' ? (
              <SettingsPage key={route.screen} screen={route.screen} />
            ) : (
              <PostsList />
            )}
          </Shell>
        </DeployProvider>
      )}
    </Panel.Provider>
  );
}
