/** Panel frame: menu (side on desktop, drawer on phones), deploy status, the current screen. */
import { useEffect, useState, type ReactNode } from 'react';
import { usePanel, type Route } from './context';
import { Button } from './kit';

export const SETTINGS_SCREENS: { id: string; label: string }[] = [
  { id: 'profil', label: 'Profil' },
  { id: 'ana-sayfa', label: 'Ana sayfa' },
  { id: 'linkler', label: 'Sosyal ve linkler' },
  { id: 'hakkimda', label: 'Hakkımda' },
  { id: 'kaynaklar', label: 'Kaynaklar' },
  { id: 'iletisim', label: 'İletişim' },
  { id: 'kategoriler', label: 'Kategoriler' },
  { id: 'seo', label: 'SEO genel' },
  { id: 'yasal', label: 'Yasal metinler' },
];

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { api, store } = usePanel();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);
  const current = route.name === 'settings' ? `#/ayarlar/${route.screen}` : '#/';
  const link = (href: string, label: string) => (
    <li key={href}>
      <a href={href} aria-current={current === href ? 'page' : undefined}>
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
        <ul>
          {link('#/', 'Yazılar')}
        </ul>
        <p className="nav-group">Site ayarları</p>
        <ul>{SETTINGS_SCREENS.map((s) => link(`#/ayarlar/${s.id}`, s.label))}</ul>
        <ul className="nav-end">
          <li>
            <a href="/" target="_blank" rel="noreferrer">
              Siteyi aç ↗
            </a>
          </li>
          <li>
            <button type="button" className="linklike" onClick={() => api.logout().catch(() => {}).finally(() => store.clear())}>
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
