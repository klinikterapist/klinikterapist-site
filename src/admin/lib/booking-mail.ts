/**
 * The ready e-mails the owner sends from Talepler (owner's request 2026-10-20): personal, in the
 * language of the page the person used, with what they asked for. The panel shows them for editing
 * before they go; the backend sends exactly the edited text, to the address in the request only.
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
