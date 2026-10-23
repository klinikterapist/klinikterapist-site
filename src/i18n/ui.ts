import type { Lang } from '../lib/settings';

/** Every fixed interface string of the site, in both languages. */
export const STRINGS = {
  navHome: { tr: 'Ana Sayfa', en: 'Home' },
  navAbout: { tr: 'Hakkımda', en: 'About' },
  navBlog: { tr: 'Blog', en: 'Blog' },
  navResources: { tr: 'Kaynaklar', en: 'Resources' },
  navContact: { tr: 'İletişim', en: 'Contact' },
  navFaq: { tr: 'Sık Sorulanlar', en: 'FAQ' },
  navPrivacyNotice: { tr: 'Aydınlatma Metni', en: 'Privacy Notice' },
  navPrivacyPolicy: { tr: 'Gizlilik Politikası', en: 'Privacy Policy' },
  menu: { tr: 'Menü', en: 'Menu' },
  mainNav: { tr: 'Ana menü', en: 'Main menu' },
  legalNav: { tr: 'Yasal metinler', en: 'Legal' },
  socialLinks: { tr: 'Sosyal bağlantılar', en: 'Social links' },
  skipToContent: { tr: 'İçeriğe geç', en: 'Skip to content' },
  bookSession: { tr: 'Randevu Al', en: 'Book a Session' },
  bookingClosed: { tr: 'Randevu alımına kapalı', en: 'Bookings closed' },
  switchLangLabel: { tr: 'ENG, English version', en: 'TR, Türkçe sürüm' },
  minRead: { tr: 'dk okuma', en: 'min read' },
  allPosts: { tr: 'Tüm Yazılar', en: 'All Posts' },
  slogan: { tr: 'Daha iyi bir yaşam mümkün.', en: 'A better life is possible.' },
  backToTop: { tr: 'Başa Dön', en: 'Back to Top' },

  // Home
  recentPosts: { tr: 'Son Yazılar', en: 'Latest Posts' },
  heroLinks: { tr: 'Bağlantılar', en: 'Links' },
  sections: { tr: 'Bölümler', en: 'Sections' },
  opensInNewTab: { tr: '(yeni sekmede açılır)', en: '(opens in a new tab)' },
  memberOf: { tr: '{org} üyesi', en: 'Member of the {org}' },
  heroHi: { tr: 'Merhaba', en: 'Hello' },
  heroMe: { tr: 'Ben {who}.', en: "I'm {who}." },
  heroWelcome: { tr: 'Hoş geldiniz', en: 'Welcome' },
  brandTitle: { tr: 'klinikterapist nedir?', en: 'What is klinikterapist?' },
  cookiePrefs: { tr: 'Çerez tercihleri', en: 'Cookie preferences' },
  preConsult: { tr: 'Ön Görüşme', en: 'Intro Call' },
  preConsultSub: { tr: 'Ücretsiz · Online', en: 'Free · Online' },
  bookCardSub: { tr: 'Size uygun yolu birlikte seçelim', en: 'Let’s find the way that suits you' },
  freeIntroBadge: { tr: 'Ücretsiz ön görüşme', en: 'Free intro call' },
  freeIntroBadgeHint: { tr: '25–30 dakika · online', en: '25–30 minutes · online' },
  followSocial: { tr: 'Sosyal medyada takip et', en: 'Follow on social media' },
  andMore: { tr: '{list} ve diğerleri', en: '{list} and more' },
  newPost: { tr: 'YENİ YAZI', en: 'NEW POST' },
  popularPosts: { tr: 'Popüler Yazılar', en: 'Popular Posts' },
  popularHint: { tr: 'En çok okunanlar', en: 'Most read' },
  faqTitle: { tr: 'Sık Sorulan Sorular', en: 'Frequently Asked Questions' },
  newsletterItem: { tr: 'Bültene abone ol', en: 'Subscribe to the newsletter' },
  newsletterItemHint: { tr: 'Substack · ayda bir mektup', en: 'Substack · a letter a month' },
  newsletterBandTitle: { tr: 'Ayda bir mektup', en: 'A letter a month' },
  newsletterBandText: {
    tr: 'Yazılarım ve küçük öneriler, Substack üzerinden.',
    en: 'My writing and small suggestions, via Substack.',
  },
  firstSession: { tr: 'İlk görüşme nasıl geçer?', en: 'What is the first session like?' },
  processTitle: { tr: 'Süreç nasıl işler?', en: 'How does it work?' },
  hello: { tr: 'Merhaba, ben {name}.', en: "Hi, I'm {name}." },

  // Blog
  blogTitle: { tr: 'Blog', en: 'Blog' },
  // Spec §5.8: "Blog" and a short description (wording from the blog mockups).
  blogLead: {
    tr: 'Kaygı, ilişkiler ve kendini anlamak üzerine yazılar.',
    en: 'Writing on anxiety, relationships and understanding yourself.',
  },
  // The longer text stays as the page's meta description for search results.
  blogMetaDescription: {
    tr: 'Psikoloji, zihinsel sağlık ve daha iyi bir yaşam üzerine notlar, düşünceler ve bilimsel içerikler.',
    en: 'Notes, reflections and science-based writing on psychology, mental health and a better life.',
  },
  categoryLead: {
    tr: 'kategorisindeki yazılar: psikoloji ve daha iyi bir yaşam üzerine notlar.',
    en: 'posts: notes on psychology and a better life.',
  },
  /** A category page's description for search results ({cat}: the category's name); longer than the lead on the page. */
  categoryMeta: {
    tr: '{cat} kategorisindeki yazılar: psikoloji, zihinsel sağlık ve daha iyi bir yaşam üzerine bilimsel temelli notlar ve düşünceler.',
    en: 'Posts on {cat}: science-based notes and reflections on psychology, mental health and a better life, written by a clinical psychologist.',
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
  similarPosts: { tr: 'Bunları da okumanızı öneririm', en: 'You might also enjoy reading' },
  similarPostsLead: { tr: 'Aynı konuda yazdığım birkaç yazı daha.', en: 'A few more posts on the same topic.' },
  references: { tr: 'Kaynakça', en: 'References' },
  postsOne: { tr: '{n} yazı', en: '{n} post' },
  postsMany: { tr: '{n} yazı', en: '{n} posts' },
  postsNone: { tr: 'Henüz yazı yok', en: 'No posts yet' },
  referencesOne: { tr: '{n} kaynak', en: '{n} reference' },
  referencesMany: { tr: '{n} kaynak', en: '{n} references' },
  authorLabel: { tr: 'Yazar', en: 'Author' },
  sharePost: { tr: 'Yazıyı paylaş', en: 'Share this post' },
  shareStory: { tr: 'Instagram hikayesinde paylaş', en: 'Share to Instagram story' },
  copyLink: { tr: 'Bağlantıyı kopyala', en: 'Copy link' },
  shareWhatsapp: { tr: "WhatsApp'ta paylaş", en: 'Share on WhatsApp' },
  copied: { tr: 'Kopyalandı', en: 'Copied' },
  storyDownloaded: {
    tr: "Görsel indirildi; Instagram'da hikayene ekleyebilirsin.",
    en: 'Image downloaded; you can add it to your Instagram story.',
  },
  rssTitle: { tr: 'Blog yazıları (RSS)', en: 'Blog posts (RSS)' },
  searchLabel: { tr: 'Yazılarda ara', en: 'Search posts' },
  searchPlaceholder: { tr: 'Yazılarda ara…', en: 'Search posts…' },
  noResults: { tr: 'Eşleşen yazı bulunamadı.', en: 'No matching posts.' },
  topics: { tr: 'Konular', en: 'Topics' },
  topicsHint: { tr: 'Yazılar konularına göre', en: 'Posts by topic' },
  topicsLead: { tr: 'Yazılarımı konularına göre bir arada bulabilirsiniz.', en: 'Find my posts grouped by topic.' },
  topicsMetaDescription: {
    tr: 'Psikoloji yazılarının konu arşivi: zihinsel sağlık, terapi, duygular ve daha fazlası.',
    en: 'The topic archive of the psychology posts: mental health, therapy, emotions and more.',
  },
  popularChip: { tr: 'Popüler', en: 'Popular' },
  seeAll: { tr: 'Tümünü gör', en: 'See all' },
  popularLead: { tr: 'En çok okunan ve öne çıkan yazılarım.', en: 'My most read and featured posts.' },
  popularMetaDescription: {
    tr: 'Psikoloji ve daha iyi bir yaşam üzerine en çok okunan ve öne çıkan yazılar.',
    en: 'The most read and featured posts on psychology and a better life.',
  },
  popularEmpty: {
    tr: 'Henüz öne çıkan bir yazı yok. Tüm yazılara göz atabilirsiniz.',
    en: 'There are no featured posts yet. You can browse all posts.',
  },
  newLabel: { tr: 'Yeni', en: 'New' },
  blogNewsletterTitle: { tr: 'Yeni yazılar e-postana gelsin', en: 'Get new posts by e-mail' },
  blogNewsletterBand: { tr: 'Ayda bir, Substack üzerinden.', en: 'Once a month, via Substack.' },
  subscribe: { tr: 'Abone ol', en: 'Subscribe' },

  // About
  areasOfWork: { tr: 'Çalışma alanlarım', en: 'My areas of work' },
  whoAmI: { tr: 'Ben kimim?', en: 'Who am I?' },
  whyThisWork: { tr: 'Bu işi neden yapıyorum?', en: 'Why do I do this work?' },
  education: { tr: 'Eğitim ve deneyim', en: 'Education and experience' },
  timelineHint: { tr: 'Zaman çizelgesi', en: 'Timeline' },
  certificates: { tr: 'Sertifikalarım', en: 'My certificates' },
  certificatesHint: { tr: 'Eğitimler ve belgeler', en: 'Trainings and credentials' },
  viewCertificate: { tr: 'Belgeyi görüntüle', en: 'View certificate' },
  approaches: { tr: 'Yaklaşımlar', en: 'Approaches' },
  aboutTabs: { tr: 'Hakkımda bölümleri', en: 'About sections' },
  tabStory: { tr: 'Hikayem', en: 'My Story' },
  tabHow: { tr: 'Nasıl Çalışırım', en: 'How I Work' },
  tabEducation: { tr: 'Eğitim ve Kariyer', en: 'Education and Career' },
  readStory: { tr: 'Hikayenin devamını oku', en: 'Read the rest of my story' },
  trainingShort: { tr: 'Eğitim', en: 'Training' },
  trainingSummary: { tr: 'teorik, {p} saat uygulamalı eğitim', en: 'of theory, {p} hours of practice' },
  aboutCta: { tr: 'Sıra sizde.', en: 'Your turn.' },
  career: { tr: 'Kariyer', en: 'Career' },
  careerHint: { tr: 'Okul ve işler, yıllara göre', en: 'Schools and work, by year' },
  careerSchool: { tr: 'Okul', en: 'School' },
  careerWork: { tr: 'İş', en: 'Work' },
  careerVolunteer: { tr: 'Gönüllü', en: 'Volunteer' },
  educationCerts: { tr: 'Eğitimler ve Sertifikalar', en: 'Education and Certificates' },
  educationCertsHint: { tr: 'Toplam saat, aşağıdaki kartlardan hesaplanır', en: 'The totals add up the cards below' },
  theoryTraining: { tr: 'Teorik eğitim', en: 'Theoretical training' },
  theoryTrainingHint: { tr: 'Dersler, Sertifika, Workshop ve Webinar', en: 'Courses, Certificates, Workshops and Webinars' },
  practiceTraining: { tr: 'Uygulamalı eğitim', en: 'Practical training' },
  practiceTrainingHint: { tr: 'Terapi, Süpervizyon, Uygulama Ödevleri', en: 'Therapy, Supervision, Practice Assignments' },
  hoursUnit: { tr: 'saat', en: 'hours' },
  hoursTheory: { tr: '{n} sa. teorik', en: '{n} hrs theory' },
  hoursPractice: { tr: '{n} sa. uygulamalı', en: '{n} hrs practice' },
  contactMe: { tr: 'Benimle iletişime geç', en: 'Get in touch' },
  contactMeHint: { tr: 'E-posta ve sosyal medya', en: 'E-mail and social media' },

  // Resources
  resourcesLead: {
    tr: 'Psikoloji, psikoterapi ve kişisel gelişim alanında seçtiğim kaynaklar.',
    en: 'Resources I have selected in psychology, psychotherapy and personal growth.',
  },
  filterAll: { tr: 'Tümü', en: 'All' },
  featured: { tr: 'Öne çıkan', en: 'Featured' },
  byType: { tr: 'Türüne göre', en: 'By type' },
  resourcesOne: { tr: '{n} kaynak', en: '{n} resource' },
  resourcesMany: { tr: '{n} kaynak', en: '{n} resources' },
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
  emailLabel: { tr: 'E-posta', en: 'E-mail' },
  onlineSessions: { tr: 'Online görüşme', en: 'Online sessions' },
  responseTitle: { tr: 'Dönüş süresi', en: 'Response time' },
  memberNo: { tr: 'Üye No: {n}', en: 'Member no. {n}' },
  emergency: { tr: 'Acil durum', en: 'Emergency' },
  // Contact form: "{link}" is the Appointment page / privacy notice link.
  formTitle: { tr: 'Mesaj gönder', en: 'Send a message' },
  formAppointmentNote: {
    tr: 'Randevu ve seanslarla ilgili sorularınız için {link} kullanın.',
    en: 'For questions about appointments and sessions, please use the {link}.',
  },
  formAppointmentLink: { tr: 'Randevu sayfasını', en: 'Appointment page' },
  formName: { tr: 'Ad Soyad', en: 'Full name' },
  formEmail: { tr: 'E-posta', en: 'E-mail' },
  formTopic: { tr: 'Konu', en: 'Topic' },
  formTopicChoose: { tr: 'Bir konu seçin', en: 'Choose a topic' },
  otherWays: { tr: 'Diğer iletişim yolları', en: 'Other ways to reach me' },
  formTopicAsk: { tr: 'Ne hakkında yazıyorsunuz?', en: 'What are you writing about?' },
  formMessage: { tr: 'Mesaj', en: 'Message' },
  formConsent: {
    tr: '{link} okudum.',
    en: 'I have read the {link}.',
  },
  formConsentLink: { tr: 'Aydınlatma metnini', en: 'privacy notice' },
  formHoneypot: { tr: 'Bu alanı boş bırakın', en: 'Leave this field empty' },
  formSend: { tr: 'Gönder', en: 'Send' },
  formSending: { tr: 'Gönderiliyor…', en: 'Sending…' },
  formSuccess: {
    tr: 'Teşekkürler, mesajınız bana ulaştı. En kısa sürede yanıt vereceğim.',
    en: 'Thank you, your message has reached me. I will reply as soon as I can.',
  },
  formFailure: {
    tr: 'Mesajınız şu anda gönderilemedi. Lütfen biraz sonra tekrar deneyin ya da doğrudan {link} adresine e-posta gönderin.',
    en: 'Your message could not be sent right now. Please try again a little later, or e-mail me directly at {link}.',
  },
  formNoScript: {
    tr: 'Formu göndermek için tarayıcınızda JavaScript açık olmalı. Bana doğrudan {link} adresinden de yazabilirsiniz.',
    en: 'Sending the form needs JavaScript in your browser. You can also write to me directly at {link}.',
  },
  errRequired: { tr: 'Bu alanı doldurun.', en: 'Please fill in this field.' },
  errNameLong: { tr: 'En fazla 100 karakter yazabilirsiniz.', en: 'Please use at most 100 characters.' },
  errEmail: { tr: 'Geçerli bir e-posta adresi yazın.', en: 'Please enter a valid e-mail address.' },
  errTopic: { tr: 'Bir konu seçin.', en: 'Please choose a topic.' },
  errMessageShort: { tr: 'Mesajınız en az 10 karakter olmalı.', en: 'Your message needs at least 10 characters.' },
  errMessageLong: { tr: 'Mesajınız en fazla 5000 karakter olabilir.', en: 'Your message can be at most 5000 characters.' },
  errConsent: { tr: 'Göndermek için onay kutusunu işaretleyin.', en: 'Please tick the box to send.' },

  // Appointment
  appointmentClosed: {
    tr: 'Randevu alımı şu an kapalı. Bana e-posta ile ulaşabilirsiniz.',
    en: 'Booking is closed at the moment. You can reach me by e-mail.',
  },
  appointmentSoon: {
    tr: 'Online randevu sistemi çok yakında burada. Şimdilik e-posta ile ulaşabilirsiniz.',
    en: 'The online booking system is coming here soon. For now, you can reach me by e-mail.',
  },
  sendEmail: { tr: 'E-posta gönder', en: 'Send an e-mail' },
  goToContact: { tr: 'İletişim sayfasına git', en: 'Go to the contact page' },

  // FAQ page
  faqDesc: {
    tr: 'Online görüşmeler, ilk seans, gizlilik ve randevu hakkında sık sorulan soruların yanıtları.',
    en: 'Answers to common questions about online sessions, the first meeting, confidentiality and booking.',
  },
  faqEmpty: {
    tr: 'Sorular yakında burada olacak. Merak ettiğiniz bir şey varsa bana yazabilirsiniz.',
    en: 'Questions will be here soon. If you are wondering about something, feel free to write to me.',
  },

  // Legal
  privacyNoticeDesc: {
    tr: 'KVKK aydınlatma metni: bu sitede hangi kişisel verilerin, hangi amaçla ve ne kadar süreyle işlendiği ve bu verilerle ilgili haklarınız.',
    en: 'Notice on the processing of personal data under the Turkish data protection law (KVKK).',
  },
  privacyPolicyDesc: {
    tr: 'Bu sitenin gizlilik politikası: hangi verilerin işlendiği, çerez ve ziyaret sayacı kullanımı, verilerin nasıl korunduğu ve haklarınız.',
    en: 'The privacy policy of this site: which data is processed, how cookies and the visit counter are used, how data is protected and your rights.',
  },

  // Theme
  themeLabel: { tr: 'Görünüm', en: 'Appearance' },
  themeSystem: { tr: 'Sistem', en: 'System' },
  themeLight: { tr: 'Gündüz', en: 'Day' },
  themeDark: { tr: 'Gece', en: 'Night' },
  themeChipName: {
    tr: 'Görünüm: {mode}. Değiştirmek için dokunun, sisteme dönmek için basılı tutun.',
    en: 'Appearance: {mode}. Tap to switch, press and hold to return to system.',
  },

  // Mobile app blocks
  switchLangShort: { tr: 'ENG', en: 'TR' },
  rightsReserved: { tr: 'Tüm hakları saklıdır.', en: 'All rights reserved.' },

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

/** A counted phrase: `one` for 1, `many` otherwise, with `{n}` filled in ("1 reference", "2 references"). */
export function tCount(lang: Lang, one: UiKey, many: UiKey, n: number): string {
  return t(lang, n === 1 ? one : many).replace('{n}', String(n));
}
