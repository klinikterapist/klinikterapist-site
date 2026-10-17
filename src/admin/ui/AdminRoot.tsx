/** Island entry for /admin/: picks the real backend, or the in-memory one in dev with `?mock`. */
import { useEffect, useState } from 'react';
import type { Api } from '../api/types';
import { createHttpApi } from '../api/http';
import { createSessionStore, type SessionStore } from '../api/session';
import { ADMIN_CONFIG, MOCK_API_URL, type AdminConfig } from '../config';
import { App } from './App';
import { Spinner } from './kit';

type Ready = { api: Api; store: SessionStore; config: AdminConfig };

export default function AdminRoot() {
  const [ready, setReady] = useState<Ready | null>(null);
  useEffect(() => {
    const store = createSessionStore(window.localStorage);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('mock')) {
      import('../api/mock').then(({ createMockApi }) =>
        setReady({ api: createMockApi({ latency: 300 }), store, config: { ...ADMIN_CONFIG, apiUrl: MOCK_API_URL, googleClientId: 'mock' } }),
      );
      return;
    }
    setReady({ api: createHttpApi(ADMIN_CONFIG.apiUrl, store), store, config: ADMIN_CONFIG });
  }, []);
  return ready ? <App {...ready} /> : <Spinner />;
}
