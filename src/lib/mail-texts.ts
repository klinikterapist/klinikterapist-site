/**
 * The owner's own wording for the ready e-mails (owner's request 2026-10-21, Ayarlar › E-posta
 * Ayarları), kept in src/data/mail.json. A template is the subject and body with placeholders —
 * {ad}, {zaman}, {tur}, {odeme}, {kural}, {baglanti}, {talep_notu}, {motivasyon}, {imza} — filled in
 * when the e-mail is made; a mail with no template of its own keeps the built-in text. The signature
 * and the thank-you sentences can be changed on their own too.
 * The panel loads the file once (setMailTexts); code that never loads it (the backend) gets the
 * built-in texts, exactly as before.
 */
export type Mail = { subject: string; body: string };
type Lang = 'tr' | 'en';

/** src/data/mail.json (its schema, mailTextsSchema, is in schemas.ts so this file stays free of zod for the backend). */
export type MailTexts = {
  /** The lines under the closing words (name, title, site), per language. */
  signature?: { tr: string; en: string };
  /** The sentences of the thank-you after a payment, per language. */
  motivation?: { tr: string[]; en: string[] };
  /** Templates by id (MAIL_TEMPLATES in the panel), per language. */
  templates?: Record<string, { tr?: Mail; en?: Mail }>;
};

/** The built-in signature lines (after "Saygılarımla," / "Kind regards,"). */
export const DEFAULT_SIGNATURE: Record<Lang, string> = {
  tr: 'Osman Güneş Özkurt\nKlinik Psikolog\nklinikterapist.com',
  en: 'Osman Güneş Özkurt\nClinical Psychologist\nklinikterapist.com',
};

/** Every placeholder, with what it becomes; shown as buttons in the template editor. */
export const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'ad', label: 'Kişinin adı' },
  { key: 'zaman', label: 'Gün ve saat' },
  { key: 'tur', label: 'Görüşme türü' },
  { key: 'odeme', label: 'Ücret ve ödeme bilgisi' },
  { key: 'kural', label: '24 saat kuralı' },
  { key: 'baglanti', label: 'Bağlantı' },
  { key: 'talep_notu', label: 'Talepte yazdıkları (ön görüşme)' },
  { key: 'motivasyon', label: 'Teşekkür cümlesi' },
  { key: 'imza', label: 'İmza' },
];

let current: MailTexts = {};

export function setMailTexts(t: MailTexts): void {
  current = t ?? {};
}

export const mailTexts = (): MailTexts => current;

export const signature = (lang: Lang): string => current.signature?.[lang]?.trim() || DEFAULT_SIGNATURE[lang];

/** {ad} → its value; an unknown placeholder stays as it is, so a typo shows in the preview. */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

/**
 * The e-mail as it goes: the owner's template for `id` when there is one, else the built-in text with
 * the owner's signature in place of the built-in one.
 */
export function withTexts(id: string, lang: Lang, vars: Record<string, string>, built: Mail): Mail {
  const t = current.templates?.[id]?.[lang];
  const all = { ...vars, imza: signature(lang) };
  if (t && (t.subject.trim() || t.body.trim())) return { subject: fill(t.subject, all), body: fill(t.body, all) };
  if (!current.signature?.[lang]?.trim()) return built;
  return { ...built, body: built.body.split(DEFAULT_SIGNATURE[lang]).join(signature(lang)) };
}

/**
 * The template the editor starts from: the built-in e-mail made with sample values, each sample then
 * turned back into its placeholder (longest first, so a date inside a longer line is still found).
 */
export function toTemplate(sample: Mail, samples: Record<string, string>, lang: Lang): Mail {
  const pairs = Object.entries({ ...samples, imza: DEFAULT_SIGNATURE[lang] })
    .filter(([, v]) => v.trim())
    .sort((a, b) => b[1].length - a[1].length);
  const back = (text: string) => pairs.reduce((t, [k, v]) => t.split(v).join(`{${k}}`), text);
  return { subject: back(sample.subject), body: back(sample.body) };
}
