/** Panel frame: sidebar (side on desktop, drawer on phones), theme toggle, the current screen. */
import { useEffect, useState, type ReactNode } from 'react';
import { go, usePanel, type Route } from './context';
import { startNewPost } from '../lib/new-post';
import { useTheme } from './theme';
import { Button } from './kit';

export const SETTINGS_SCREENS: { id: string; label: string }[] = [
  { id: 'profil', label: 'Profil' },
  { id: 'ana-sayfa', label: 'Site ana sayfası' },
  { id: 'linkler', label: 'Sosyal ve linkler' },
  { id: 'hakkimda', label: 'Hakkımda' },
  { id: 'kaynaklar', label: 'Kaynaklar' },
  { id: 'iletisim', label: 'İletişim' },
  { id: 'kategoriler', label: 'Kategoriler' },
  { id: 'seo', label: 'SEO genel' },
  { id: 'yasal', label: 'Yasal metinler' },
];

const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ICONS = {
  home: <path d="M4 11l8-7 8 7M6 10v10h12V10" />,
  posts: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" />,
  site: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
  out: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
};

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { api, store } = usePanel();
  const [open, setOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  useEffect(() => setOpen(false), [route]);
  const current =
    route.name === 'settings' ? `#/ayarlar/${route.screen}` : route.name === 'home' ? '#/' : route.name === 'posts' ? '#/yazilar' : '';
  const link = (href: string, label: string, icon?: ReactNode) => (
    <li key={href}>
      <a href={href} aria-current={current === href ? 'page' : undefined}>
        {icon && <Icon>{icon}</Icon>}
        {label}
      </a>
    </li>
  );
  return (
    <div className="shell">
      <Button variant="ghost" className="menu-toggle" aria-expanded={open} aria-controls="panel-nav" onClick={() => setOpen(!open)}>
        ☰ Menü
      </Button>
      <nav id="panel-nav" className={`panel-nav ${open ? 'open' : ''}`} aria-label="Panel menüsü">
        <a className="nav-logo" href="#/">
          <img className="logo-light" src="/admin/logo-black.png" alt="klinikterapist" />
          <img className="logo-dark" src="/admin/logo-white.png" alt="klinikterapist" />
        </a>
        <ul>
          {link('#/', 'Ana sayfa', ICONS.home)}
          <li>
            <a href="/" target="_blank" rel="noreferrer">
              <Icon>{ICONS.site}</Icon>
              Siteyi aç ↗
            </a>
          </li>
        </ul>
        <Button variant="primary" className="nav-new" onClick={() => go(startNewPost(window.localStorage, new Date()))}>
          <Icon>{ICONS.plus}</Icon>
          Yeni yazı
        </Button>
        <ul>{link('#/yazilar', 'Yazılar', ICONS.posts)}</ul>
        <p className="nav-group">Site ayarları</p>
        <ul>{SETTINGS_SCREENS.map((s) => link(`#/ayarlar/${s.id}`, s.label, ICONS.gear))}</ul>
        <ul className="nav-end">
          <li>
            <button type="button" className="linklike" onClick={() => api.logout().catch(() => {}).finally(() => store.clear())}>
              <Icon>{ICONS.out}</Icon>
              Çıkış yap
            </button>
          </li>
        </ul>
      </nav>
      <main className="panel-main" id="panel-main">
        <div className="panel-tools">
          <button type="button" className="theme-toggle" onClick={toggleTheme}>
            <Icon>{theme === 'dark' ? ICONS.sun : ICONS.moon}</Icon>
            {theme === 'dark' ? 'Açık mod' : 'Karanlık mod'}
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
