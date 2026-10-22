/** The settings screens: menu label (each word capitalised, "ve"/"ile" small), icon and the one-line intro under the title. */
import { AtSign, BookOpen, IdCard, KeyRound, LayoutTemplate, Mail, MessageCircleQuestion, Palette, Scale, Search, Share2, ShieldCheck, Tags, TriangleAlert, UserRound, type LucideIcon } from '../icons';

export const SETTINGS_SCREENS: { id: string; label: string; icon: LucideIcon; intro: string }[] = [
  { id: 'profil', label: 'Profil ve Kimlik', icon: UserRound, intro: 'Adınız, unvanınız ve fotoğrafınız; ana sayfada ve yazıların altındaki yazar kutusunda görünür.' },
  { id: 'ana-sayfa', label: 'Site Ana Sayfası', icon: LayoutTemplate, intro: 'Randevu butonunun altındaki kartlar: sıra, görünürlük ve metinler.' },
  { id: 'linkler', label: 'Sosyal Bağlantılar', icon: Share2, intro: 'Sitede görünen sosyal hesaplarınız.' },
  { id: 'hakkimda', label: 'Hakkımda', icon: IdCard, intro: 'Hakkımda sayfasındaki yazılar ve bilgiler.' },
  { id: 'sss', label: 'Sık Sorulan Sorular', icon: MessageCircleQuestion, intro: 'Ana sayfada ve Sık sorulanlar sayfasında görünen sorular.' },
  { id: 'kaynaklar', label: 'Kaynaklar', icon: BookOpen, intro: 'Kaynaklar sayfasında önerdiğiniz kitap, yazı ve bağlantılar.' },
  { id: 'iletisim', label: 'İletişim', icon: Mail, intro: 'Ziyaretçilerin size ulaşacağı bilgiler.' },
  { id: 'kategoriler', label: 'Kategoriler', icon: Tags, intro: 'Blog yazılarınızın gruplandığı başlıklar.' },
  { id: 'eposta', label: 'E-posta Ayarları', icon: AtSign, intro: 'Adresler, imza ve danışanlara giden hazır e-postalar.' },
  { id: 'seo', label: 'Arama Motoru (SEO)', icon: Search, intro: "Google'da ve paylaşımlarda sitenin geneli için kullanılan bilgiler." },
  { id: 'gizlilik', label: 'Gizlilik ve Analitik', icon: ShieldCheck, intro: 'Google Analytics, Search Console, arama motorları, çerez bildirimi, sitenin sayacı ve sayfalara eklenen kodlar.' },
  { id: 'giris', label: 'Giriş Bilgileri', icon: KeyRound, intro: 'Panele girerken Google hesabınızdan önce sorulan kullanıcı adı ve şifre.' },
  { id: 'gorunum', label: 'Görünüm', icon: Palette, intro: 'Panelin teması, menü genişliği ve renk paleti. Bu ayarlar yalnızca bu tarayıcıda geçerlidir.' },
  { id: 'yasal', label: 'Yasal Metinler', icon: Scale, intro: 'Gizlilik ve kullanım metinleri.' },
  { id: 'onemli', label: 'Önemli Ayarlar', icon: TriangleAlert, intro: 'Bütün ziyaretçileri etkileyen, acil durumda kullanılan ayarlar. Her değişiklik önce onayınızı ister.' },
];
