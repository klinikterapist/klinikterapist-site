/**
 * Texts under the booking form (owner's requests 2026-10-19): one explanation per session type. Each
 * is a list of blocks: a paragraph, a small heading or a bullet list. The ids are anchors ("Ayrıntılar"
 * links in the session type list). The common questions about appointments moved to faq.json
 * (pages: booking) on 2026-10-21, so the owner edits them in the panel; textBlocks reads their answers.
 */
import type { Lang } from '../../lib/settings';

export type Block = string | { h: string } | { ul: string[] };
export type InfoItem = { id: string; icon: string; q: string; body: Block[] };

type Texts = { typesTitle: string; types: InfoItem[]; faqTitle: string };

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
      q: 'Aile ve çift terapisi seansı',
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
      q: 'Family and couples therapy session',
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
};

export const bookingInfo = (lang: Lang): Texts => (lang === 'en' ? EN : TR);

/** An answer written in the panel as blocks: blank lines part paragraphs, "- " lines make a list, "### " a heading. */
export function textBlocks(text: string): Block[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): Block => {
      const lines = part.split('\n').map((l) => l.trim());
      if (lines.every((l) => l.startsWith('- '))) return { ul: lines.map((l) => l.slice(2).trim()) };
      if (lines.length === 1 && lines[0].startsWith('### ')) return { h: lines[0].slice(4).trim() };
      return lines.join(' ');
    });
}
