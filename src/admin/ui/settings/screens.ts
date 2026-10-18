/** The nine settings screens: menu label, icon and the one-line intro under the title. */
import { BookOpen, IdCard, LayoutTemplate, Mail, Scale, Search, Share2, Tags, UserRound, type LucideIcon } from '../icons';

export const SETTINGS_SCREENS: { id: string; label: string; icon: LucideIcon; intro: string }[] = [
  { id: 'profil', label: 'Profil', icon: UserRound, intro: 'Adınız, unvanınız ve fotoğrafınız; ana sayfada ve yazıların altındaki yazar kutusunda görünür.' },
  { id: 'ana-sayfa', label: 'Site ana sayfası', icon: LayoutTemplate, intro: 'Randevu butonunun altındaki kartlar: sıra, görünürlük ve metinler.' },
  { id: 'linkler', label: 'Sosyal ve linkler', icon: Share2, intro: 'Sitede görünen sosyal hesaplarınız.' },
  { id: 'hakkimda', label: 'Hakkımda', icon: IdCard, intro: 'Hakkımda sayfasındaki yazılar ve bilgiler.' },
  { id: 'kaynaklar', label: 'Kaynaklar', icon: BookOpen, intro: 'Kaynaklar sayfasında önerdiğiniz kitap, yazı ve bağlantılar.' },
  { id: 'iletisim', label: 'İletişim', icon: Mail, intro: 'Ziyaretçilerin size ulaşacağı bilgiler.' },
  { id: 'kategoriler', label: 'Kategoriler', icon: Tags, intro: 'Blog yazılarınızın gruplandığı başlıklar.' },
  { id: 'seo', label: 'SEO genel', icon: Search, intro: "Google'da ve paylaşımlarda sitenin geneli için kullanılan bilgiler." },
  { id: 'yasal', label: 'Yasal metinler', icon: Scale, intro: 'Gizlilik ve kullanım metinleri.' },
];
