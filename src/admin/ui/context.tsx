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

export type PostsTab = 'live' | 'drafts' | 'planned';

/** What the posts list asked the editor to start with (owner's review 2026-10-21). */
export type PostIntent = 'yayinla' | 'planla' | 'kaldir' | 'sil';
const INTENTS: PostIntent[] = ['yayinla', 'planla', 'kaldir', 'sil'];

export type Route =
  | { name: 'home' }
  | { name: 'posts'; tab: PostsTab }
  | { name: 'trash' }
  /** Randevu talepleri. `add`: a time to put in the calendar (`?ekle=YYYY-MM-DDTHH:MM&tur=…`). */
  | { name: 'requests'; add: { day: string; time: string; type: string } | null; list?: boolean }
  | { name: 'tracking' }
  | { name: 'profile' }
  | { name: 'notifications' }
  /** Seans takip › one client's sessions. */
  | { name: 'client'; id: string }
  | { name: 'post'; key: string; intent?: PostIntent }
  | { name: 'settings'; screen: string };

export function parseRoute(hash: string): Route {
  // A trailing slash (#/yazilar/) goes to the same screen.
  const [rawPath, query = ''] = hash.replace(/^#/, '').split('?');
  const path = rawPath.replace(/(.)\/+$/, '$1');
  // The older /randevular/takvim and /randevular/danisanlar links still land on the right page.
  if (path === '/seans-takip' || path === '/randevular/danisanlar') return { name: 'tracking' };
  if (path === '/profil') return { name: 'profile' };
  if (path === '/bildirimler') return { name: 'notifications' };
  const client = path.match(/^\/seans-takip\/([\w-]+)$/);
  if (client) return { name: 'client', id: client[1] };
  if (path === '/randevular' || path === '/randevular/takvim') {
    const q = new URLSearchParams(query);
    const m = (q.get('ekle') ?? '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
    // "Seans Ekle" in the menu: the dialog opens empty (?ekle=yeni).
    const blank = q.get('ekle') === 'yeni' ? { day: '', time: '', type: q.get('tur') ?? 'individual' } : null;
    return { name: 'requests', add: m ? { day: m[1], time: m[2], type: q.get('tur') ?? 'individual' } : blank, ...(q.has('liste') ? { list: true } : {}) };
  }
  let m = path.match(/^\/yazi\/([a-z0-9-]+)$/);
  if (m) {
    const intent = new URLSearchParams(query).get('islem') as PostIntent | null;
    return { name: 'post', key: m[1], ...(intent && INTENTS.includes(intent) ? { intent } : {}) };
  }
  m = path.match(/^\/ayarlar\/([a-z-]+)$/);
  if (m) return { name: 'settings', screen: m[1] };
  if (path === '/yazilar') return { name: 'posts', tab: 'live' };
  if (path === '/yazilar/taslaklar') return { name: 'posts', tab: 'drafts' };
  if (path === '/yazilar/planlanan') return { name: 'posts', tab: 'planned' };
  if (path === '/cop-kutusu') return { name: 'trash' };
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
