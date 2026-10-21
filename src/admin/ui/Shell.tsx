/**
 * Panel frame (owner's decision 2026-10-21, SITE-GUNCELLEMESI.md karar 6): the sidebar in five parts —
 * Genel Bakış, then the groups Danışanlar ve Randevular, İçerik, Site Sayfaları and Ayarlar, each one
 * folding open and shut (remembered in this browser; the group of the open screen always shows) —
 * with Karanlık Mod, Siteyi Aç and Çıkış Yap at the bottom. On phones the sidebar is a drawer.
 * Top right: the notification bell. Waiting requests and new notifications show as badges.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { go, usePanel, type Route } from './context';
import { startNewPost } from '../lib/new-post';
import { useTheme } from './theme';
import { Button } from './kit';
import {
  BellRing,
  CalendarCheck,
  ChevronDown,
  ExternalLink,
  FileText,
  Globe,
  House,
  Icon,
  Inbox,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  Trash2,
  UserRound,
  type LucideIcon,
} from './icons';
import { SETTINGS_SCREENS } from './settings/screens';
import { NotificationBell } from './NotificationBell';
import { unseenOf, useNotifications } from './notifications';
import { useNoTrack } from './no-track';

export { SETTINGS_SCREENS };

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };
type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[]; newPost?: boolean };

const screen = (id: string): NavItem => {
  const s = SETTINGS_SCREENS.find((x) => x.id === id)!;
  return { href: `#/ayarlar/${id}`, label: s.label, icon: s.icon };
};

export const SITE_PAGES = ['ana-sayfa', 'hakkimda', 'sss', 'kaynaklar', 'iletisim', 'yasal'];
export const SETTINGS = ['profil', 'linkler', 'seo', 'gizlilik'];

export function navGroups(badges: { requests: number; notifications: number }): NavGroup[] {
  return [
    {
      id: 'danisan',
      label: 'Danışanlar ve Randevular',
      icon: CalendarCheck,
      items: [
        { href: '#/profil', label: 'Randevu Özeti', icon: UserRound },
        { href: '#/randevular', label: 'Randevu Talepleri', icon: Inbox, badge: badges.requests },
        { href: '#/seans-takip', label: 'Danışanlar', icon: CalendarCheck },
        { href: '#/bildirimler', label: 'Bildirimler', icon: BellRing, badge: badges.notifications },
      ],
    },
    {
      id: 'icerik',
      label: 'İçerik',
      icon: FileText,
      newPost: true,
      items: [{ href: '#/yazilar', label: 'Yazılar', icon: FileText }, screen('kategoriler'), { href: '#/cop-kutusu', label: 'Silinen Yazılar', icon: Trash2 }],
    },
    { id: 'site', label: 'Site Sayfaları', icon: Globe, items: SITE_PAGES.map(screen) },
    { id: 'ayarlar', label: 'Ayarlar', icon: Settings, items: SETTINGS.map(screen) },
  ];
}

/** The menu entry of the open screen. */
export function currentHref(route: Route): string {
  switch (route.name) {
    case 'settings':
      return `#/ayarlar/${route.screen}`;
    case 'home':
      return '#/';
    case 'posts':
    case 'post':
      return '#/yazilar';
    case 'trash':
      return '#/cop-kutusu';
    case 'profile':
      return '#/profil';
    case 'notifications':
      return '#/bildirimler';
    case 'requests':
      return '#/randevular';
    case 'tracking':
    case 'client':
      return '#/seans-takip';
  }
}

const FOLD_KEY = 'kt.nav.closed';

/** The groups the owner folded shut, remembered in this browser. */
function useFolded(): [string[], (id: string) => void] {
  const [closed, setClosed] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(FOLD_KEY) ?? '[]');
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const toggle = (id: string) =>
    setClosed((c) => {
      const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
      try {
        localStorage.setItem(FOLD_KEY, JSON.stringify(next));
      } catch {
        /* private mode: folds last for this visit */
      }
      return next;
    });
  return [closed, toggle];
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { api, store } = usePanel();
  const [open, setOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const [closed, toggleFold] = useFolded();
  const notes = useNotifications(api);
  // Writes the default ("do not count me") on the first visit, as before; the switch is in Gizlilik ve Analitik.
  useNoTrack();
  useEffect(() => setOpen(false), [route]);
  const current = currentHref(route);
  const groups = navGroups({ requests: notes.pending, notifications: unseenOf(notes.events, notes.seen) });

  const link = ({ href, label, icon, badge }: NavItem) => (
    <li key={href}>
      <a href={href} aria-current={current === href ? 'page' : undefined}>
        <Icon as={icon} />
        <span className="nav-label">{label}</span>
        {!!badge && (
          <span className="nav-badge" aria-label={`${badge} yeni`}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </a>
    </li>
  );

  return (
    <div className="shell">
      <div className="panel-top">
        <Button variant="ghost" className="menu-toggle" aria-expanded={open} aria-controls="panel-nav" onClick={() => setOpen(!open)}>
          <Icon as={Menu} size={20} />
          Menü
        </Button>
        <NotificationBell events={notes.events} seen={notes.seen} failed={notes.failed} />
      </div>
      <nav id="panel-nav" className={`panel-nav ${open ? 'open' : ''}`} aria-label="Panel menüsü">
        <a className="nav-logo" href="#/">
          <img className="logo-light" src="/admin/logo-black.png" alt="klinikterapist" />
          <img className="logo-dark" src="/admin/logo-white.png" alt="klinikterapist" />
        </a>
        <ul>{link({ href: '#/', label: 'Genel Bakış', icon: House })}</ul>
        {groups.map((g) => {
          const here = g.items.some((x) => x.href === current);
          const shut = closed.includes(g.id) && !here;
          return (
            <div key={g.id} className="nav-section">
              <button type="button" className="nav-fold" aria-expanded={!shut} aria-controls={`nav-${g.id}`} onClick={() => toggleFold(g.id)}>
                <span>{g.label}</span>
                <Icon as={ChevronDown} size={16} />
              </button>
              {!shut && (
                <div id={`nav-${g.id}`}>
                  {g.newPost && (
                    <Button variant="primary" className="nav-new" onClick={() => go(startNewPost(window.localStorage, new Date()))}>
                      <Icon as={Plus} />
                      Yeni Yazı
                    </Button>
                  )}
                  <ul>{g.items.map(link)}</ul>
                </div>
              )}
            </div>
          );
        })}
        <ul className="nav-end">
          <li>
            <button type="button" className="linklike" onClick={toggleTheme}>
              <Icon as={theme === 'dark' ? Sun : Moon} />
              {theme === 'dark' ? 'Açık Mod' : 'Karanlık Mod'}
            </button>
          </li>
          <li>
            <a href="/" target="_blank" rel="noreferrer">
              <Icon as={ExternalLink} />
              Siteyi Aç ↗
            </a>
          </li>
          <li>
            <button type="button" className="linklike" onClick={() => api.logout().catch(() => {}).finally(() => store.clear())}>
              <Icon as={LogOut} />
              Çıkış Yap
            </button>
          </li>
        </ul>
      </nav>
      <main className="panel-main" id="panel-main">
        {children}
      </main>
    </div>
  );
}

