import type { Lang } from '../lib/settings';

/** Every fixed interface string of the site, in both languages. */
const STRINGS = {
  navHome: { tr: 'Ana Sayfa', en: 'Home' },
  navAbout: { tr: 'Hakkımda', en: 'About' },
  navBlog: { tr: 'Blog', en: 'Blog' },
  navResources: { tr: 'Kaynaklar', en: 'Resources' },
  navContact: { tr: 'İletişim', en: 'Contact' },
  navPrivacyNotice: { tr: 'Aydınlatma Metni', en: 'Privacy Notice' },
  navPrivacyPolicy: { tr: 'Gizlilik Politikası', en: 'Privacy Policy' },
  menu: { tr: 'Menü', en: 'Menu' },
  mainNav: { tr: 'Ana menü', en: 'Main menu' },
  legalNav: { tr: 'Yasal metinler', en: 'Legal' },
  socialLinks: { tr: 'Sosyal bağlantılar', en: 'Social links' },
  skipToContent: { tr: 'İçeriğe geç', en: 'Skip to content' },
  bookSession: { tr: 'Randevu Al', en: 'Book a Session' },
  switchLangLabel: { tr: 'EN, English version', en: 'TR, Türkçe sürüm' },
  minRead: { tr: 'dk okuma', en: 'min read' },
  allPosts: { tr: 'Tüm Yazılar', en: 'All Posts' },
  slogan: { tr: 'Daha iyi bir yaşam mümkün.', en: 'A better life is possible.' },
  backToTop: { tr: 'Başa Dön', en: 'Back to Top' },
} satisfies Record<string, Record<Lang, string>>;

export type UiKey = keyof typeof STRINGS;

export function t(lang: Lang, key: UiKey): string {
  return STRINGS[key][lang];
}
