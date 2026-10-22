/**
 * Every ready e-mail, for Ayarlar › E-posta Ayarları (owner's request 2026-10-21): what it is, when it
 * goes, and a sample made with an example person, so the editor can show the built-in text as a
 * template (sample values turned back into placeholders) and preview the owner's own.
 * `auto`: sent by the backend on its own; shown for reading, its wording is changed with the backend.
 */
import type { BookingRequest } from '../api/types';
import { formatDay } from '../../lib/booking-form';
import { pathFor } from '../../i18n/routes';
import { payVars, paymentLines, ruleLine, sessionReminderMail, thanksMail, paymentReminderMail, motivationFor, type PaymentSettings } from '../../lib/payment';
import { mailTexts, setMailTexts, toTemplate, type Mail } from '../../lib/mail-texts';
import { MAIL_TR } from '../../lib/mail-templates-tr';
import { LINKS_TR, RULE_TR, typeVars, whenVars } from '../../lib/mail-vars';
import { SITE, decisionMail, decisionVarsTr, endMail, introNote, linkMail, revertMail, waitlistMail, what, type PanelMailId } from './booking-mail';

type Lang = 'tr' | 'en';
export type MailGroup = 'Randevu talepleri' | 'Danışanlar' | 'Ödemeler' | 'Bekleme listesi' | 'Otomatik';

export type CatalogEntry = {
  id: PanelMailId | 'odeme.tesekkur' | 'odeme.hatirlatma' | 'oto.seans-hatirlatma';
  group: MailGroup;
  label: string;
  when: string;
  auto?: boolean;
  /** The built-in e-mail for the example person. */
  sample: (lang: Lang) => Mail;
  /** The example values, by placeholder. */
  vars: (lang: Lang) => Record<string, string>;
};

const DAY = '2026-11-12';
const TIME = '18:00';
const person = (lang: Lang) => ({ name: lang === 'en' ? 'Anna Example' : 'Ayşe Örnek', lang });
const PAY: PaymentSettings = { year: 2026, fees: { individual: 1500, couple: 2200, accessible: 750 }, bank: '', holder: 'Osman Güneş Özkurt', bankName: 'Örnek Bank', iban: 'TR00 0000 0000 0000 0000 0000 00', link: '', dueHours: 24 };
const request = (lang: Lang, kind: 'session' | 'intro'): BookingRequest => ({
  id: 'ornek',
  createdAt: 0,
  kind,
  ...(kind === 'session' ? { type: 'individual' } : { forWhom: 'individual', topics: [0, 1] }),
  day: DAY,
  time: TIME,
  name: person(lang).name,
  email: 'ornek@example.com',
  phone: '',
  note: '',
  lang,
  status: 'pending',
  holdId: '',
});
const when = (lang: Lang) => `${formatDay(DAY, lang)}, ${lang === 'en' ? 'at ' : 'saat '}${TIME.replace(':', '.')}`;
const link = (lang: Lang, key: 'appointment' | 'preConsult' = 'appointment') => `${SITE}${pathFor(key, lang)}`;
const PAGE = 'https://klinikterapist.com/randevum/#k=ornek';

/** Built-in texts only: the owner's templates are set aside while a sample is made. */
function builtIn(make: () => Mail): Mail {
  const saved = mailTexts();
  setMailTexts({});
  try {
    return make();
  } finally {
    setMailTexts(saved);
  }
}

const decision = (kind: 'session' | 'intro', d: 'approve' | 'unavailable' | 'cancel') => ({
  sample: (lang: Lang) => builtIn(() => decisionMail(request(lang, kind), d, PAY)),
  vars: (lang: Lang): Record<string, string> =>
    lang === 'tr'
      ? decisionVarsTr(request('tr', kind), PAY)
      : {
    ad: person(lang).name,
    zaman: when(lang),
    tur: what(request(lang, kind), lang),
    odeme: kind === 'session' ? paymentLines(PAY, 'individual', lang).join('\n') : '',
    kural: ruleLine(lang),
    baglanti: link(lang, kind === 'intro' ? 'preConsult' : 'appointment'),
    talep_notu: introNote(request(lang, kind), lang),
  },
});

export const MAIL_CATALOG: CatalogEntry[] = [
  { id: 'talep.onay.seans', group: 'Randevu talepleri', label: 'Seans onayı', when: 'Bir seans talebini onayladığınızda', ...decision('session', 'approve') },
  { id: 'talep.onay.ongorusme', group: 'Randevu talepleri', label: 'Ön görüşme onayı', when: 'Bir ön görüşme talebini onayladığınızda', ...decision('intro', 'approve') },
  { id: 'talep.uygun-degil', group: 'Randevu talepleri', label: 'Uygun değilim', when: 'İstenen saatte uygun olmadığınızda', ...decision('session', 'unavailable') },
  { id: 'talep.iptal', group: 'Randevu talepleri', label: 'Talep iptali', when: 'Bir talebi iptal ettiğinizde', ...decision('session', 'cancel') },
  {
    id: 'danisan.sayfa',
    group: 'Danışanlar',
    label: 'Randevu sayfası bağlantısı',
    when: 'Danışanın sayfasından bağlantıyı gönderdiğinizde',
    sample: (lang) => builtIn(() => linkMail(person(lang), PAGE)),
    vars: (lang): Record<string, string> => (lang === 'tr' ? { ad: person(lang).name, sayfa_baglantisi: PAGE, kural: RULE_TR } : { ad: person(lang).name, baglanti: PAGE }),
  },
  {
    id: 'danisan.sonlandirma',
    group: 'Danışanlar',
    label: 'Sonlandırma görüşmesi daveti',
    when: 'Terapiyi sonlandır › Sonlandırma görüşmesi talep et',
    sample: (lang) => builtIn(() => endMail(person(lang), 'closing')),
    vars: (lang): Record<string, string> => (lang === 'tr' ? { ad: person(lang).name, ...LINKS_TR } : { ad: person(lang).name, baglanti: link(lang) }),
  },
  {
    id: 'danisan.tamamlandi',
    group: 'Danışanlar',
    label: 'Terapi tamamlandı',
    when: 'Terapiyi sonlandır › Terapi tamamlandı',
    sample: (lang) => builtIn(() => endMail(person(lang), 'complete')),
    vars: (lang): Record<string, string> => (lang === 'tr' ? { ad: person(lang).name, ...LINKS_TR } : { ad: person(lang).name, baglanti: link(lang) }),
  },
  {
    id: 'danisan.geri-al',
    group: 'Danışanlar',
    label: 'Düzeltme (Geri al)',
    when: 'Yanlışlıkla gönderilen bir onayı geri aldığınızda',
    sample: (lang) => builtIn(() => revertMail(person(lang))),
    vars: (lang) => ({ ad: person(lang).name }),
  },
  {
    id: 'odeme.tesekkur',
    group: 'Ödemeler',
    label: 'Ödeme alındı (teşekkür)',
    when: 'Bir seansı "Ödendi" diye işaretlediğinizde',
    sample: (lang) => builtIn(() => thanksMail(person(lang), { day: DAY, time: TIME })),
    vars: (lang): Record<string, string> => (lang === 'tr' ? { ad: person(lang).name, ...whenVars(DAY, TIME), tur: typeVars('individual').tur, motivasyon: motivationFor(`${DAY}T${TIME}`, lang) } : { ad: person(lang).name, zaman: when(lang), motivasyon: motivationFor(`${DAY}T${TIME}`, lang) }),
  },
  {
    id: 'odeme.hatirlatma',
    group: 'Ödemeler',
    label: 'Ödeme hatırlatması',
    when: 'Danışanın sayfasından "Ödeme hatırlat" ile gönderdiğinizde',
    sample: (lang) => builtIn(() => paymentReminderMail(person(lang), { day: DAY, time: TIME }, 'individual', PAY)),
    vars: (lang): Record<string, string> =>
      lang === 'tr'
        ? { ad: person(lang).name, ...whenVars(DAY, TIME), ...typeVars('individual'), ...payVars(PAY, 'individual', false), sayfa_baglantisi: PAGE, '#sayfa': '1' }
        : { ad: person(lang).name, zaman: when(lang), odeme: paymentLines(PAY, 'individual', lang).join('\n'), kural: ruleLine(lang) },
  },
  {
    id: 'bekleme.yer-acildi',
    group: 'Bekleme listesi',
    label: 'Bir saat boşaldı',
    when: 'Bekleme listesindeki birine saat önerdiğinizde',
    sample: (lang) => builtIn(() => waitlistMail(person(lang), 'offer', { day: DAY, time: TIME })),
    vars: (lang): Record<string, string> => (lang === 'tr' ? { ad: person(lang).name, ...whenVars(DAY, TIME) } : { ad: person(lang).name, zaman: when(lang), baglanti: link(lang) }),
  },
  {
    id: 'bekleme.alim-acik',
    group: 'Bekleme listesi',
    label: 'Randevu alımı açıldı',
    when: 'Randevu alımını yeniden açıp listeye haber verdiğinizde',
    sample: (lang) => builtIn(() => waitlistMail(person(lang), 'open')),
    vars: (lang): Record<string, string> => (lang === 'tr' ? { ad: person(lang).name, ...LINKS_TR } : { ad: person(lang).name, baglanti: link(lang) }),
  },
  {
    id: 'bekleme.cikarma',
    group: 'Bekleme listesi',
    label: 'Listeden çıkarma',
    when: 'Bir kişiyi bekleme listesinden çıkardığınızda',
    sample: (lang) => builtIn(() => waitlistMail(person(lang), 'remove')),
    vars: (lang): Record<string, string> => (lang === 'tr' ? { ad: person(lang).name, ...LINKS_TR } : { ad: person(lang).name, baglanti: link(lang) }),
  },
  {
    id: 'oto.seans-hatirlatma',
    group: 'Otomatik',
    label: 'Seans hatırlatması (3 gün önce)',
    when: 'Her seanstan 72 saat önce, kendiliğinden',
    auto: true,
    sample: (lang) => builtIn(() => sessionReminderMail(person(lang), { day: DAY, time: TIME }, { type: 'individual', free: false, paid: false }, PAY, PAGE)),
    vars: (lang): Record<string, string> =>
      lang === 'tr'
        ? { ad: person(lang).name, ...whenVars(DAY, TIME), ...typeVars('individual'), ...payVars(PAY, 'individual', false), sayfa_baglantisi: PAGE, '#odeme': '1', '#sayfa': '1' }
        : { ad: person(lang).name, zaman: when(lang) },
  },
];

/** The built-in e-mail as a template with placeholders: where the editor starts (Turkish: the text itself). */
export const defaultTemplate = (e: CatalogEntry, lang: Lang): Mail => (lang === 'tr' ? { ...MAIL_TR[e.id] } : toTemplate(e.sample(lang), e.vars(lang), lang));
