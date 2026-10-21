/**
 * Panel frame (owner's decisions 2026-10-21, SITE-GUNCELLEMESI.md karar 6 and 7): the sidebar in five
 * parts — Genel Bakış, then the groups Danışanlar ve Randevular, İçerik, Site Sayfaları and Ayarlar,
 * each folding open and shut (remembered in this browser; the group of the open screen always shows).
 * Owner's review 2026-10-21: "Yeni Yazı" and "Seans Ekle" sit above Genel Bakış; "Menüyü daralt" and
 * "Siteyi Aç" under it.
 * Every group has its tone, shown as the colour of its icon tiles. The sidebar stays put beside the
 * screen, without a scrollbar, and narrows to an icon rail with the button at its top (remembered;
 * also in Ayarlar › Görünüm), names then showing as tooltips. Karanlık Mod, Siteyi Aç, Görünüm and
 * Çıkış Yap sit in a row at the bottom. On phones the sidebar is a drawer. The notifications are fetched
 * here for the menu badges and handed to the bell on the appointment screens (NotesContext).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { go, usePanel, type Route } from './context';
import { startNewPost } from '../lib/new-post';
import { useTheme } from './theme';
import { Button } from './kit';
import {
  BellRing,
  CalendarCheck,
  CalendarClock,
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
  Palette,
  PencilLine,
  CalendarPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Trash2,
  UsersRound,
  type LucideIcon,
} from './icons';
import { SETTINGS_SCREENS } from './settings/screens';
import { NotesContext, unseenOf, useNotifications } from './notifications';
import { useNoTrack } from './no-track';
import { RAIL_KEY, usePref } from './prefs';
import { setMailTexts } from '../../lib/mail-texts';
import { parseMailTexts } from '../../lib/schemas';

export { SETTINGS_SCREENS };

export type Tone = 'lacivert' | 'gunes' | 'adacayi' | 'kiremit' | 'lavanta' | 'deniz';
type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };
type NavGroup = { id: string; label: string; icon: LucideIcon; tone: Tone; items: NavItem[] };

const screen = (id: string): NavItem => {
  const s = SETTINGS_SCREENS.find((x) => x.id === id)!;
  return { href: `#/ayarlar/${id}`, label: s.label, icon: s.icon };
};

export const SITE_PAGES = ['ana-sayfa', 'hakkimda', 'sss', 'kaynaklar', 'iletisim', 'yasal'];
export const SETTINGS = ['profil', 'linkler', 'eposta', 'seo', 'gizlilik', 'gorunum'];

export function navGroups(badges: { requests: number; notifications: number }): NavGroup[] {
  return [
    {
      id: 'danisan',
      label: 'Danışanlar ve Randevular',
      icon: CalendarCheck,
      tone: 'adacayi',
      items: [
        { href: '#/profil', label: 'Randevu Özeti', icon: CalendarClock },
        { href: '#/randevular', label: 'Randevu Talepleri', icon: Inbox, badge: badges.requests },
        { href: '#/seans-takip', label: 'Danışanlar', icon: UsersRound },
        { href: '#/bildirimler', label: 'Bildirimler', icon: BellRing, badge: badges.notifications },
      ],
    },
    {
      id: 'icerik',
      label: 'İçerik',
      icon: FileText,
      tone: 'lavanta',
      items: [{ href: '#/yazilar', label: 'Yazılar', icon: FileText }, screen('kategoriler'), { href: '#/cop-kutusu', label: 'Silinen Yazılar', icon: Trash2 }],
    },
    { id: 'site', label: 'Site Sayfaları', icon: Globe, tone: 'deniz', items: SITE_PAGES.map(screen) },
    { id: 'ayarlar', label: 'Ayarlar', icon: Settings, tone: 'lacivert', items: SETTINGS.map(screen) },
  ];
}

/** The tone of a menu entry's group, for its screen header (Genel Bakış is the sun's). */
export function toneOf(href: string): Tone {
  return navGroups({ requests: 0, notifications: 0 }).find((g) => g.items.some((x) => x.href === href))?.tone ?? 'gunes';
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

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { api, store } = usePanel();
  const [open, setOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  // Site Sayfaları and Ayarlar start folded, so the larger menu fits the window without scrolling;
  // the group of the open screen always shows, and the owner's own folding is remembered.
  const [closed, setClosed] = usePref<string[]>('kt.nav.closed', ['site', 'ayarlar']);
  const [rail, setRail] = usePref<boolean>(RAIL_KEY, false);
  const notes = useNotifications(api);
  // Writes the default ("do not count me") on the first visit, as before; the switch is in Gizlilik ve Analitik.
  useNoTrack();
  useEffect(() => setOpen(false), [route]);
  // The owner's own e-mail wording (Ayarlar › E-posta Ayarları), for every e-mail the panel makes.
  useEffect(() => {
    api
      .read(['src/data/mail.json'])
      .then(({ files }) => files[0] && setMailTexts(parseMailTexts(JSON.parse(files[0].content))))
      .catch(() => undefined);
  }, [api]);
  const current = currentHref(route);
  const groups = navGroups({ requests: notes.pending, notifications: unseenOf(notes.events, notes.seen) });
  const folded = Array.isArray(closed) ? closed : [];
  const toggleFold = (id: string) => setClosed(folded.includes(id) ? folded.filter((x) => x !== id) : [...folded, id]);

  const link = ({ href, label, icon, badge }: NavItem, tone: Tone) => (
    <li key={href}>
      <a href={href} aria-current={current === href ? 'page' : undefined} data-tip={label}>
        <span className={`tone-tile tone-tile-sm tone-${tone}`} aria-hidden="true">
          <Icon as={icon} size={16} />
        </span>
        <span className="nav-label">{label}</span>
        {!!badge && (
          <span className="nav-badge">
            {badge > 99 ? '99+' : badge}
            <span className="k-visually-hidden"> yeni</span>
          </span>
        )}
      </a>
    </li>
  );

  return (
    <div className={`shell${rail ? ' is-rail' : ''}`}>
      <div className="panel-top">
        <Button variant="ghost" className="menu-toggle" aria-expanded={open} aria-controls="panel-nav" onClick={() => setOpen(!open)}>
          <Icon as={Menu} size={20} />
          Menü
        </Button>
      </div>
      <nav id="panel-nav" className={`panel-nav ${open ? 'open' : ''}`} aria-label="Panel menüsü">
        <div className="nav-brand">
          <a className="nav-logo" href="#/">
            <img className="logo-light" src="/admin/logo-black.png" alt="klinikterapist" />
            <img className="logo-dark" src="/admin/logo-white.png" alt="klinikterapist" />
          </a>
        </div>
        {/* Owner's review 2026-10-21: the two things started most often, above everything else. */}
        <div className="nav-quick">
          <Button variant="primary" className="nav-new" data-tip="Yeni Yazı" aria-label="Yeni Yazı" onClick={() => go(startNewPost(window.localStorage, new Date()))}>
            <Icon as={PencilLine} />
            <span className="nav-label">Yeni Yazı</span>
          </Button>
          <a className="k-btn k-btn-secondary nav-session" href="#/randevular?ekle=yeni" data-tip="Seans Ekle" aria-label="Seans Ekle">
            <Icon as={CalendarPlus} />
            <span className="nav-label">Seans Ekle</span>
          </a>
        </div>
        <ul className="nav-home">{link({ href: '#/', label: 'Genel Bakış', icon: House }, 'gunes')}</ul>
        <div className="nav-tools">
          <button
            type="button"
            className="nav-tool"
            aria-pressed={rail}
            aria-label={rail ? 'Menüyü genişlet' : 'Menüyü daralt'}
            data-tip={rail ? 'Menüyü genişlet' : 'Menüyü daralt'}
            onClick={() => setRail(!rail)}
          >
            <Icon as={rail ? PanelLeftOpen : PanelLeftClose} size={17} />
            <span className="nav-label">Menüyü daralt</span>
          </button>
          <a className="nav-tool" href="/" target="_blank" rel="noreferrer" aria-label="Siteyi Aç (yeni sekmede)" data-tip="Siteyi Aç ↗">
            <Icon as={ExternalLink} size={17} />
            <span className="nav-label">Siteyi Aç</span>
          </a>
        </div>
        {groups.map((g) => {
          const here = g.items.some((x) => x.href === current);
          const shut = !rail && folded.includes(g.id) && !here;
          return (
            <div key={g.id} className="nav-section">
              <button type="button" className="nav-fold" aria-expanded={!shut} aria-controls={`nav-${g.id}`} onClick={() => toggleFold(g.id)}>
                <span>{g.label}</span>
                <Icon as={ChevronDown} size={14} />
              </button>
              {!shut && (
                <div id={`nav-${g.id}`}>
                  <ul>{g.items.map((x) => link(x, g.tone))}</ul>
                </div>
              )}
            </div>
          );
        })}
        <div className="nav-end">
          <button type="button" className="nav-end-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Açık Mod' : 'Karanlık Mod'} data-tip={theme === 'dark' ? 'Açık Mod' : 'Karanlık Mod'}>
            <Icon as={theme === 'dark' ? Sun : Moon} />
          </button>
          <a className="nav-end-btn" href="#/ayarlar/gorunum" aria-label="Görünüm" data-tip="Görünüm">
            <Icon as={Palette} />
          </a>
          <button type="button" className="nav-end-btn" onClick={() => api.logout().catch(() => {}).finally(() => store.clear())} aria-label="Çıkış Yap" data-tip="Çıkış Yap">
            <Icon as={LogOut} />
          </button>
        </div>
      </nav>
      <main className={`panel-main tone-${toneOf(current)}`} id="panel-main">
        <NotesContext.Provider value={notes}>{children}</NotesContext.Provider>
      </main>
    </div>
  );
}
