/**
 * Texts under the booking form (owner's requests 2026-10-19): one explanation per session type, then
 * the common questions about appointments. Each answer is a list of blocks: a paragraph, a small
 * heading or a bullet list. The ids are anchors ("Ayrıntılar" links in the session type list).
 */
import type { Lang } from '../../lib/settings';

export type Block = string | { h: string } | { ul: string[] };
export type InfoItem = { id: string; icon: string; q: string; body: Block[] };

type Texts = { typesTitle: string; types: InfoItem[]; faqTitle: string; faq: InfoItem[] };

const TR: Texts = {
  typesTitle: 'Görüşme türleri',
  types: [
    {
      id: 'bireysel-terapi',
      icon: 'user',
      q: 'Bireysel terapi seansı',
      body: [
        'Bireysel terapi, sizinle birebir yürüttüğümüz düzenli görüşmelerdir. Kaygı, mutsuzluk, ilişkilerde zorlanma, özgüven, yas ya da kendinizi daha iyi tanıma isteği gibi, sizi getiren konu üzerinde birlikte çalışırız.',
        'Seanslar online yapılır ve 50 dakika sürer. Çalışmalarımda Bilişsel Davranışçı Terapi gibi bilimsel temelli yaklaşımları, sizin ihtiyaçlarınıza göre uyarlayarak kullanırım.',
        { h: 'Süreç nasıl ilerler?' },
        {
          ul: [
            'İlk seanslarda sizi ve yaşadıklarınızı tanır, birlikte hedefler belirleriz.',
            'Seanslar genellikle haftada bir yapılır; sıklığı ihtiyacınıza göre birlikte ayarlarız.',
            'Süreç boyunca nereye geldiğimizi düzenli olarak birlikte değerlendiririz.',
          ],
        },
      ],
    },
    {
      id: 'cift-terapisi',
      icon: 'users',
      q: 'Çift terapisi seansı',
      body: [
        'Çift terapisi, partnerlerin birlikte katıldığı görüşmelerdir. Burada odak tek bir kişi değil, ilişkinin kendisidir: iletişim, tekrar eden tartışmalar, güven, yakınlık ve birlikte alınması gereken kararlar.',
        'Seanslar online yapılır ve 60 dakika sürer; iki partnerin de görüşmeye katılması gerekir. Her iki tarafın da kendini güvende hissettiği, yargılanmadan dinlendiği bir alan kurmaya özen gösteririm.',
        { h: 'Kimler için uygun?' },
        {
          ul: [
            'İletişim kurmakta ya da anlaşmazlıkları çözmekte zorlanan çiftler.',
            'Güveni sarsan bir olayın ardından ilişkiyi yeniden kurmak isteyenler.',
            'Evlilik, birlikte yaşama, ebeveynlik gibi büyük kararların eşiğindeki çiftler.',
          ],
        },
        'Çift terapisine iki partnerin de gönüllü olarak katılması önemlidir. Ön görüşmede bunu da birlikte konuşabiliriz.',
      ],
    },
    {
      id: 'grup-terapisi',
      icon: 'chat',
      q: 'Grup terapisi seansı (yakında)',
      body: [
        'Grup terapisi, benzer konularla gelen küçük bir grubun bir terapist eşliğinde düzenli olarak bir araya geldiği görüşmelerdir. Başkalarının deneyimlerini duymak, yalnız olmadığınızı görmek ve yeni bakış açıları kazanmak bu çalışmanın en güçlü yanlarıdır.',
        'Grup terapisi henüz başlamadı. Açıldığında bu sayfada duyuracağım; ilgileniyorsanız ön görüşmede bunu belirtebilirsiniz.',
      ],
    },
    {
      id: 'yuz-yuze-terapi',
      icon: 'home',
      q: 'Yüz yüze terapi (şu an uygun değil)',
      body: [
        'Şu an yalnızca online görüşme yapıyorum, bu yüzden yüz yüze seans seçeneği kapalı. Online terapi, pek çok konuda yüz yüze terapi kadar etkili bir yol olarak kullanılıyor ve size yolculuk zamanı kazandırıyor.',
        'Yüz yüze görüşmeler başladığında bu sayfada duyuracağım.',
      ],
    },
    {
      id: 'erisilebilir-terapi',
      icon: 'heart',
      q: 'Erişilebilir terapi seansı nedir, kimler yararlanabilir?',
      body: [
        'Psikolojik desteğin yalnızca ödeme gücü olanlara açık olmaması gerektiğine inanıyorum. Erişilebilir terapi seansı, bu yüzden oluşturduğum uygun ücretli bir bireysel terapi seçeneğidir.',
        'Seanslar bireysel ve online yapılır, 50 dakika sürer. Özen, yöntem ve gizlilik açısından diğer seanslardan hiçbir farkı yoktur; değişen yalnızca ücrettir.',
        { h: 'Kimler yararlanabilir?' },
        {
          ul: [
            'Ekonomik durumu, terapinin düzenli ücretini karşılamaya elverişli olmayan kişiler.',
            'Terapi süreci devam ederken iş kaybı gibi nedenlerle ekonomik zorluk yaşamaya başlayan danışanlar. Amaç, başlamış bir sürecin maddi nedenlerle yarıda kalmamasıdır.',
            'Üniversite öğrencileri.',
          ],
        },
        { h: 'Kontenjan nasıl belirlenir?' },
        'Bu seanslar için ayırdığım yer sınırlıdır. Kontenjanı ve bu seçenekten kimlerin yararlanacağını, başvuruları değerlendirerek ben belirlerim. Kontenjan dolu olduğunda sizi bekleme listesine alabilir ya da uygun kurum ve kaynaklara yönlendirebilirim.',
        { h: 'Nasıl başvurulur?' },
        'Randevu formunda "Erişilebilir Terapi Seansı" seçeneğini işaretlemeniz yeterli. Ücret ve ayrıntıları e-postayla iletirim. Bu konuyu konuşmak sizi zorlamasın; durumunuzu paylaşmanız, size en uygun yolu birlikte bulmamızı sağlar.',
      ],
    },
  ],
  faqTitle: 'Randevuyla ilgili sık sorulan sorular',
  faq: [
    {
      id: 'ilk-kez',
      icon: 'help',
      q: 'İlk kez geliyorum, nereden başlamalıyım?',
      body: [
        'İlk kez başvuruyorsanız önce ücretsiz ön görüşme talep etmenizi öneririm. 25–30 dakikalık bu görüşmede tanışır, size en uygun görüşme türüne ve bir sonraki adıma birlikte karar veririz.',
      ],
    },
    {
      id: 'siklik',
      icon: 'calendar',
      q: 'Seanslar ne sıklıkla yapılır, terapi ne kadar sürer?',
      body: [
        'Seanslar çoğunlukla haftada bir yapılır. Terapinin toplam süresi kişiden kişiye değişir: bazı konular birkaç ayda ele alınabilirken, bazıları daha uzun bir çalışma gerektirebilir. Süreci düzenli olarak birlikte değerlendirir, ilerleyişe göre sıklığı ve süreyi birlikte belirleriz.',
      ],
    },
    {
      id: 'ucret',
      icon: 'tag',
      q: 'Ücretler nedir?',
      body: [
        'Seans ücretlerini ve ödeme ayrıntılarını randevu talebinizin ardından e-postayla iletirim. Ekonomik durumunuz düzenli ücreti karşılamaya elverişli değilse ya da üniversite öğrencisiyseniz, Erişilebilir Terapi Seansı seçeneğine göz atabilirsiniz.',
      ],
    },
    {
      id: 'iptal',
      icon: 'clock',
      q: 'Randevumu nasıl iptal eder ya da değiştiririm?',
      body: [
        'Seansınızdan 3 gün önce size bir hatırlatma e-postası gelir. Düzenli seanslarınız için size özel bir randevu sayfası bağlantısı gönderilir; seansınızı oradan iptal edebilir ya da takvimdeki boş bir saate erteleyebilirsiniz. Dilerseniz e-postayla da haber verebilirsiniz.',
        'Seansa 24 saatten az kala yapılan iptal ve ertelemelerde seans ücretinin tamamı ödenir.',
      ],
    },
    {
      id: 'online',
      icon: 'laptop',
      q: 'Online görüşme için neye ihtiyacım var?',
      body: [
        {
          ul: [
            'Rahatça konuşabileceğiniz, sessiz ve kimsenin sizi duymayacağı bir ortam.',
            'İnternete bağlı, kameralı bir telefon, tablet ya da bilgisayar.',
            'Kulaklık (zorunlu değil ama önerilir).',
          ],
        },
        'Görüşme bağlantısını randevudan önce e-postayla gönderirim.',
      ],
    },
    {
      id: 'gizlilik',
      icon: 'shield',
      q: 'Konuştuklarımız gizli kalır mı?',
      body: [
        'Evet. Görüşmelerde paylaştıklarınız mesleki etik ilkeler çerçevesinde gizli tutulur ve izniniz olmadan kimseyle paylaşılmaz.',
        'Bu gizliliğin yasa ve etik kurallarla belirlenen sınırlı istisnaları vardır; örneğin sizin ya da bir başkasının hayatının ciddi tehlikede olduğu durumlar. Bu sınırları ilk görüşmede açıkça konuşuruz.',
      ],
    },
  ],
};

const EN: Texts = {
  typesTitle: 'Session types',
  types: [
    {
      id: 'bireysel-terapi',
      icon: 'user',
      q: 'Individual therapy session',
      body: [
        'Individual therapy means regular one-to-one sessions. We work together on what brings you here, such as anxiety, low mood, relationship difficulties, self-esteem, grief or the wish to know yourself better.',
        'Sessions are online and last 50 minutes. I use evidence-based approaches such as Cognitive Behavioral Therapy, adapted to your needs.',
        { h: 'How does it go?' },
        {
          ul: [
            'In the first sessions we get to know you and what you are going through, and set goals together.',
            'Sessions are usually weekly; we adjust the frequency to your needs together.',
            'We regularly review together where we have got to.',
          ],
        },
      ],
    },
    {
      id: 'cift-terapisi',
      icon: 'users',
      q: 'Couple therapy session',
      body: [
        'Couple therapy means sessions both partners attend together. The focus is not one person but the relationship itself: communication, recurring arguments, trust, closeness and decisions you need to make together.',
        'Sessions are online and last 60 minutes; both partners need to attend. I take care to build a space where both of you feel safe and heard without judgement.',
        { h: 'Who is it for?' },
        {
          ul: [
            'Couples who find it hard to communicate or to resolve disagreements.',
            'Partners who want to rebuild the relationship after something that shook their trust.',
            'Couples facing big decisions such as marriage, moving in together or parenthood.',
          ],
        },
        'It matters that both partners take part willingly. We can talk about this in the intro call too.',
      ],
    },
    {
      id: 'grup-terapisi',
      icon: 'chat',
      q: 'Group therapy session (coming soon)',
      body: [
        'In group therapy, a small group with similar concerns meets regularly with a therapist. Hearing others’ experiences, seeing you are not alone and gaining new perspectives are the strengths of this work.',
        'Group therapy has not started yet. I will announce it on this page; if you are interested, you can mention it in the intro call.',
      ],
    },
    {
      id: 'yuz-yuze-terapi',
      icon: 'home',
      q: 'Face-to-face therapy (not available now)',
      body: [
        'For now I only work online, so face-to-face sessions are closed. Online therapy is used as an effective way of working for many concerns and saves you travel time.',
        'I will announce face-to-face sessions on this page when they start.',
      ],
    },
    {
      id: 'erisilebilir-terapi',
      icon: 'heart',
      q: 'What is an accessible therapy session, and who can use it?',
      body: [
        'I believe psychological support should not be open only to those who can afford it. The accessible therapy session is a lower-fee individual therapy option I created for that reason.',
        'Sessions are individual and online and last 50 minutes. In care, method and confidentiality they are no different from other sessions; only the fee changes.',
        { h: 'Who can use it?' },
        {
          ul: [
            'People whose finances do not allow the regular therapy fee.',
            'Clients who face financial difficulty during therapy, for example after losing their job. The aim is that a process already under way does not stop for financial reasons.',
            'University students.',
          ],
        },
        { h: 'How are places decided?' },
        'The number of places I set aside for these sessions is limited. I decide the number of places and who can use this option after reviewing the requests. When places are full, I may add you to a waiting list or refer you to suitable services and resources.',
        { h: 'How do I ask for it?' },
        'Just choose "Accessible Therapy Session" in the booking form. I send the fee and details by e-mail. Please do not let this conversation hold you back; sharing your situation helps us find the best way forward together.',
      ],
    },
  ],
  faqTitle: 'Common questions about appointments',
  faq: [
    {
      id: 'ilk-kez',
      icon: 'help',
      q: 'It is my first time. Where should I start?',
      body: [
        'If this is your first time, I recommend asking for a free intro call first. In these 25–30 minutes we get to know each other and decide together on the session type and next step that suit you.',
      ],
    },
    {
      id: 'siklik',
      icon: 'calendar',
      q: 'How often are sessions, and how long does therapy last?',
      body: [
        'Sessions are usually weekly. How long therapy lasts differs from person to person: some concerns can be addressed in a few months, others need longer work. We review the process together regularly and decide on frequency and length as we go.',
      ],
    },
    {
      id: 'ucret',
      icon: 'tag',
      q: 'What are the fees?',
      body: [
        'I send session fees and payment details by e-mail after your booking request. If your finances do not allow the regular fee, or you are a university student, have a look at the Accessible Therapy Session.',
      ],
    },
    {
      id: 'iptal',
      icon: 'clock',
      q: 'How do I cancel or change my appointment?',
      body: [
        'You get a reminder e-mail three days before your session. For regular sessions you receive a link to your own appointment page, where you can cancel a session or move it to a free time in the calendar. You can also let me know by e-mail.',
        'For a session cancelled or moved less than 24 hours before it starts, the full session fee is due.',
      ],
    },
    {
      id: 'online',
      icon: 'laptop',
      q: 'What do I need for an online session?',
      body: [
        {
          ul: [
            'A quiet, private place where you can talk freely.',
            'A phone, tablet or computer with a camera and internet.',
            'Headphones (not required, but recommended).',
          ],
        },
        'I send the session link by e-mail before the appointment.',
      ],
    },
    {
      id: 'gizlilik',
      icon: 'shield',
      q: 'Will what we talk about stay confidential?',
      body: [
        'Yes. What you share in sessions is kept confidential under professional ethics and is not shared with anyone without your consent.',
        'This confidentiality has narrow exceptions set by law and ethics rules, for example when your life or someone else’s is in serious danger. We talk about these limits openly in the first session.',
      ],
    },
  ],
};

export const bookingInfo = (lang: Lang): Texts => (lang === 'en' ? EN : TR);
