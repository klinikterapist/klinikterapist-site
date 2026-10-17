/** Shared panel context: the API client, config, and hash routing. */
import { createContext, useContext, useEffect, useState } from 'react';
import type { Api } from '../api/types';
import type { AdminConfig } from '../config';
import type { SessionStore } from '../api/session';

export type PanelContext = { api: Api; config: AdminConfig; store: SessionStore };
export const Panel = createContext<PanelContext | null>(null);

export function usePanel(): PanelContext {
  const ctx = useContext(Panel);
  if (!ctx) throw new Error('usePanel outside <Panel.Provider>');
  return ctx;
}

export type Route =
  | { name: 'home' }
  | { name: 'posts'; tab: 'live' | 'drafts' }
 
  | { name: 'post'; key: string }
  | { name: 'settings'; screen: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  let m = path.match(/^\/yazi\/([a-z0-9-]+)$/);
  if (m) return { name: 'post', key: m[1] };
  m = path.match(/^\/ayarlar\/([a-z-]+)$/);
  if (m) return { name: 'settings', screen: m[1] };
  if (path === '/yazilar') return { name: 'posts', tab: 'live' };
  if (path === '/yazilar/taslaklar') return { name: 'posts', tab: 'drafts' };
  return { name: 'home' };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => (typeof location === 'undefined' ? '' : location.hash));
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parseRoute(hash);
}

export const go = (hash: string) => {
  location.hash = hash;
};
