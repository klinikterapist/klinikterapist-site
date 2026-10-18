import { z } from 'astro/zod';
import { referenceSchema } from './apa/types';

/**
 * Settings and post schemas, shared by the build (`settings.ts`, `content.config.ts`) and the
 * admin panel in the browser. No `node:` imports here.
 */
export type Lang = 'tr' | 'en';
export type Localized = { tr: string; en: string };

export const ROUTE_KEYS = [
  'home', 'about', 'blog', 'category', 'post', 'resources',
  'contact', 'appointment', 'privacyNotice', 'privacyPolicy', 'faq', 'popular',
] as const;
export type RouteKey = (typeof ROUTE_KEYS)[number];

/** Route keys with one fixed page (no slug): the only pages a home card may target. */
export const PAGE_KEYS = [
  'home', 'about', 'blog', 'resources', 'contact', 'appointment', 'privacyNotice', 'privacyPolicy', 'faq', 'popular',
] as const satisfies readonly RouteKey[];

const localized = z.object({ tr: z.string(), en: z.string() });

/** URL slug: lowercase a-z, digits and single dashes (`kaygi-ile-yasamak`). Shared by posts and categories. */
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const slugSchema = z
  .string()
  .regex(SLUG_RE, 'URL kısa adı (slug) boş olamaz; yalnızca küçük harf (a-z), rakam ve tek tire içerebilir (ör. "kaygi-ile-yasamak")');

/** Post slugs that would collide with a blog sub-page: the category base path and the popular posts page. */
export const RESERVED_SLUGS: Record<Lang, readonly string[]> = { tr: ['kategori', 'populer'], en: ['category', 'popular'] };

/** Why `slug` cannot be a post address in `lang` (Turkish, for the owner), or null when it can. */
export function slugError(slug: string, lang: Lang): string | null {
  if (!SLUG_RE.test(slug)) {
    return 'URL kısa adı boş olamaz; yalnızca küçük harf (a-z), rakam ve tek tire içerebilir (ör. "kaygi-ile-yasamak")';
  }
  if (RESERVED_SLUGS[lang].includes(slug)) {
    return `"${slug}" adresi blogun kendi sayfalarına (kategoriler, popüler yazılar) ayrılmış; başka bir URL kısa adı seçin`;
  }
  return null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Site-relative page path: lowercase segments, leading and trailing slash (`/`, `/blog/eski-adres/`). */
export const SITE_PATH_RE = /^\/([a-z0-9-]+\/)*$/;
const sitePath = z
  .string()
  .regex(SITE_PATH_RE, 'site içi bir yol olmalı: "/" ile başlayıp "/" ile biten, küçük harf, rakam ve tire (ör. "/blog/eski-adres/")');

const httpsUrl = z.string().regex(/^https:\/\/[^\s/]+\S*$/, 'adres "https://" ile başlamalı (ör. "https://instagram.com/kullanici")');
const mailtoUrl = z.string().regex(/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/, 'e-posta bağlantısı "mailto:" ile başlamalı (ör. "mailto:ad@alanadi.com")');

const profileSchema = z.object({
  name: z.string().min(1),
  title: localized,
  tagline: localized,
  intro: localized,
  /** One line for the author box under posts. Falls back to `intro`. */
  shortIntro: localized.optional(),
  photo: z.string().nullable(),
  photoAlt: localized,
  /** Home page look: photo as sticky background (default) or a round photo with a sun badge. */
  heroStyle: z.enum(['background', 'round']).optional(),
  /** Professional memberships; the number is optional. */
  memberships: z.array(z.object({ org: localized, number: z.string().optional() })).optional(),
});

const linkSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    url: z.string().min(1),
    icon: z.enum(['instagram', 'linkedin', 'medium', 'substack', 'email', 'youtube', 'x', 'tiktok', 'threads']),
    inHero: z.boolean(),
    inFooter: z.boolean(),
    /** Short note beside the account, e.g. the language of the posts. */
    note: localized.optional(),
  })
  .superRefine((link, ctx) => {
    // E-mail links open the mail app; every other link is an https profile address.
    const check = (link.icon === 'email' ? mailtoUrl : httpsUrl).safeParse(link.url);
    if (!check.success) ctx.addIssue({ code: 'custom', path: ['url'], message: check.error.issues[0].message });
  });

const homeSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string().min(1),
      target: z.union([
        z.object({ page: z.enum(PAGE_KEYS) }),
        z.object({ url: httpsUrl }),
      ]),
      title: localized,
      subtitle: localized,
      icon: z.string(),
      visible: z.boolean(),
    }),
  ),
  /** Up to three "how it works" steps for the desktop home page. */
  process: z.array(z.object({ title: localized, text: localized })).max(3).optional(),
});

const aboutSchema = z.object({
  heading: localized,
  lead: localized,
  areas: z.array(z.object({ icon: z.string(), label: localized })),
  whoAmI: localized,
  whyThisWork: localized,
  quote: localized,
  // `period`: a plain string for language-neutral values ("2016–2020"), or { tr, en } for words ("Devam ediyor").
  timeline: z.array(z.object({ title: localized, detail: localized, period: z.union([z.string(), localized]) })),
});

const contactSchema = z.object({
  intro: localized,
  workStyle: localized,
  responseTime: localized,
  emergencyNote: localized,
  email: z.string().regex(EMAIL_RE, 'geçerli bir e-posta adresi yazın (ör. ad@alanadi.com)'),
});

const resourcesSchema = z.object({
  /** The owner's note shown beside the list ("Benim Notum"). */
  myNote: localized,
  items: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(['book', 'article', 'scale', 'video', 'podcast', 'guide']),
      title: z.string().min(1),
      author: z.string().optional(),
      note: localized,
      url: httpsUrl,
      cover: z.string().optional(),
      featured: z.boolean(),
    }),
  ),
});

/** Adds an issue at `<index>.<field...>` for every value already used by an earlier entry. */
function rejectDuplicates<T>(
  list: T[],
  value: (item: T) => string,
  field: (string | number)[],
  ctx: z.RefinementCtx,
  what: string,
): void {
  const seen = new Map<string, number>();
  list.forEach((item, i) => {
    const v = value(item);
    const first = seen.get(v);
    if (first === undefined) seen.set(v, i);
    else ctx.addIssue({ code: 'custom', path: [i, ...field], message: `${what} "${v}" ${first}. kayıtta zaten kullanılıyor; her kayıt farklı olmalı` });
  });
}

const categoriesSchema = z
  .array(z.object({ id: z.string().min(1), slug: z.object({ tr: slugSchema, en: slugSchema }), label: localized }))
  .superRefine((cats, ctx) => {
    rejectDuplicates(cats, (c) => c.slug.tr, ['slug', 'tr'], ctx, 'Kategori slug değeri');
    rejectDuplicates(cats, (c) => c.slug.en, ['slug', 'en'], ctx, 'Kategori slug değeri');
  });

/** Frequently asked questions. An item with an empty answer in a language is not shown in it. */
const faqSchema = z
  .array(z.object({ id: slugSchema, q: localized, a: localized }))
  .superRefine((items, ctx) => rejectDuplicates(items, (f) => f.id, ['id'], ctx, 'Soru kimliği (id)'));

const seoSchema = z.object({
  siteName: localized,
  defaultDescription: localized,
  ogImage: z.string().min(1),
  gscVerification: z.string().optional(),
});

const redirectsSchema = z
  .array(
    z.object({
      from: sitePath.refine((p) => p !== '/', 'ana sayfa ("/") yönlendirilemez'),
      to: sitePath,
    }),
  )
  .superRefine((list, ctx) => {
    rejectDuplicates(list, (r) => r.from, ['from'], ctx, 'Eski adres (from)');
    const froms = new Map(list.map((r) => [r.from, r.to]));
    list.forEach((r, i) => {
      if (r.to === r.from) {
        ctx.addIssue({ code: 'custom', path: [i, 'to'], message: `yönlendirme kendisine gidiyor ("${r.from}"); from ile to farklı olmalı` });
      } else if (froms.has(r.to)) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'to'],
          message: `zincirleme yönlendirme: "${r.to}" de başka bir adrese ("${froms.get(r.to)}") yönleniyor; to doğrudan son adresi göstermeli`,
        });
      }
    });
  });

/**
 * Post frontmatter. `cover` is the relative image path as written in the file; the content
 * collection replaces it with Astro's `image()` so the build optimizes it.
 */
export function postFrontmatterSchema(categoryIds: string[]) {
  return z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    seoTitle: z.string().optional(),
    description: z.string(),
    slug: slugSchema,
    focusKeyword: z.string(),
    category: z.string().refine((c) => categoryIds.includes(c), {
      message: `Bilinmeyen kategori. categories.json içindeki bir id olmalı: ${categoryIds.join(', ')}`,
    }),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    references: z.array(referenceSchema).optional(),
    featured: z.boolean().optional(),
  });
}

export type Profile = z.infer<typeof profileSchema>;
export type Link = z.infer<typeof linkSchema>;
export type HomeCard = z.infer<typeof homeSchema>['cards'][number];
export type Home = z.infer<typeof homeSchema>;
export type About = z.infer<typeof aboutSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Resources = z.infer<typeof resourcesSchema>;
export type Resource = Resources['items'][number];
export type Period = About['timeline'][number]['period'];
export type Category = z.infer<typeof categoriesSchema>[number];
export type Faq = z.infer<typeof faqSchema>;
export type FaqItem = Faq[number];
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

export const parseProfile = (raw: unknown): Profile => parse(profileSchema, raw, 'profile.json');
export const parseLinks = (raw: unknown): Link[] => parse(z.array(linkSchema), raw, 'links.json');
export const parseHome = (raw: unknown): Home => parse(homeSchema, raw, 'home.json');
export const parseAbout = (raw: unknown): About => parse(aboutSchema, raw, 'about.json');
export const parseContact = (raw: unknown): Contact => parse(contactSchema, raw, 'contact.json');
export const parseResources = (raw: unknown): Resources => parse(resourcesSchema, raw, 'resources.json');
export const parseCategories = (raw: unknown): Category[] => parse(categoriesSchema, raw, 'categories.json');
export const parseFaq = (raw: unknown): Faq => parse(faqSchema, raw, 'faq.json');
export const parseSeo = (raw: unknown): Seo => parse(seoSchema, raw, 'seo.json');
export const parseRedirects = (raw: unknown): Redirect[] => parse(redirectsSchema, raw, 'redirects.json');

/** Text of a timeline period in the page language. */
export function periodText(period: Period, lang: Lang): string {
  return typeof period === 'string' ? period : period[lang];
}

/**
 * A redirect stub must never replace a real page: Astro would only warn and drop the stub,
 * and the sitemap would lose the live page. Fail the build instead.
 */
export function checkRedirectCollisions(redirects: Redirect[], pagePaths: Iterable<string>): void {
  const pages = new Set(pagePaths);
  redirects.forEach((r, i) => {
    if (pages.has(r.from)) {
      throw new Error(
        `redirects.json geçersiz — ${i}.from: "${r.from}" sitede gerçek bir sayfa (yazı, kategori ya da sabit sayfa); bu yönlendirmeyi silin ya da adresi değiştirin`,
      );
    }
  });
}

/** The FAQ items that have both a question and an answer in `lang`, as plain strings. */
export function answeredFaq(faq: Faq, lang: Lang): { id: string; q: string; a: string }[] {
  return faq
    .filter((f) => f.q[lang].trim() && f.a[lang].trim())
    .map((f) => ({ id: f.id, q: f.q[lang].trim(), a: f.a[lang].trim() }));
}
