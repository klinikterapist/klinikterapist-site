/**
 * The ready e-mails the owner sends from Randevu talepleri and Seans takip (owner's requests
 * 2026-10-20): personal, in the language of the page the person used, with what they asked for. The
 * panel shows them for editing before they go; the backend sends exactly the edited text, to the
 * person's address only. Turkish: src/lib/mail-templates-tr.ts (owner's texts of 2026-10-22).
 */
import type { BookingRequest, RequestDecision } from '../api/types';
import { INTRO_FOR, INTRO_TOPICS, SESSION_TYPES, formatDay } from '../../lib/booking-form';
import { pathFor } from '../../i18n/routes';
import { EMPTY_PAYMENT, payVars, paymentLines, ruleLine, type PaymentSettings } from '../../lib/payment';
import { mailTr, withTexts } from '../../lib/mail-texts';
import { LINKS_TR, RULE_TR, forWhom, topicList, typeVars, whenVars } from '../../lib/mail-vars';

export const SITE = 'https://klinikterapist.com';
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

/** Who the intro call is for, as the owner says it back to the person (the form's own options are in the first person). */
const FOR_YOU_EN: Record<(typeof INTRO_FOR)[number]['id'], string> = {
  individual: 'for yourself',
  couple: 'with your partner',
  accessible: 'for yourself, at a reduced fee',
};

/** "individual therapy" / "free intro call", as it reads inside an English sentence. */
export function what(r: BookingRequest, lang: 'tr' | 'en'): string {
  if (r.kind === 'intro') return lang === 'en' ? 'free intro call' : 'ücretsiz ön görüşme';
  const t = SESSION_TYPES.find((s) => s.id === r.type) ?? SESSION_TYPES[0];
  return lang === 'en' ? t.en.toLowerCase() : t.tr.toLocaleLowerCase('tr-TR');
}

/** `pay`: the owner's fee and payment settings; a session's approval tells the fee, how to pay and the rules (Faz 1). */
function builtDecisionMailEn(r: BookingRequest, decision: RequestDecision, pay?: PaymentSettings): Mail {
  const when = `${formatDay(r.day, 'en')}, at ${r.time.replace(':', '.')}`;
  const again = `${SITE}${pathFor(r.kind === 'intro' ? 'preConsult' : 'appointment', 'en')}`;
  const hello = `Dear ${r.name.trim()},`;
  if (decision === 'approve') {
    const lines =
      r.kind === 'intro'
        ? [`Your request for a free intro call on ${when} (Turkey time) is confirmed.`, ...(introNote(r, 'en') ? [introNote(r, 'en')] : []), 'The call takes 25–30 minutes and is held online. I will send you the link by e-mail before the call.']
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

type Contact = { name: string; lang: 'tr' | 'en' };

/**
 * Terapiyi sonlandır (owner's request 2026-10-20). `complete`: therapy is over and the process has
 * ended. `closing`: an invitation to a free 25–30 minute closing session, why it matters and what
 * it covers.
 */
function builtEndMailEn(c: Contact, mode: 'complete' | 'closing'): Mail {
  const hello = `Dear ${c.name.trim()},`;
  if (mode === 'complete') {
    return {
      subject: 'The end of our therapy – klinikterapist.com',
      body: [
        hello,
        '',
        'With this e-mail I would like to let you know that our therapy process has come to an end. Your weekly session has been removed from my calendar and your appointment details have been deleted from my booking system.',
        'Thank you for the effort you put into this process and for everything you shared with me.',
        `Should you need support again in the future, you are always welcome to request an appointment on my site: ${SITE}${pathFor('appointment', 'en')}`,
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

/**
 * Geri al (owner's request 2026-10-20): an approval sent by mistake. The apology says a technical
 * problem caused it and that a corrected answer follows in the next e-mail.
 */
function builtRevertMailEn(c: Contact): Mail {
  return {
    subject: 'Correction to my previous e-mail – klinikterapist.com',
    body: [
      `Dear ${c.name.trim()},`,
      '',
      'The previous e-mail I sent you about your request was sent by mistake because of a technical problem. Please disregard it; I apologise for any confusion it may have caused.',
      'Your request is still with me. I will review it again and send you the correct answer in my next e-mail as soon as possible.',
      '',
      ...SIGN_EN,
    ].join('\n'),
  };
}

/**
 * To someone on the "Haber et" list (owner's request 2026-10-20). `offer`: a time has freed up (a
 * given day and time, kept for them until they answer); `open`: booking is open again, choose a
 * time on the site; `remove`: no time is likely soon, so they come off the list, with a nudge not to
 * put off getting support.
 */
function builtWaitlistMailEn(c: Contact, mode: 'offer' | 'open' | 'remove', when?: { day: string; time: string }): Mail {
  const hello = `Dear ${c.name.trim()},`;
  const book = `${SITE}${pathFor('appointment', 'en')}`;
  const at = when ? `${formatDay(when.day, 'en')}, at ${when.time.replace(':', '.')}` : '';
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

/**
 * The client's own page (owner's decisions 2026-10-20, review a5): the secret link, what the page
 * does, the full fee less than 24 hours before, and that the link is theirs alone.
 */
function builtLinkMailEn(c: Contact, link: string): Mail {
  return {
    subject: 'Your appointment page – klinikterapist.com',
    body: [
      `Dear ${c.name.trim()},`,
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

/*
 * The e-mails as they go: the built-in text, or the owner's own template (src/lib/mail-texts.ts)
 * filled with the same facts.
 */

/** The intro call's "you wrote that …" sentence (English), or ''. */
export function introNote(r: BookingRequest, lang: 'tr' | 'en'): string {
  const topics = (r.topics ?? []).map((i) => INTRO_TOPICS[lang][i]).filter(Boolean);
  const f = INTRO_FOR.find((x) => x.id === r.forWhom);
  if (r.kind !== 'intro' || (!f && !topics.length)) return '';
  if (lang === 'en') {
    return `In your request you wrote${f ? ` that the call is ${FOR_YOU_EN[f.id]}` : ''}${topics.length ? `${f ? ' and' : ''} that you would like to talk about: ${topics.join(', ')}` : ''}. We will start from there.`;
  }
  return `Talebinizde${f ? ` görüşmenin ${forWhom(f.id, 'you')} olduğunu` : ''}${topics.length ? `${f ? ' ve' : ''} şu konuları konuşmak istediğinizi belirttiniz: ${topics.join(', ')}` : ''}.`;
}

const decisionId = (r: BookingRequest, decision: RequestDecision): PanelMailId =>
  decision === 'approve' ? (r.kind === 'intro' ? 'talep.onay.ongorusme' : 'talep.onay.seans') : decision === 'unavailable' ? 'talep.uygun-degil' : 'talep.iptal';

/** The Turkish values of a decision e-mail. "#basvuru": the intro call's "Başvurunuz hakkında" part (who it is for and the topics). */
export function decisionVarsTr(r: BookingRequest, pay?: PaymentSettings): Record<string, string> {
  const intro = r.kind === 'intro';
  const kimin = forWhom(r.forWhom, 'you');
  const konular = topicList(r.topics);
  return {
    ad: r.name.trim(),
    ...whenVars(r.day, r.time),
    ...typeVars(r.type, intro),
    ...payVars(pay ?? EMPTY_PAYMENT, r.type, !!pay?.qr),
    ...LINKS_TR,
    randevu_baglantisi: intro ? LINKS_TR.on_gorusme_baglantisi : LINKS_TR.randevu_baglantisi,
    kimin_icin: kimin,
    konular,
    '#basvuru': kimin && konular ? '1' : '',
  };
}

export function decisionMail(r: BookingRequest, decision: RequestDecision, pay?: PaymentSettings): Mail {
  const id = decisionId(r, decision);
  if (r.lang === 'tr') return mailTr(id, decisionVarsTr(r, pay));
  return withTexts(
    id,
    'en',
    {
      ad: r.name.trim(),
      zaman: `${formatDay(r.day, 'en')}, at ${r.time.replace(':', '.')}`,
      tur: what(r, 'en'),
      odeme: pay && r.kind !== 'intro' ? paymentLines(pay, r.type ?? 'individual', 'en').join('\n') : '',
      kural: ruleLine('en'),
      baglanti: `${SITE}${pathFor(r.kind === 'intro' ? 'preConsult' : 'appointment', 'en')}`,
      talep_notu: introNote(r, 'en'),
    },
    builtDecisionMailEn(r, decision, pay),
  );
}

export function endMail(c: Contact, mode: 'complete' | 'closing'): Mail {
  const id = mode === 'complete' ? 'danisan.tamamlandi' : 'danisan.sonlandirma';
  if (c.lang === 'tr') return mailTr(id, { ad: c.name.trim(), ...LINKS_TR });
  return withTexts(id, 'en', { ad: c.name.trim(), baglanti: `${SITE}${pathFor('appointment', 'en')}` }, builtEndMailEn(c, mode));
}

export function revertMail(c: Contact): Mail {
  if (c.lang === 'tr') return mailTr('danisan.geri-al', { ad: c.name.trim() });
  return withTexts('danisan.geri-al', 'en', { ad: c.name.trim() }, builtRevertMailEn(c));
}

export function waitlistMail(c: Contact, mode: 'offer' | 'open' | 'remove', when?: { day: string; time: string }): Mail {
  const id: PanelMailId = mode === 'offer' ? 'bekleme.yer-acildi' : mode === 'open' ? 'bekleme.alim-acik' : 'bekleme.cikarma';
  if (c.lang === 'tr') return mailTr(id, { ad: c.name.trim(), ...(when ? whenVars(when.day, when.time) : {}), ...LINKS_TR });
  const zaman = when ? `${formatDay(when.day, 'en')}, at ${when.time.replace(':', '.')}` : '';
  return withTexts(id, 'en', { ad: c.name.trim(), zaman, baglanti: `${SITE}${pathFor('appointment', 'en')}` }, builtWaitlistMailEn(c, mode, when));
}

export function linkMail(c: Contact, link: string): Mail {
  if (c.lang === 'tr') return mailTr('danisan.sayfa', { ad: c.name.trim(), sayfa_baglantisi: link, kural: RULE_TR });
  return withTexts('danisan.sayfa', 'en', { ad: c.name.trim(), baglanti: link }, builtLinkMailEn(c, link));
}
