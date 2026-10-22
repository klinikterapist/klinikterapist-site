import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  answeredFaq, type FaqPage, type Lang,
  parseAbout, parseCategories, parseContact, parseFaq, parseHome, parseLinks, parseProfile, parseBooking, parseRedirects, parseResources, parseSeo,
} from './schemas';

export * from './schemas';

export function dataDir(): string {
  return process.env.DATA_DIR ?? 'src/data';
}

function readJson(file: string): unknown {
  const path = join(dataDir(), file);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${file} okunamadı (${path}): ${(e as Error).message}`);
  }
}

export const getProfile = () => parseProfile(readJson('profile.json'));
export const getLinks = () => parseLinks(readJson('links.json'));
export const getHome = () => parseHome(readJson('home.json'));
export const getAbout = () => parseAbout(readJson('about.json'));
export const getContact = () => parseContact(readJson('contact.json'));
/** The public e-mail address for a page's language (iletisim@ / hello@). */
export const contactEmail = (lang: 'tr' | 'en') => {
  const c = getContact();
  return (lang === 'en' && c.emailEn) || c.email;
};
export const getResources = () => parseResources(readJson('resources.json'));
export const getCategories = () => parseCategories(readJson('categories.json'));
export const getFaq = (lang: Lang, page: FaqPage = 'faq') => answeredFaq(parseFaq(readJson('faq.json')), lang, page);
export const getSeo = () => parseSeo(readJson('seo.json'));
export const getRedirects = () => parseRedirects(readJson('redirects.json'));
export const getBooking = () => parseBooking(readJson('booking.json'));

