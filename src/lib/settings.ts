import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';

export type Lang = 'tr' | 'en';
export type Localized = { tr: string; en: string };

export const ROUTE_KEYS = [
  'home', 'about', 'blog', 'category', 'post', 'resources',
  'contact', 'appointment', 'privacyNotice', 'privacyPolicy',
] as const;
export type RouteKey = (typeof ROUTE_KEYS)[number];

/** Route keys with one fixed page (no slug): the only pages a home card may target. */
export const PAGE_KEYS = [
  'home', 'about', 'blog', 'resources', 'contact', 'appointment', 'privacyNotice', 'privacyPolicy',
] as const satisfies readonly RouteKey[];

const localized = z.object({ tr: z.string(), en: z.string() });

const profileSchema = z.object({
  name: z.string().min(1),
  title: localized,
  tagline: localized,
  intro: localized,
  photo: z.string().nullable(),
  photoAlt: localized,
});

const linkSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  url: z.string().min(1),
  icon: z.enum(['instagram', 'linkedin', 'medium', 'substack', 'email', 'youtube', 'x']),
  inHero: z.boolean(),
  inFooter: z.boolean(),
});

const homeSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string().min(1),
      target: z.union([
        z.object({ page: z.enum(PAGE_KEYS) }),
        z.object({ url: z.string().min(1) }),
      ]),
      title: localized,
      subtitle: localized,
      icon: z.string(),
      visible: z.boolean(),
    }),
  ),
});

const aboutSchema = z.object({
  heading: localized,
  lead: localized,
  areas: z.array(z.object({ icon: z.string(), label: localized })),
  whoAmI: localized,
  whyThisWork: localized,
  quote: localized,
  timeline: z.array(z.object({ title: localized, detail: localized, period: z.string() })),
});

const contactSchema = z.object({
  intro: localized,
  workStyle: localized,
  responseTime: localized,
  emergencyNote: localized,
  email: z.string().min(1),
});

const resourcesSchema = z.array(
  z.object({
    id: z.string().min(1),
    type: z.enum(['book', 'article', 'scale', 'video', 'podcast', 'guide']),
    title: z.string().min(1),
    author: z.string().optional(),
    note: localized,
    url: z.string().min(1),
    cover: z.string().optional(),
    featured: z.boolean(),
  }),
);

const categoriesSchema = z.array(
  z.object({ id: z.string().min(1), slug: localized, label: localized }),
);

const seoSchema = z.object({
  siteName: localized,
  defaultDescription: localized,
  ogImage: z.string().min(1),
  gscVerification: z.string().optional(),
});

const redirectsSchema = z.array(z.object({ from: z.string().min(1), to: z.string().min(1) }));

export type Profile = z.infer<typeof profileSchema>;
export type Link = z.infer<typeof linkSchema>;
export type HomeCard = z.infer<typeof homeSchema>['cards'][number];
export type Home = z.infer<typeof homeSchema>;
export type About = z.infer<typeof aboutSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Resource = z.infer<typeof resourcesSchema>[number];
export type Category = z.infer<typeof categoriesSchema>[number];
export type Seo = z.infer<typeof seoSchema>;
export type Redirect = z.infer<typeof redirectsSchema>[number];

function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown, file: string): z.infer<T> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const issues = result.error.issues
    .map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
    .join('; ');
  throw new Error(`${file} geçersiz — ${issues}`);
}

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

export const parseProfile = (raw: unknown): Profile => parse(profileSchema, raw, 'profile.json');
export const parseLinks = (raw: unknown): Link[] => parse(z.array(linkSchema), raw, 'links.json');
export const parseHome = (raw: unknown): Home => parse(homeSchema, raw, 'home.json');
export const parseAbout = (raw: unknown): About => parse(aboutSchema, raw, 'about.json');
export const parseContact = (raw: unknown): Contact => parse(contactSchema, raw, 'contact.json');
export const parseResources = (raw: unknown): Resource[] => parse(resourcesSchema, raw, 'resources.json');
export const parseCategories = (raw: unknown): Category[] => parse(categoriesSchema, raw, 'categories.json');
export const parseSeo = (raw: unknown): Seo => parse(seoSchema, raw, 'seo.json');
export const parseRedirects = (raw: unknown): Redirect[] => parse(redirectsSchema, raw, 'redirects.json');

export const getProfile = () => parseProfile(readJson('profile.json'));
export const getLinks = () => parseLinks(readJson('links.json'));
export const getHome = () => parseHome(readJson('home.json'));
export const getAbout = () => parseAbout(readJson('about.json'));
export const getContact = () => parseContact(readJson('contact.json'));
export const getResources = () => parseResources(readJson('resources.json'));
export const getCategories = () => parseCategories(readJson('categories.json'));
export const getSeo = () => parseSeo(readJson('seo.json'));
export const getRedirects = () => parseRedirects(readJson('redirects.json'));
