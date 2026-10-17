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

  // Home
  recentPosts: { tr: 'Son Yazılar', en: 'Latest Posts' },
  heroLinks: { tr: 'Bağlantılar', en: 'Links' },
  sections: { tr: 'Bölümler', en: 'Sections' },
  opensInNewTab: { tr: '(yeni sekmede açılır)', en: '(opens in a new tab)' },

  // Blog
  blogTitle: { tr: 'Blog Yazılarım', en: 'My Blog Posts' },
  blogLead: {
    tr: 'Psikoloji, zihinsel sağlık ve daha iyi bir yaşam üzerine notlar, düşünceler ve bilimsel içerikler.',
    en: 'Notes, reflections and science-based writing on psychology, mental health and a better life.',
  },
  categoryLead: {
    tr: 'kategorisindeki yazılar: psikoloji ve daha iyi bir yaşam üzerine notlar.',
    en: 'posts: notes on psychology and a better life.',
  },
  categories: { tr: 'Kategoriler', en: 'Categories' },
  breadcrumb: { tr: 'Sayfa yolu', en: 'Breadcrumb' },
  postList: { tr: 'Yazılar', en: 'Posts' },
  noPosts: {
    tr: 'Henüz yazı yok. İlk yazılar çok yakında burada olacak.',
    en: 'No posts yet. The first ones will be here soon.',
  },
  noPostsInCategory: { tr: 'Bu kategoride henüz yazı yok.', en: 'There are no posts in this category yet.' },
  published: { tr: 'Yayın tarihi', en: 'Published' },
  lastUpdated: { tr: 'Son güncelleme', en: 'Last updated' },
  relatedPosts: { tr: 'İlgili Yazılar', en: 'Related Posts' },
  references: { tr: 'Kaynakça', en: 'References' },
  aboutAuthor: { tr: 'Yazar hakkında', en: 'About the author' },
  moreAboutMe: { tr: 'Hakkımda daha fazlası', en: 'More about me' },
  newsletterTitle: { tr: 'Yeni Yazılardan Haberdar Olun', en: 'Get New Posts by E-mail' },
  newsletterText: {
    tr: 'Psikoloji, zihinsel sağlık ve yaşam üzerine yeni yazılarımı Substack üzerinden e-posta ile alabilirsiniz.',
    en: 'Receive my new posts on psychology, mental health and life by e-mail through Substack.',
  },
  newsletterCta: { tr: "Substack'te Abone Ol", en: 'Subscribe on Substack' },
  rssTitle: { tr: 'Blog yazıları (RSS)', en: 'Blog posts (RSS)' },

  // About
  areasOfWork: { tr: 'Çalışma alanları', en: 'Areas of work' },
  whoAmI: { tr: 'Ben Kimim?', en: 'Who Am I?' },
  whyThisWork: { tr: 'Neden Bu Mesleği Seçtim?', en: 'Why I Chose This Work' },
  education: { tr: 'Eğitim ve Mesleki Gelişim', en: 'Education and Professional Development' },

  // Resources
  resourcesLead: {
    tr: 'Psikoloji, psikoterapi ve kişisel gelişim alanında seçtiğim kaynaklar.',
    en: 'Resources I have selected in psychology, psychotherapy and personal growth.',
  },
  resourceTypes: { tr: 'Kaynak türleri', en: 'Resource types' },
  filterAll: { tr: 'Tümü', en: 'All' },
  featured: { tr: 'Öne Çıkan', en: 'Featured' },
  resourceList: { tr: 'Kaynak Listesi', en: 'Resource List' },
  viewResource: { tr: 'Kaynağa Git', en: 'View Resource' },
  myNote: { tr: 'Benim Notum', en: 'My Note' },
  type_book: { tr: 'Kitap', en: 'Book' },
  type_article: { tr: 'Makale', en: 'Article' },
  type_scale: { tr: 'Ölçek', en: 'Scale' },
  type_video: { tr: 'Video', en: 'Video' },
  type_podcast: { tr: 'Podcast', en: 'Podcast' },
  type_guide: { tr: 'Rehber', en: 'Guide' },
  types_book: { tr: 'Kitaplar', en: 'Books' },
  types_article: { tr: 'Makaleler', en: 'Articles' },
  types_scale: { tr: 'Ölçekler', en: 'Scales' },
  types_video: { tr: 'Videolar', en: 'Videos' },
  types_podcast: { tr: 'Podcastler', en: 'Podcasts' },
  types_guide: { tr: 'Rehberler', en: 'Guides' },

  // Contact
  channels: { tr: 'İletişim kanalları', en: 'Contact channels' },
  emailLabel: { tr: 'E-posta', en: 'E-mail' },
  emailHint: { tr: 'Sorularınızı iletin', en: 'Send your questions' },
  instagramHint: { tr: 'Güncel paylaşımlar', en: 'Latest posts' },
  linkedinHint: { tr: 'Profesyonel bağlantı', en: 'Professional network' },
  appointmentHint: { tr: 'Online görüşme', en: 'Online sessions' },
  workStyle: { tr: 'Çalışma Biçimi', en: 'How I Work' },
  onlineSessions: { tr: 'Online görüşme', en: 'Online sessions' },
  emergency: { tr: 'Acil durum', en: 'Emergency' },

  // Appointment
  appointmentSoon: {
    tr: 'Online randevu sistemi çok yakında burada. Şimdilik e-posta ile ulaşabilirsiniz.',
    en: 'The online booking system is coming here soon. For now, you can reach me by e-mail.',
  },
  sendEmail: { tr: 'E-posta Gönder', en: 'Send an E-mail' },
  goToContact: { tr: 'İletişim sayfasına git', en: 'Go to the contact page' },

  // Legal
  privacyNoticeDesc: {
    tr: 'Kişisel verilerin işlenmesine ilişkin KVKK aydınlatma metni.',
    en: 'Notice on the processing of personal data under the Turkish data protection law (KVKK).',
  },
  privacyPolicyDesc: {
    tr: 'Bu sitenin gizlilik politikası: hangi verilerin nasıl işlendiği.',
    en: 'The privacy policy of this site: which data is processed and how.',
  },

  // 404
  notFoundTitle: { tr: 'Sayfa bulunamadı', en: 'Page not found' },
  notFoundText: {
    tr: 'Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir.',
    en: 'The page you are looking for may have moved or never existed.',
  },
  backHome: { tr: 'Ana sayfaya dön', en: 'Back to the home page' },
} satisfies Record<string, Record<Lang, string>>;

export type UiKey = keyof typeof STRINGS;

export function t(lang: Lang, key: UiKey): string {
  return STRINGS[key][lang];
}
