/**
 * "Süreç bilgisi" (owner's decision 2026-10-20, Faz 3): someone who only wants to know how it works
 * picks the topics; the answers to those topics alone go to their e-mail, with no time taken from
 * the calendar. The fee is not given here: it goes to people with an appointment. Nothing is kept
 * but an event without the address (Bildirimler). The texts are drafts for the owner to approve.
 * Shared by the page and the backend.
 */
import { EMAIL_RE } from './field-rules';

export type InfoTopic = { id: string; q: { tr: string; en: string }; a: { tr: string[]; en: string[] } };

export const INFO_TOPICS: InfoTopic[] = [
  {
    id: 'surec',
    q: { tr: 'Terapi süreci nasıl ilerler?', en: 'How does therapy go?' },
    a: {
      tr: [
        'İlk seanslarda sizi ve getirdiğiniz konuyu tanırım; birlikte neyi değiştirmek istediğinize, hedeflerinize bakarız.',
        'Sonrasında genellikle haftada bir, aynı gün ve saatte düzenli seanslarla devam ederiz. Sürecin ne kadar süreceği kişiye ve konuya göre değişir; belli aralıklarla nerede olduğumuzu birlikte değerlendiririz.',
      ],
      en: [
        'In the first sessions I get to know you and what brings you; together we look at what you would like to change and your goals.',
        'We then usually continue weekly, on the same day and time. How long it takes depends on the person and the issue; from time to time we review together where we are.',
      ],
    },
  },
  {
    id: 'sure',
    q: { tr: 'Seanslar ne kadar sürer, ne sıklıkla olur?', en: 'How long are sessions, and how often?' },
    a: {
      tr: ['Bireysel ve erişilebilir seanslar 50 dakika, çift terapisi 60 dakika sürer. Seanslar çoğunlukla haftada bir yapılır.'],
      en: ['Individual and accessible sessions last 50 minutes, couples therapy 60 minutes. Sessions are usually weekly.'],
    },
  },
  {
    id: 'online',
    q: { tr: 'Online görüşme nasıl yapılır?', en: 'How do online sessions work?' },
    a: {
      tr: ['Seanstan önce size güvenli bir görüntülü görüşme bağlantısı gönderirim. Sessiz ve kimsenin duyamayacağı bir ortam, kulaklık ve düzgün bir internet bağlantısı yeterlidir.'],
      en: ['Before the session I send you a secure video link. A quiet, private place, headphones and a steady internet connection are all you need.'],
    },
  },
  {
    id: 'gizlilik',
    q: { tr: 'Gizlilik nasıl korunur?', en: 'How is confidentiality kept?' },
    a: {
      tr: [
        'Seanslarda konuşulanlar meslek etiği ve gizlilik ilkeleri gereği aramızda kalır. Bu ilkenin yasal ve etik sınırları (örneğin sizin ya da bir başkasının ciddi bir tehlike altında olması) ilk seansta açıkça konuşulur.',
        'Kişisel verileriniz KVKK kapsamında, yalnızca gerektiği kadar ve güvenli biçimde saklanır.',
      ],
      en: [
        'What is said in sessions stays between us, as professional ethics and confidentiality require. The legal and ethical limits of this (for example when you or someone else is in serious danger) are discussed openly in the first session.',
        'Your personal data is kept securely and only as far as needed, under Turkish data protection law (KVKK).',
      ],
    },
  },
  {
    id: 'iptal',
    q: { tr: 'İptal ve erteleme kuralı nedir?', en: 'What is the cancellation rule?' },
    a: {
      tr: [
        'Seansınızdan 3 gün önce size bir hatırlatma e-postası gelir. Düzenli seanslarınız için size özel bir randevu sayfası olur; seansınızı oradan iptal edebilir ya da takvimdeki boş bir saate erteleyebilirsiniz.',
        'Seansa 24 saatten az kala yapılan iptal ve ertelemelerde seans ücretinin tamamı ödenir.',
      ],
      en: [
        'You get a reminder e-mail three days before your session. For regular sessions you have your own appointment page, where you can cancel a session or move it to a free time in the calendar.',
        'For a session cancelled or moved less than 24 hours before it starts, the full session fee is due.',
      ],
    },
  },
  {
    id: 'ucret',
    q: { tr: 'Seans ücreti ne kadar?', en: 'What is the fee?' },
    a: {
      tr: ['Ücret bilgisi randevunuz oluştuğunda size e-postayla iletilir. Önce tanışmak isterseniz ücretsiz ön görüşme planlayabilirsiniz.'],
      en: ['The fee is sent to you by e-mail once you have an appointment. If you would like to meet first, you can plan a free intro call.'],
    },
  },
  {
    id: 'onGorusme',
    q: { tr: 'Ücretsiz ön görüşme nedir?', en: 'What is the free intro call?' },
    a: {
      tr: ['25–30 dakikalık, online ve ücretsiz bir tanışma görüşmesidir. Neye ihtiyacınız olduğunu konuşur, birlikte çalışmanın size uygun olup olmadığına beraber karar veririz.'],
      en: ['A free 25–30 minute online call to get to know each other. We talk about what you need and decide together whether working together suits you.'],
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

/** The answer e-mail: only the chosen topics; links to meet and to book. Fixed text. */
export function infoMail(topics: string[], lang: 'tr' | 'en', links: { intro: string; book: string }): { subject: string; body: string } {
  const chosen = INFO_TOPICS.filter((t) => topics.includes(t.id));
  const blocks = chosen.flatMap((t) => [t.q[lang], ...t.a[lang], '']);
  if (lang === 'en') {
    return {
      subject: 'The information you asked for – klinikterapist.com',
      body: ['Hello,', '', 'Thank you for your interest. Here are the answers to what you asked:', '', ...blocks, `To meet first, plan a free intro call: ${links.intro}`, `To book a session: ${links.book}`, '', 'Osman Güneş Özkurt', 'Clinical Psychologist', 'klinikterapist.com'].join('\n'),
    };
  }
  return {
    subject: 'İstediğiniz bilgiler – klinikterapist.com',
    body: ['Merhaba,', '', 'İlginiz için teşekkür ederim. Sorduğunuz konuların yanıtlarını aşağıda bulabilirsiniz:', '', ...blocks, `Önce tanışmak isterseniz ücretsiz ön görüşme planlayabilirsiniz: ${links.intro}`, `Seans randevusu almak için: ${links.book}`, '', 'Osman Güneş Özkurt', 'Klinik Psikolog', 'klinikterapist.com'].join('\n'),
  };
}
