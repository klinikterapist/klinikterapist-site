/** Panel frame: sidebar (side on desktop, drawer on phones; holds the theme switch), the current screen. */
import { useEffect, useState, type ReactNode } from 'react';
import { go, usePanel, type Route } from './context';
import { startNewPost } from '../lib/new-post';
import { useTheme } from './theme';
import { Button, Toggle } from './kit';
import { CalendarCheck, ExternalLink, FileText, House, Icon, Inbox, LogOut, Menu, Moon, Plus, Sun, Trash2, type LucideIcon } from './icons';
import { SETTINGS_SCREENS } from './settings/screens';

export { SETTINGS_SCREENS };

/** The site's counter skips this browser while `kt.noTrack` is '1' (Counter.astro). '0' = count me. */
const NO_TRACK = 'kt.noTrack';

function useNoTrack(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(NO_TRACK) !== '0';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(NO_TRACK, on ? '1' : '0');
    } catch {
      /* private mode: nothing to remember */
    }
  }, [on]);
  return [on, setOn];
}


export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { api, store } = usePanel();
  const [open, setOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const [noTrack, setNoTrack] = useNoTrack();
  useEffect(() => setOpen(false), [route]);
  const current =
    route.name === 'settings' ? `#/ayarlar/${route.screen}` : route.name === 'home' ? '#/' : route.name === 'posts' ? '#/yazilar' : route.name === 'trash' ? '#/cop-kutusu' : route.name === 'requests' ? '#/randevular' : route.name === 'tracking' ? '#/seans-takip' : '';
  const link = (href: string, label: string, icon?: LucideIcon) => (
    <li key={href}>
      <a href={href} aria-current={current === href ? 'page' : undefined}>
        {icon && <Icon as={icon} />}
        {label}
      </a>
    </li>
  );
  return (
    <div className="shell">
      <Button variant="ghost" className="menu-toggle" aria-expanded={open} aria-controls="panel-nav" onClick={() => setOpen(!open)}>
        <Icon as={Menu} size={20} />
        Menü
      </Button>
      <nav id="panel-nav" className={`panel-nav ${open ? 'open' : ''}`} aria-label="Panel menüsü">
        <a className="nav-logo" href="#/">
          <img className="logo-light" src="/admin/logo-black.png" alt="klinikterapist" />
          <img className="logo-dark" src="/admin/logo-white.png" alt="klinikterapist" />
        </a>
        <ul>
          {link('#/', 'Ana sayfa', House)}
          <li>
            <a href="/" target="_blank" rel="noreferrer">
              <Icon as={ExternalLink} />
              Siteyi aç ↗
            </a>
          </li>
        </ul>
        <Button variant="primary" className="nav-new" onClick={() => go(startNewPost(window.localStorage, new Date()))}>
          <Icon as={Plus} />
          Yeni yazı
        </Button>
        <ul>
          {link('#/yazilar', 'Yazılar', FileText)}
          {link('#/randevular', 'Randevu talepleri', Inbox)}
          {link('#/seans-takip', 'Seans takip', CalendarCheck)}
          {link('#/cop-kutusu', 'Çöp kutusu', Trash2)}
        </ul>
        <p className="nav-group">Site ayarları</p>
        <ul>{SETTINGS_SCREENS.map((s) => link(`#/ayarlar/${s.id}`, s.label, s.icon))}</ul>
        <ul className="nav-end">
          <li className="nav-switch">
            <Toggle label="Kendi ziyaretlerimi sayma" checked={noTrack} onChange={setNoTrack} />
          </li>
          <li>
            <button type="button" className="linklike" onClick={toggleTheme}>
              <Icon as={theme === 'dark' ? Sun : Moon} />
              {theme === 'dark' ? 'Açık mod' : 'Karanlık mod'}
            </button>
          </li>
          <li>
            <button type="button" className="linklike" onClick={() => api.logout().catch(() => {}).finally(() => store.clear())}>
              <Icon as={LogOut} />
              Çıkış yap
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
