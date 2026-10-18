/**
 * The contact form's fixed topics and field rules, shared by the site (inline errors in the browser)
 * and the Apps Script backend (`contact.send`, which checks everything again). No imports: Apps Script
 * bundles this file too.
 */
export type ContactLang = 'tr' | 'en';

export const CONTACT_TOPICS = [
  { id: 'general', tr: 'Genel mesaj', en: 'General message' },
  { id: 'request', tr: 'İstek ve öneri', en: 'Request or suggestion' },
  { id: 'complaint', tr: 'Şikâyet', en: 'Complaint' },
  { id: 'collaboration', tr: 'İş birliği', en: 'Collaboration' },
  { id: 'advertising', tr: 'Reklam ve sponsorluk', en: 'Advertising and sponsorship' },
  { id: 'press', tr: 'Basın ve röportaj', en: 'Press and interviews' },
  { id: 'other', tr: 'Diğer', en: 'Other' },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]['id'];

export const CONTACT_LIMITS = { nameMax: 100, emailMax: 254, messageMin: 10, messageMax: 5000 } as const;

export type ContactInput = { name: string; email: string; topic: string; message: string; consent: boolean };
export type ContactField = keyof ContactInput;
export type ContactErrorKind = 'required' | 'tooLong' | 'tooShort' | 'invalid';
export type ContactErrors = Partial<Record<ContactField, ContactErrorKind>>;

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

export const isContactTopic = (id: string): id is ContactTopic => CONTACT_TOPICS.some((t) => t.id === id);

export const topicLabel = (id: ContactTopic, lang: ContactLang): string => CONTACT_TOPICS.find((t) => t.id === id)![lang];

/** Every rule the form shows inline; the backend runs the same check. Values are compared trimmed. */
export function validateContact(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();
  if (!name) errors.name = 'required';
  else if (name.length > CONTACT_LIMITS.nameMax) errors.name = 'tooLong';
  if (!email) errors.email = 'required';
  else if (email.length > CONTACT_LIMITS.emailMax || !EMAIL_RE.test(email)) errors.email = 'invalid';
  if (!input.topic) errors.topic = 'required';
  else if (!isContactTopic(input.topic)) errors.topic = 'invalid';
  if (!message) errors.message = 'required';
  else if (message.length < CONTACT_LIMITS.messageMin) errors.message = 'tooShort';
  else if (message.length > CONTACT_LIMITS.messageMax) errors.message = 'tooLong';
  if (!input.consent) errors.consent = 'required';
  return errors;
}
