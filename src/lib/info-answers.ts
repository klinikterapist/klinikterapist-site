/**
 * "Süreç bilgisi" (owner's decision 2026-10-20, Faz 3): someone who only wants to know how it works
 * picks the topics; the answers to those topics alone go to their e-mail, with no time taken from
 * the calendar. No fee amounts here: they go to people with an appointment. Nothing is kept but an
 * event without the address (Bildirimler). Shared by the page and the backend.
 * The Turkish texts are the owner's own (2026-10-22), edited with the writing editor. In the e-mail a
 * "■ " line is a question heading and a "→ Label: address" line a button (apps-script/src/mail-html.ts).
 */
import { EMAIL_RE } from './field-rules';
import { pathFor, type PageKey } from '../i18n/routes';

type Text = { tr: string; en: string };
/** `a`: the answer's paragraphs; a paragraph may hold several lines ("– " list items). `link`: one button under the answer. */
export type InfoTopic = { id: string; q: Text; a: { tr: string[]; en: string[] }; link?: { label: Text; page: PageKey } };

export const INFO_TOPICS: InfoTopic[] = [
  {
    id: 'turler',
    q: { tr: 'Hangi görüşme türleri var?', en: 'What kinds of sessions are there?' },
    a: {
      tr: [
        'Bütün görüşmeler online yapılır. Görüşme türleri ve kimin için uygun oldukları kısaca şöyledir:',
        [
          '– Bireysel terapi (50 dakika): Kendi yaşadıklarınız üzerine birebir çalışmak istediğinizde.',
          '– Çift terapisi (60 dakika): İlişkileri üzerine birlikte çalışmak isteyen çiftler için.',
          '– Erişilebilir terapi (50 dakika): Bireysel terapiyle aynı süredir; ücret, ekonomik durumunuza göre belirlenir. Ekonomik güçlük yaşayanlar ve üniversite öğrencileri başvurabilir.',
          '– Ücretsiz ön görüşme (25–30 dakika): Terapiye başlamadan önce tanışmak ve sorularınızı sormak için.',
          '– Sonlandırma seansı (ücretsiz): Terapi süreci planlı biçimde tamamlandığında yapılan son görüşmedir.',
          '– Grup terapisi (90 dakika, ayda bir): Bir psikolog eşliğinde, ortak bir konu etrafında bir araya gelen 5–6 danışanla yapılır.',
        ].join('\n'),
        'Grup terapisi için kayıtlar henüz açık değil; ilgileniyorsanız bana yazabilirsiniz.',
      ],
      en: [
        'All sessions are held online. The kinds of sessions, and who they suit:',
        [
          '– Individual therapy (50 minutes): to work one to one on what you are going through.',
          '– Couples therapy (60 minutes): for couples who want to work on their relationship together.',
          '– Accessible therapy (50 minutes): the same length as individual therapy, with a fee set by your financial situation. Open to people in financial difficulty and to university students.',
          '– Free intro call (25–30 minutes): to meet and ask your questions before starting therapy.',
          '– Closing session (free): the last session when therapy ends as planned.',
          '– Group therapy (90 minutes, once a month): 5–6 people meeting around a shared topic, with a psychologist.',
        ].join('\n'),
        'Registration for group therapy is not open yet; if you are interested, please write to me.',
      ],
    },
    link: { label: { tr: 'Bana yazın', en: 'Write to me' }, page: 'contact' },
  },
  {
    id: 'surec',
    q: { tr: 'Terapi süreci nasıl ilerler?', en: 'How does therapy go?' },
    a: {
      tr: [
        'Terapi kişiden kişiye değişen, geniş bir süreçtir; kısaca anlatmak gerekirse şöyle ilerler. İlk seanslarda önce sizi ve terapiye başvurma nedeninizi konuşuruz.',
        'Sonrasında genellikle haftada bir, aynı gün ve saatte düzenli seanslarla devam ederiz. Sürecin ne kadar süreceği kişiye ve konuya göre değişir; belli aralıklarla nerede olduğumuzu birlikte değerlendiririz. Süreç planlı biçimde tamamlandığında ücretsiz bir sonlandırma seansı yaparız.',
      ],
      en: [
        'Therapy is a broad process that differs from person to person; in short, it goes like this. In the first sessions we talk about you and what brings you to therapy.',
        'We then usually continue weekly, on the same day and time. How long it takes depends on the person and the issue; from time to time we review together where we are. When therapy ends as planned, we have a free closing session.',
      ],
    },
    link: { label: { tr: 'Beni tanıyın', en: 'About me' }, page: 'about' },
  },
  {
    id: 'sure',
    q: { tr: 'Seanslar ne kadar sürer, ne sıklıkla olur?', en: 'How long are sessions, and how often?' },
    a: {
      tr: [
        'Bireysel terapi ve erişilebilir terapi seansları 50 dakika, çift terapisi seansları 60 dakika sürer. Bu seanslar çoğunlukla haftada bir yapılır.',
        'Grup terapisi ise 90 dakika sürer ve ayda bir yapılır (kayıtlar henüz açık değil). Ücretsiz ön görüşme 25–30 dakikadır.',
      ],
      en: [
        'Individual and accessible therapy sessions last 50 minutes, couples therapy sessions 60 minutes. These sessions are usually weekly.',
        'Group therapy lasts 90 minutes, once a month (registration is not open yet). The free intro call takes 25–30 minutes.',
      ],
    },
  },
  {
    id: 'online',
    q: { tr: 'Online görüşme nasıl yapılır?', en: 'How do online sessions work?' },
    a: {
      tr: [
        'Randevunuzdan ve düzenli seanslarınızdan önce görüntülü görüşme bağlantısını e-posta adresinize gönderirim. Görüşmeler, kolay erişilebilir olduğu için şifreli bağlantı kullanan Google Meet üzerinden yapılır.',
        'Seans için sessiz, kimsenin sizi duyamayacağı bir ortam ve düzgün bir internet bağlantısı yeterlidir. Kulaklık kullanmanızı özellikle öneririm.',
        'Teknik bir aksama yüzünden seanstan süre kaybedersek, kaybolan süreyi aynı seansın sonunda ya da bir sonraki seansta telafi ederiz.',
      ],
      en: [
        'Before your appointment and your regular sessions I send the video link to your e-mail address. Sessions are held on Google Meet, which uses an encrypted connection and is easy to join.',
        'A quiet place where nobody can hear you and a steady internet connection are all you need. I especially recommend headphones.',
        'If we lose time to a technical problem, we make it up at the end of the same session or in the next one.',
      ],
    },
    link: { label: { tr: 'Sık sorulan sorular', en: 'Frequently asked questions' }, page: 'faq' },
  },
  {
    id: 'gizlilik',
    q: { tr: 'Gizlilik nasıl korunur?', en: 'How is confidentiality kept?' },
    a: {
      tr: [
        'Terapinin temeli güvendir. Seanslarda paylaştığınız kişisel bilgiler, duygu ve düşünceler, Türk Psikologlar Derneği (TPD) Etik Yönetmeliği ve uluslararası terapi standartları gereği aramızda kalır. Görüşmelerde konuşulanlar, yazılı onayınız olmadan başka kişilerle, kurumlarla ya da aile bireylerinizle paylaşılmaz.',
        [
          'Gizliliğin sınırları:',
          'Gizlilik terapinin temel ilkesidir. Yasa ve meslek etiği, bu ilkenin yalnızca şu istisnai ve hayati durumlarda sınırlanmasını gerektirir:',
          '– Sizin kendinize ya da bir başkasına ciddi ve somut bir zarar verme riskinin bulunması,',
          '– Bir çocuğun, yaşlının ya da engelli bir kişinin istismara ya da ihmale uğradığının fark edilmesi,',
          '– Mahkemenin karar vererek bilgi istemesi.',
          'Bu sınırları ön görüşmede ya da ilk seansımızda sizinle açıkça konuşuruz.',
        ].join('\n'),
        [
          'Online görüşme ve kayıt:',
          'Online seanslar şifreli bağlantı kullanan Google Meet üzerinden yapılır. Seanslarda hiçbir şekilde ses, görüntü ya da ekran kaydı almam; aynı kural sizin için de geçerlidir. Seanslara ses yalıtımı ve gizliliği sağlanmış, kapalı bir terapi odasından bağlanırım. Sizin de yalnız ve rahat konuşabileceğiniz sessiz bir yerde olmanızı, mümkünse kulaklık kullanmanızı öneririm.',
        ].join('\n'),
        [
          'Kişisel verileriniz:',
          '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca adınız, soyadınız, iletişim bilgileriniz ve randevu geçmişiniz gibi temel verileriniz yalnızca randevuları düzenlemek, ödeme ve muhasebe kayıtlarını tutmak ve yasal yükümlülükleri yerine getirmek için saklanır. Verileriniz güvenli biçimde saklanır ve saklama amacı ortadan kalktığında imha edilir.',
        ].join('\n'),
      ],
      en: [
        'Therapy rests on trust. The personal information, feelings and thoughts you share in sessions stay between us, as the Turkish Psychological Association (TPD) Code of Ethics and international therapy standards require. Nothing said in sessions is shared with other people, institutions or your family without your written consent.',
        [
          'The limits of confidentiality:',
          'Confidentiality is a core principle of therapy. Law and professional ethics require it to be limited only in these exceptional, life-threatening situations:',
          '– a serious and real risk that you harm yourself or someone else,',
          '– noticing that a child, an older person or a disabled person is being abused or neglected,',
          '– a court ordering the information to be disclosed.',
          'We talk about these limits openly in the intro call or in our first session.',
        ].join('\n'),
        [
          'Online sessions and recording:',
          'Online sessions are held on Google Meet, which uses an encrypted connection. I never record sound, video or the screen in sessions; the same rule applies to you. I join from a closed, soundproofed therapy room, and I recommend that you too are alone in a quiet place where you can talk freely, with headphones if possible.',
        ].join('\n'),
        [
          'Your personal data:',
          'Under Turkish data protection law (KVKK no. 6698), basic data such as your name, contact details and appointment history are kept only to arrange appointments, keep payment and accounting records and meet legal obligations. Your data is stored securely and destroyed once there is no longer a reason to keep it.',
        ].join('\n'),
      ],
    },
    link: { label: { tr: 'Aydınlatma metnini okuyun', en: 'Read the privacy notice' }, page: 'privacyNotice' },
  },
  {
    id: 'iptal',
    q: { tr: 'İptal ve erteleme kuralı nedir?', en: 'What is the cancellation rule?' },
    a: {
      tr: [
        'Planlanan seansınızdan 3 gün önce size bir hatırlatma e-postası gelir. Bu e-postada, düzenli seanslarınız için oluşturulan size özel randevu sayfasının bağlantısı bulunur. Bu sayfadan seansınızı iptal edebilir ya da takvimdeki uygun saatlerden birini seçerek erteleyebilirsiniz.',
        'Önemli: Seansa 24 saatten az kala yapılan iptal ve ertelemelerde seans ücretinin tamamı ödenir. Bu kural, randevu saatlerini verimli planlayabilmek ve görüşmeleri düzenli sürdürebilmek içindir.',
      ],
      en: [
        'You get a reminder e-mail three days before your session. It holds the link to your own appointment page for your regular sessions, where you can cancel a session or move it to a free time in the calendar.',
        'Important: for a session cancelled or moved less than 24 hours before it starts, the full session fee is due. This rule keeps appointment times well planned and sessions regular.',
      ],
    },
  },
  {
    id: 'ucret',
    q: { tr: 'Seans ücretleri nasıl belirlenir?', en: 'How are session fees set?' },
    a: {
      tr: [
        'Seans ücretleri her yıl güncellenir ve görüşmenin türüne ve süresine göre değişir. Yurt dışında yaşıyorsanız ücret ve para birimi, yaşadığınız ülkeye göre ayrıca belirlenir.',
        [
          '– Bireysel terapi (50 dakika): Her yıl belirlenen standart seans ücreti uygulanır.',
          '– Çift terapisi (60 dakika): Ücreti, bireysel seans ücretinin iki katıdır.',
          '– Erişilebilir terapi (50 dakika): Ücret, ekonomik durumunuza göre belirlenir.',
          '– Grup terapisi (90 dakika): Kişi başı katılım ücreti, bireysel seans ücretinin üçte biridir (kayıtlar henüz açık değil).',
          '– Ücretsiz ön görüşme ve sonlandırma seansı: Ücret alınmaz.',
        ].join('\n'),
        'Psikolojik desteğin ekonomik nedenlerle yarıda kalmamasını önemsiyorum. İş kaybı, gelir azalması ya da benzeri ekonomik güçlükler yaşıyorsanız, koşullarınızı dikkate alan erişilebilir terapi uygulanabilir. Bu modelde seans süresi değişmez, ücret ekonomik durumunuza göre belirlenir. Üniversite eğitimine devam eden öğrenciler de erişilebilir terapi için başvurabilir.',
        'Güncel ücretleri ve erişilebilir terapiyle ilgili ayrıntıları, randevu ya da ön görüşme talebinizden sonra size e-postayla iletirim.',
      ],
      en: [
        'Session fees are updated every year and depend on the kind and length of the session. If you live abroad, the fee and currency are set for the country you live in.',
        [
          '– Individual therapy (50 minutes): the standard session fee set each year.',
          '– Couples therapy (60 minutes): twice the individual session fee.',
          '– Accessible therapy (50 minutes): a fee set by your financial situation.',
          '– Group therapy (90 minutes): a third of the individual session fee per person (registration is not open yet).',
          '– Free intro call and closing session: no fee.',
        ].join('\n'),
        'I care that psychological support does not stop for financial reasons. If you have lost your job, your income has dropped or you face similar difficulties, accessible therapy that takes your situation into account is possible. The session length stays the same; the fee is set by your financial situation. University students can apply for accessible therapy too.',
        'I send the current fees and the details of accessible therapy by e-mail after your appointment or intro call request.',
      ],
    },
  },
  {
    id: 'odeme',
    q: { tr: 'Ödeme nasıl yapılır?', en: 'How do I pay?' },
    a: {
      tr: [
        'Ödeme her seans için ayrı yapılır. Tutar ve ödeme bilgileri, randevu onayı e-postasında size gelir. Ödemeyi havale/EFT ile IBAN\'a ya da e-postada bir ödeme bağlantısı varsa o bağlantıyla yapabilirsiniz.',
        'Ödemeyi seanstan en geç 24 saat önce yapmanız gerekir. Seanstan 3 gün önce gelen hatırlatma e-postasında ödeme bilgileri yeniden yer alır. Ödemeniz bana ulaştığında size bir teşekkür e-postası gelir.',
        'Yurt dışından katılıyorsanız ödeme bilgilerini size ayrıca iletirim. Ücretsiz ön görüşme için ödeme yapılmaz.',
      ],
      en: [
        'Each session is paid separately. The amount and payment details come in the appointment confirmation e-mail. You can pay by bank transfer to the IBAN, or with the payment link if the e-mail has one.',
        'Payment is due at the latest 24 hours before the session. The reminder three days before the session repeats the payment details, and you get a thank-you e-mail once the payment reaches me.',
        'If you join from abroad, I send you the payment details separately. The free intro call needs no payment.',
      ],
    },
  },
  {
    id: 'onGorusme',
    q: { tr: 'Ücretsiz ön görüşme nedir?', en: 'What is the free intro call?' },
    a: {
      tr: [
        'Ücretsiz ön görüşme, terapiye başlamadan önce birbirimizi tanımamız ve ihtiyaçlarınızı konuşmamız için yapılan 25–30 dakikalık, online bir tanışma görüşmesidir.',
        'Bu görüşmede başvuru nedeninizi, terapiden beklentilerinizi ve üzerinde çalışmak istediğiniz konuları konuşuruz. Terapi sürecinin nasıl ilerlediğini de öğrenebilir, merak ettiğiniz her şeyi sorabilirsiniz.',
        'Amaç, ihtiyaçlarınızı genel hatlarıyla anlamak ve birlikte çalışmanın sizin için uygun olup olmadığına beraber karar vermektir. Ön görüşme bir terapi seansı değildir; ücret alınmaz ve sonrasında terapiye devam etme zorunluluğu yoktur.',
      ],
      en: [
        'The free intro call is a 25–30 minute online call to get to know each other and talk about what you need before starting therapy.',
        'We talk about what brings you, what you expect from therapy and what you would like to work on. You can also learn how therapy goes and ask anything you wonder about.',
        'The aim is to understand your needs in broad lines and to decide together whether working together suits you. The intro call is not a therapy session; it is free and there is no obligation to continue.',
      ],
    },
  },
  {
    id: 'acil',
    q: { tr: 'Acil durumda ne yapmalıyım?', en: 'What should I do in an emergency?' },
    a: {
      tr: [
        'Online terapi ve bu e-posta adresi acil yardım hizmeti değildir; e-postalara hemen yanıt veremeyebilirim.',
        'Kendiniz ya da bir başkası için hayati bir tehlike varsa lütfen hemen 112\'yi arayın ya da en yakın hastanenin acil servisine başvurun. Güvende olmanız her şeyden önce gelir.',
      ],
      en: [
        'Online therapy and this e-mail address are not an emergency service; I may not be able to answer e-mails right away.',
        'If your life or someone else\'s is in danger, please call your local emergency number right away (112 in Turkey and Europe) or go to the nearest hospital emergency department. Your safety comes first.',
      ],
    },
  },
];

export type InfoInput = { email: string; topics: string[]; consent: boolean };
export type InfoErrors = Partial<Record<'email' | 'topics' | 'consent', 'required' | 'invalid'>>;

export function validateInfo(i: InfoInput): InfoErrors {
  const e: InfoErrors = {};
  const email = i.email.trim();
  if (!email) e.email = 'required';
  else if (email.length > 254 || !EMAIL_RE.test(email)) e.email = 'invalid';
  if (!i.topics.length || i.topics.some((t) => !INFO_TOPICS.some((x) => x.id === t))) e.topics = 'required';
  if (!i.consent) e.consent = 'required';
  return e;
}

const MAIL = {
  tr: {
    subject: 'Bilgilendirme – klinikterapist.com',
    hello: 'Merhaba,',
    intro: 'İlginiz için teşekkür ederim. Sorduğunuz konuların yanıtlarını aşağıda bulabilirsiniz:',
    closing: 'Önce tanışmak isterseniz ücretsiz bir ön görüşme planlayabilir, hazırsanız doğrudan seans randevusu alabilirsiniz.',
    meet: 'Ücretsiz ön görüşme planlayın',
    book: 'Seans randevusu alın',
    sign: ['Saygılarımla,', 'Osman Güneş Özkurt', 'Klinik Psikolog', 'klinikterapist.com'],
  },
  en: {
    subject: 'The information you asked for – klinikterapist.com',
    hello: 'Hello,',
    intro: 'Thank you for your interest. Here are the answers to what you asked:',
    closing: 'If you would like to meet first, you can plan a free intro call; if you are ready, you can book a session directly.',
    meet: 'Plan a free intro call',
    book: 'Book a session',
    sign: ['Kind regards,', 'Osman Güneş Özkurt', 'Clinical Psychologist', 'klinikterapist.com'],
  },
};

/** The answer e-mail: only the chosen topics, each with its button; at the end, meet first or book. Fixed text. */
export function infoMail(topics: string[], lang: 'tr' | 'en', site: string): { subject: string; body: string } {
  const t = MAIL[lang];
  const button = (label: string, page: PageKey) => `→ ${label}: ${site}${pathFor(page, lang)}`;
  const blocks = INFO_TOPICS.filter((x) => topics.includes(x.id)).flatMap((x) => [
    `■ ${x.q[lang]}`,
    '',
    ...x.a[lang].flatMap((p) => [p, '']),
    ...(x.link ? [button(x.link.label[lang], x.link.page), ''] : []),
  ]);
  return {
    subject: t.subject,
    body: [t.hello, '', t.intro, '', ...blocks, t.closing, button(t.meet, 'preConsult'), button(t.book, 'appointment'), '', ...t.sign].join('\n'),
  };
}
