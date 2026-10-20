/**
 * The ready e-mails the owner sends from Randevu talepleri and Seans takip (owner's requests
 * 2026-10-20): personal, in the language of the page the person used, with what they asked for. The
 * panel shows them for editing before they go; the backend sends exactly the edited text, to the
 * person's address only.
 */
import type { BookingRequest, RequestDecision } from '../api/types';
import { INTRO_FOR, INTRO_TOPICS, SESSION_TYPES, formatDay } from '../../lib/booking-form';
import { pathFor } from '../../i18n/routes';

const SITE = 'https://klinikterapist.com';
const SIGN_TR = ['Saygılarımla,', 'Osman Güneş Özkurt', 'Klinik Psikolog', 'klinikterapist.com'];
const SIGN_EN = ['Kind regards,', 'Osman Güneş Özkurt', 'Clinical Psychologist', 'klinikterapist.com'];

export type Mail = { subject: string; body: string };

/** "Bireysel terapi" / "ücretsiz ön görüşme", as it reads inside a sentence. */
function what(r: BookingRequest, lang: 'tr' | 'en'): string {
  if (r.kind === 'intro') return lang === 'en' ? 'free intro call' : 'ücretsiz ön görüşme';
  const t = SESSION_TYPES.find((s) => s.id === r.type) ?? SESSION_TYPES[0];
  return lang === 'en' ? t.en.toLowerCase() : t.tr.toLocaleLowerCase('tr-TR');
}

export function decisionMail(r: BookingRequest, decision: RequestDecision): Mail {
  const lang = r.lang;
  const when = `${formatDay(r.day, lang)}, ${lang === 'en' ? 'at ' : 'saat '}${r.time.replace(':', '.')}`;
  const again = `${SITE}${pathFor(r.kind === 'intro' ? 'preConsult' : 'appointment', lang)}`;
  const name = r.name.trim();
  const topics = (r.topics ?? []).map((i) => INTRO_TOPICS[lang][i]).filter(Boolean);
  const forWhom = INTRO_FOR.find((f) => f.id === r.forWhom);

  if (lang === 'en') {
    const hello = `Dear ${name},`;
    if (decision === 'approve') {
      const lines =
        r.kind === 'intro'
          ? [
              `Your request for a free intro call on ${when} (Turkey time) is confirmed.`,
              ...(forWhom || topics.length
                ? [`In your request you wrote${forWhom ? ` that the call is ${forWhom.en.replace(/ \(.*\)$/, '').toLowerCase()}` : ''}${topics.length ? `${forWhom ? ' and' : ''} that you would like to talk about: ${topics.join(', ')}` : ''}. We will start from there.`]
                : []),
              'The call takes 25–30 minutes and is held online. I will send you the link by e-mail before the call.',
            ]
          : [
              `Your ${what(r, 'en')} appointment on ${when} (Turkey time) is confirmed.`,
              'The session is held online. I will send you the link by e-mail before the session.',
              'If you need to change or cancel it, please let me know at least 24 hours before by replying to this e-mail.',
            ];
      return { subject: r.kind === 'intro' ? 'Your intro call is confirmed – klinikterapist.com' : 'Your appointment is confirmed – klinikterapist.com', body: [hello, '', ...lines, '', ...SIGN_EN].join('\n') };
    }
    if (decision === 'unavailable') {
      return {
        subject: 'About your request – klinikterapist.com',
        body: [hello, '', `Thank you for your ${what(r, 'en')} request for ${when}. Unfortunately I am not available at that time.`, `You can choose another time that suits you in the calendar on my site: ${again}`, '', ...SIGN_EN].join('\n'),
      };
    }
    return {
      subject: 'Your request has been cancelled – klinikterapist.com',
      body: [hello, '', `Your ${what(r, 'en')} request for ${when} has been cancelled.`, `If you would like to book again, you can do so here: ${again}`, '', ...SIGN_EN].join('\n'),
    };
  }

  const hello = `Sayın ${name},`;
  if (decision === 'approve') {
    const lines =
      r.kind === 'intro'
        ? [
            `${when} için ücretsiz ön görüşme talebiniz onaylanmıştır.`,
            ...(forWhom || topics.length
              ? [`Talebinizde${forWhom ? ` görüşmenin ${forWhom.tr.replace(/ \(.*\)$/, '').toLocaleLowerCase('tr-TR')} olduğunu` : ''}${topics.length ? `${forWhom ? ' ve' : ''} şu konuları konuşmak istediğinizi belirttiniz: ${topics.join(', ')}` : ''}. Görüşmeye buradan başlayacağız.`]
              : []),
            'Görüşme 25–30 dakika sürecek ve online yapılacak. Görüşme bağlantısını görüşmeden önce e-postayla göndereceğim.',
          ]
        : [
            `${when} için ${what(r, 'tr')} randevu talebiniz onaylanmıştır.`,
            'Seans online yapılacak. Görüşme bağlantısını seanstan önce e-postayla göndereceğim.',
            'Randevunuzu değiştirmeniz ya da iptal etmeniz gerekirse lütfen en az 24 saat önce bu e-postayı yanıtlayarak haber verin.',
          ];
    return { subject: r.kind === 'intro' ? 'Ön görüşmeniz onaylandı – klinikterapist.com' : 'Randevunuz onaylandı – klinikterapist.com', body: [hello, '', ...lines, '', 'Görüşmek üzere,', ...SIGN_TR.slice(1)].join('\n') };
  }
  if (decision === 'unavailable') {
    return {
      subject: 'Talebiniz hakkında – klinikterapist.com',
      body: [hello, '', `${when} için gönderdiğiniz ${what(r, 'tr')} talebiniz için teşekkür ederim. Ne yazık ki bu saatte uygun değilim.`, `Size uygun başka bir saati sitemdeki takvimden seçebilirsiniz: ${again}`, '', ...SIGN_TR].join('\n'),
    };
  }
  return {
    subject: 'Talebiniz iptal edildi – klinikterapist.com',
    body: [hello, '', `${when} için gönderdiğiniz ${what(r, 'tr')} talebiniz iptal edilmiştir.`, `Yeniden randevu almak isterseniz buradan ulaşabilirsiniz: ${again}`, '', ...SIGN_TR].join('\n'),
  };
}

type Contact = { name: string; lang: 'tr' | 'en' };

/**
 * Terapiyi sonlandır (owner's request 2026-10-20). `complete`: therapy is over and the process has
 * ended. `closing`: an invitation to a free 25–30 minute closing session, why it matters and what
 * it covers.
 */
export function endMail(c: Contact, mode: 'complete' | 'closing'): Mail {
  const name = c.name.trim();
  const again = `${SITE}${pathFor('appointment', c.lang)}`;
  if (c.lang === 'en') {
    const hello = `Dear ${name},`;
    if (mode === 'complete') {
      return {
        subject: 'The end of our therapy – klinikterapist.com',
        body: [
          hello,
          '',
          'With this e-mail I would like to let you know that our therapy process has come to an end. Your weekly session has been removed from my calendar and your appointment details have been deleted from my booking system.',
          'Thank you for the effort you put into this process and for everything you shared with me.',
          `Should you need support again in the future, you are always welcome to request an appointment on my site: ${again}`,
          '',
          'I wish you all the best.',
          '',
          ...SIGN_EN,
        ].join('\n'),
      };
    }
    return {
      subject: 'A closing session for our therapy – klinikterapist.com',
      body: [
        hello,
        '',
        'We are coming to the end of our therapy. So that we can bring the process to a good close, I would like to offer you a free closing session of 25–30 minutes.',
        'The closing session is an important part of therapy. In it we will:',
        '– look back together at the goals we set at the start and the changes you have made along the way,',
        '– talk about what worked for you and how you can keep using it in everyday life,',
        '– go over situations that may be hard in the future and what you can do at such times,',
        '– make room for your feelings and thoughts about the process and any questions you may have.',
        'The session is held online and there is no fee. Please reply to this e-mail with the days and times that suit you, and we will plan it together.',
        '',
        ...SIGN_EN,
      ].join('\n'),
    };
  }
  const hello = `Sayın ${name},`;
  if (mode === 'complete') {
    return {
      subject: 'Terapi sürecimizin sonlanması – klinikterapist.com',
      body: [
        hello,
        '',
        'Birlikte yürüttüğümüz terapi sürecinin sona erdiğini bu e-postayla bildirmek isterim. Haftalık seans saatiniz takvimimden kaldırılmış, randevu bilgileriniz randevu sistemimden silinmiştir.',
        'Bu süreçte gösterdiğiniz emek ve benimle paylaştıklarınız için teşekkür ederim.',
        `İleride yeniden desteğe ihtiyaç duyarsanız sitemden her zaman randevu talebinde bulunabilirsiniz: ${again}`,
        '',
        'Size sağlıklı ve güzel günler dilerim.',
        '',
        ...SIGN_TR,
      ].join('\n'),
    };
  }
  return {
    subject: 'Sonlandırma görüşmesi – klinikterapist.com',
    body: [
      hello,
      '',
      'Terapi sürecimizin sonuna yaklaşıyoruz. Süreci sağlıklı bir şekilde tamamlayabilmek için sizinle ücretsiz, 25–30 dakikalık bir sonlandırma görüşmesi yapmak istiyorum.',
      'Sonlandırma görüşmesi terapinin önemli bir parçasıdır. Bu görüşmede:',
      '– terapiye başlarken belirlediğimiz hedeflere ve bu süreçte yaşadığınız değişimlere birlikte bakacağız,',
      '– sizin için nelerin işe yaradığını ve bunları gündelik hayatta nasıl sürdürebileceğinizi konuşacağız,',
      '– ileride zorlanabileceğiniz durumları ve böyle anlarda neler yapabileceğinizi ele alacağız,',
      '– süreçle ilgili duygularınızı, düşüncelerinizi ve varsa sorularınızı paylaşmanız için alan açacağız.',
      'Görüşme online yapılacak ve ücret alınmayacak. Size uygun gün ve saatleri bu e-postayı yanıtlayarak iletirseniz görüşmeyi birlikte planlayalım.',
      '',
      ...SIGN_TR,
    ].join('\n'),
  };
}

/**
 * Geri al (owner's request 2026-10-20): an approval or a move sent by mistake. The apology says a
 * technical problem caused it and that a corrected answer follows in the next e-mail.
 */
export function revertMail(c: Contact): Mail {
  const name = c.name.trim();
  if (c.lang === 'en') {
    return {
      subject: 'Correction to my previous e-mail – klinikterapist.com',
      body: [
        `Dear ${name},`,
        '',
        'The previous e-mail I sent you about your request was sent by mistake because of a technical problem. Please disregard it; I apologise for any confusion it may have caused.',
        'Your request is still with me. I will review it again and send you the correct answer in my next e-mail as soon as possible.',
        '',
        ...SIGN_EN,
      ].join('\n'),
    };
  }
  return {
    subject: 'Önceki e-postamla ilgili düzeltme – klinikterapist.com',
    body: [
      `Sayın ${name},`,
      '',
      'Talebinizle ilgili size gönderdiğim önceki e-posta, teknik bir sorun nedeniyle yanlışlıkla gönderilmiştir. Lütfen o e-postayı dikkate almayın; yol açtığı karışıklık için özür dilerim.',
      'Talebiniz bende duruyor. Yeniden değerlendirip doğru yanıtı bir sonraki e-postamda en kısa sürede size ileteceğim.',
      '',
      ...SIGN_TR,
    ].join('\n'),
  };
}
