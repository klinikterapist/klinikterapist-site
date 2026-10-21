/**
 * The ready e-mails the owner sends from Randevu talepleri and Seans takip (owner's requests
 * 2026-10-20): personal, in the language of the page the person used, with what they asked for. The
 * panel shows them for editing before they go; the backend sends exactly the edited text, to the
 * person's address only.
 */
import type { BookingRequest, RequestDecision } from '../api/types';
import { INTRO_FOR, INTRO_TOPICS, SESSION_TYPES, formatDay } from '../../lib/booking-form';
import { pathFor } from '../../i18n/routes';
import { paymentLines, ruleLine, type PaymentSettings } from '../../lib/payment';
import { withTexts } from '../../lib/mail-texts';

export const SITE = 'https://klinikterapist.com';
const SIGN_TR = ['Saygılarımla,', 'Osman Güneş Özkurt', 'Klinik Psikolog', 'klinikterapist.com'];
const SIGN_EN = ['Kind regards,', 'Osman Güneş Özkurt', 'Clinical Psychologist', 'klinikterapist.com'];

export type Mail = { subject: string; body: string };

/** Template ids of the e-mails made here (Ayarlar › E-posta Ayarları). */
export type PanelMailId =
  | 'talep.onay.seans'
  | 'talep.onay.ongorusme'
  | 'talep.uygun-degil'
  | 'talep.iptal'
  | 'danisan.tamamlandi'
  | 'danisan.sonlandirma'
  | 'danisan.geri-al'
  | 'danisan.sayfa'
  | 'bekleme.yer-acildi'
  | 'bekleme.alim-acik'
  | 'bekleme.cikarma';

/** "Bireysel terapi" / "ücretsiz ön görüşme", as it reads inside a sentence. */
export function what(r: BookingRequest, lang: 'tr' | 'en'): string {
  if (r.kind === 'intro') return lang === 'en' ? 'free intro call' : 'ücretsiz ön görüşme';
  const t = SESSION_TYPES.find((s) => s.id === r.type) ?? SESSION_TYPES[0];
  return lang === 'en' ? t.en.toLowerCase() : t.tr.toLocaleLowerCase('tr-TR');
}

/** `pay`: the owner's fee and payment settings; a session's approval tells the fee, how to pay and the rules (Faz 1). */
function builtDecisionMail(r: BookingRequest, decision: RequestDecision, pay?: PaymentSettings): Mail {
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
              ...(pay ? ['', ...paymentLines(pay, r.type ?? 'individual', 'en')] : []),
              '',
              ruleLine('en'),
              'Three days before the session I will send you a reminder.',
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
            ...(pay ? ['', ...paymentLines(pay, r.type ?? 'individual', 'tr')] : []),
            '',
            ruleLine('tr'),
            'Seansınızdan 3 gün önce size bir hatırlatma e-postası göndereceğim.',
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
function builtEndMail(c: Contact, mode: 'complete' | 'closing'): Mail {
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
function builtRevertMail(c: Contact): Mail {
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

/**
 * To someone on the "Haber et" list (owner's request 2026-10-20). `offer`: a time has freed up (a
 * given day and time, kept for them until they answer); `open`: booking is open again, choose a
 * time on the site; `remove`: no time is likely soon, so they come off the list and their details
 * are deleted, with a nudge not to put off getting support.
 */
function builtWaitlistMail(c: Contact, mode: 'offer' | 'open' | 'remove', when?: { day: string; time: string }): Mail {
  const name = c.name.trim();
  const book = `${SITE}${pathFor('appointment', c.lang)}`;
  const at = when ? `${formatDay(when.day, c.lang)}, ${c.lang === 'en' ? 'at ' : 'saat '}${when.time.replace(':', '.')}` : '';
  if (c.lang === 'en') {
    const hello = `Dear ${name},`;
    if (mode === 'offer') {
      return {
        subject: 'A time has freed up – klinikterapist.com',
        body: [
          hello,
          '',
          'You asked me to let you know when a time freed up — one has.',
          at ? `I can offer you ${at} (Turkey time). I am keeping it for you for now.` : 'I would be glad to find a time that suits you.',
          'If you would like it, please reply to this e-mail and I will confirm your appointment. If it does not suit you, let me know too, and I will keep you on the list.',
          '',
          ...SIGN_EN,
        ].join('\n'),
      };
    }
    if (mode === 'open') {
      return {
        subject: 'Booking is open again – klinikterapist.com',
        body: [hello, '', 'You asked me to let you know when I could take new clients again. Booking is open now.', `You can choose a time that suits you here: ${book}`, 'Times fill up fast, so I wanted you to hear first.', '', ...SIGN_EN].join('\n'),
      };
    }
    return {
      subject: 'About my waiting list – klinikterapist.com',
      body: [
        hello,
        '',
        'Thank you for waiting. Unfortunately I do not expect a time that suits you to free up soon, so I am taking you off my waiting list and deleting your details.',
        'Please do not put off seeking support because of this; I recommend reaching out to another professional.',
        `When booking opens again, you are welcome to request a time on my site: ${book}`,
        '',
        'I wish you all the best.',
        '',
        ...SIGN_EN,
      ].join('\n'),
    };
  }
  const hello = `Sayın ${name},`;
  if (mode === 'offer') {
    return {
      subject: 'Bir saat boşaldı – klinikterapist.com',
      body: [
        hello,
        '',
        'Boşalan bir saat olduğunda size haber vermemi istemiştiniz; bir yer açıldı.',
        at ? `Size ${at} saatini önerebilirim. Bu saati şimdilik sizin için ayırıyorum.` : 'Size uygun bir saat bulmaktan memnuniyet duyarım.',
        'Uygunsa bu e-postayı yanıtlamanız yeterli; randevunuzu onaylayıp size bildireceğim. Size uymuyorsa da haber verin, sizi listede tutmaya devam edeyim.',
        '',
        ...SIGN_TR,
      ].join('\n'),
    };
  }
  if (mode === 'open') {
    return {
      subject: 'Randevu alımı yeniden açıldı – klinikterapist.com',
      body: [hello, '', 'Yeni danışan alımına yeniden başladığımda size haber vermemi istemiştiniz. Randevu alımı şu an açık.', `Size uygun saati buradan seçebilirsiniz: ${book}`, 'Saatler çabuk dolduğu için ilk sizin haberiniz olsun istedim.', '', ...SIGN_TR].join('\n'),
    };
  }
  return {
    subject: 'Bekleme listem hakkında – klinikterapist.com',
    body: [
      hello,
      '',
      'Beklediğiniz için teşekkür ederim. Ne yazık ki yakın zamanda size uygun bir saatin açılacağını öngörmüyorum; bu nedenle kaydınızı bekleme listemden çıkarıyor, bilgilerinizi siliyorum.',
      'Destek arayışınızı bu yüzden ertelemenizi istemem; başka bir uzmana başvurmanızı öneririm.',
      `Randevu alımı yeniden açıldığında sitemden talepte bulunabilirsiniz: ${book}`,
      '',
      'Size iyi günler dilerim.',
      '',
      ...SIGN_TR,
    ].join('\n'),
  };
}

/**
 * The client's own page (owner's decisions 2026-10-20, review a5): the secret link, what the page
 * does, the full fee less than 24 hours before, and that the link is theirs alone.
 */
function builtLinkMail(c: Contact, link: string): Mail {
  const name = c.name.trim();
  if (c.lang === 'en') {
    return {
      subject: 'Your appointment page – klinikterapist.com',
      body: [
        `Dear ${name},`,
        '',
        'On this page you can see your upcoming sessions, your session details and your sessions so far:',
        link,
        '',
        'From there you can cancel a session or move it to a free time in the calendar. For a session cancelled or moved less than 24 hours before it starts, the full session fee is due; the page reminds you of this before you go on.',
        'You can also let me know there if you would like to end our work together.',
        '',
        'The link is yours alone; please do not share it. Your name does not appear on the page. If you think someone else has it, tell me and I will send you a new one.',
        '',
        ...SIGN_EN,
      ].join('\n'),
    };
  }
  return {
    subject: 'Randevu sayfanız – klinikterapist.com',
    body: [
      `Sayın ${name},`,
      '',
      'Sıradaki seanslarınızı, seans bilginizi ve seans grafiğinizi bu sayfadan görebilirsiniz:',
      link,
      '',
      'Buradan bir seansı iptal edebilir ya da takvimdeki boş bir saate erteleyebilirsiniz. Başlamasına 24 saatten az kala iptal edilen ya da ertelenen seanslarda seans ücretinin tamamı ödenir; sayfa devam etmeden önce bunu size hatırlatır.',
      'Terapiyi sonlandırmak isterseniz bunu da bu sayfadan bana iletebilirsiniz.',
      '',
      'Bağlantı yalnızca size özeldir; lütfen kimseyle paylaşmayın. Sayfada adınız görünmez. Bağlantının başkasının eline geçtiğini düşünürseniz bana yazın, size yenisini göndereyim.',
      '',
      ...SIGN_TR,
    ].join('\n'),
  };
}

/*
 * The e-mails as they go: the built-in text above, or the owner's own template (src/lib/mail-texts.ts)
 * filled with the same facts.
 */

/** The intro call's "you wrote that …" sentence, or ''. */
export function introNote(r: BookingRequest, lang: 'tr' | 'en'): string {
  const topics = (r.topics ?? []).map((i) => INTRO_TOPICS[lang][i]).filter(Boolean);
  const forWhom = INTRO_FOR.find((f) => f.id === r.forWhom);
  if (r.kind !== 'intro' || (!forWhom && !topics.length)) return '';
  if (lang === 'en') {
    return `In your request you wrote${forWhom ? ` that the call is ${forWhom.en.replace(/ \(.*\)$/, '').toLowerCase()}` : ''}${topics.length ? `${forWhom ? ' and' : ''} that you would like to talk about: ${topics.join(', ')}` : ''}. We will start from there.`;
  }
  return `Talebinizde${forWhom ? ` görüşmenin ${forWhom.tr.replace(/ \(.*\)$/, '').toLocaleLowerCase('tr-TR')} olduğunu` : ''}${topics.length ? `${forWhom ? ' ve' : ''} şu konuları konuşmak istediğinizi belirttiniz: ${topics.join(', ')}` : ''}. Görüşmeye buradan başlayacağız.`;
}

export function decisionMail(r: BookingRequest, decision: RequestDecision, pay?: PaymentSettings): Mail {
  const lang = r.lang;
  const id: PanelMailId = decision === 'approve' ? (r.kind === 'intro' ? 'talep.onay.ongorusme' : 'talep.onay.seans') : decision === 'unavailable' ? 'talep.uygun-degil' : 'talep.iptal';
  return withTexts(
    id,
    lang,
    {
      ad: r.name.trim(),
      zaman: `${formatDay(r.day, lang)}, ${lang === 'en' ? 'at ' : 'saat '}${r.time.replace(':', '.')}`,
      tur: what(r, lang),
      odeme: pay && r.kind !== 'intro' ? paymentLines(pay, r.type ?? 'individual', lang).join('\n') : '',
      kural: ruleLine(lang),
      baglanti: `${SITE}${pathFor(r.kind === 'intro' ? 'preConsult' : 'appointment', lang)}`,
      talep_notu: introNote(r, lang),
    },
    builtDecisionMail(r, decision, pay),
  );
}

export function endMail(c: Contact, mode: 'complete' | 'closing'): Mail {
  return withTexts(mode === 'complete' ? 'danisan.tamamlandi' : 'danisan.sonlandirma', c.lang, { ad: c.name.trim(), baglanti: `${SITE}${pathFor('appointment', c.lang)}` }, builtEndMail(c, mode));
}

export function revertMail(c: Contact): Mail {
  return withTexts('danisan.geri-al', c.lang, { ad: c.name.trim() }, builtRevertMail(c));
}

export function waitlistMail(c: Contact, mode: 'offer' | 'open' | 'remove', when?: { day: string; time: string }): Mail {
  const id: PanelMailId = mode === 'offer' ? 'bekleme.yer-acildi' : mode === 'open' ? 'bekleme.alim-acik' : 'bekleme.cikarma';
  const zaman = when ? `${formatDay(when.day, c.lang)}, ${c.lang === 'en' ? 'at ' : 'saat '}${when.time.replace(':', '.')}` : '';
  return withTexts(id, c.lang, { ad: c.name.trim(), zaman, baglanti: `${SITE}${pathFor('appointment', c.lang)}` }, builtWaitlistMail(c, mode, when));
}

export function linkMail(c: Contact, link: string): Mail {
  return withTexts('danisan.sayfa', c.lang, { ad: c.name.trim(), baglanti: link }, builtLinkMail(c, link));
}
