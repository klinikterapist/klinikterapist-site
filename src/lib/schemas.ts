import { z } from 'astro/zod';
import { referenceSchema } from './apa/types';
import { parseCrop } from './crop-area';
import type { BookingConfig } from './booking-form';

/**
 * Settings and post schemas, shared by the build (`settings.ts`, `content.config.ts`) and the
 * admin panel in the browser. No `node:` imports here.
 */
export type Lang = 'tr' | 'en';
export type Localized = { tr: string; en: string };

export const ROUTE_KEYS = [
  'home', 'about', 'blog', 'category', 'post', 'resources',
  'contact', 'appointment', 'preConsult', 'privacyNotice', 'privacyPolicy', 'faq', 'popular', 'topics',
] as const;
export type RouteKey = (typeof ROUTE_KEYS)[number];

/** Route keys with one fixed page (no slug): the only pages a home card may target. */
export const PAGE_KEYS = [
  'home', 'about', 'blog', 'resources', 'contact', 'appointment', 'preConsult', 'privacyNotice', 'privacyPolicy', 'faq', 'popular', 'topics',
] as const satisfies readonly RouteKey[];

const localized = z.object({ tr: z.string(), en: z.string() });

/** URL slug: lowercase a-z, digits and single dashes (`kaygi-ile-yasamak`). Shared by posts and categories. */
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const slugSchema = z
  .string()
  .regex(SLUG_RE, 'URL kısa adı (slug) boş olamaz; yalnızca küçük harf (a-z), rakam ve tek tire içerebilir (ör. "kaygi-ile-yasamak")');

/** Post slugs that would collide with a blog sub-page: the category base path, the popular posts and the topics pages. */
export const RESERVED_SLUGS: Record<Lang, readonly string[]> = { tr: ['kategori', 'populer', 'konular'], en: ['category', 'popular', 'topics'] };

/** Why `slug` cannot be a post address in `lang` (Turkish, for the owner), or null when it can. */
export function slugError(slug: string, lang: Lang): string | null {
  if (!SLUG_RE.test(slug)) {
    return 'URL kısa adı boş olamaz; yalnızca küçük harf (a-z), rakam ve tek tire içerebilir (ör. "kaygi-ile-yasamak")';
  }
  if (RESERVED_SLUGS[lang].includes(slug)) {
    return `"${slug}" adresi blogun kendi sayfalarına (kategoriler, popüler yazılar, konular) ayrılmış; başka bir URL kısa adı seçin`;
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
  /** The big greeting of the intro card ("Merhaba, ben *Güneş.*"; *…* is set in italics). Empty: the heading. */
  hello: localized.default({ tr: '', en: '' }),
  lead: localized,
  /** Short facts under the lead ("2023'ten beri" + "online terapi"). A value of "{hours}" shows the theory hours total. */
  facts: z.array(z.object({ value: localized, label: localized })).default([]),
  areas: z.array(z.object({ icon: z.string(), label: localized })),
  /** "Konular" and "Yaklaşımlar": short labels shown as chips under the work areas (owner's review 2026-10-22). */
  topics: z.array(localized).default([]),
  approaches: z.array(localized).default([]),
  whoAmI: localized,
  whyThisWork: localized,
  quote: localized,
  /** "klinikterapist nedir?": the brand story shown with the logo (owner's review 2026-10-19). */
  brand: localized.default({ tr: '', en: '' }),
  // `period`: a plain string for language-neutral values ("2016–2020"), or { tr, en } for words ("Devam ediyor").
  timeline: z.array(z.object({ title: localized, detail: localized, period: z.union([z.string(), localized]) })),
  /** Certificates and trainings ("Sertifikalarım"): name, issuing body, year and an optional link to verify it. */
  certificates: z
    .array(
      z.object({
        title: localized,
        issuer: z.string(),
        year: z.string(),
        url: z.union([z.literal(''), httpsUrl]).optional(),
      }),
    )
    .default([]),
  /** "Kariyer": schools and jobs by year, newest first (owner's review 2026-10-22). Replaces the timeline when filled. */
  career: z
    .array(
      z.object({
        period: z.union([z.string(), localized]),
        title: localized,
        detail: localized,
        kind: z.enum(['school', 'work', 'volunteer']),
      }),
    )
    .default([]),
  /**
   * "Eğitimler ve Sertifikalar" (owner's review 2026-10-22): groups (Lisans, Yüksek lisans, Sertifika…) of cards; a card with
   * `lines` opens like an FAQ box to list its courses. The two counters add up every card's `theory` and `practice` hours.
   * Replaces the certificates list when filled.
   */
  education: z
    .object({
      intro: localized,
      groups: z.array(
        z.object({
          kind: z.enum(['degree', 'certificate', 'supervision', 'practice', 'workshop', 'congress']),
          title: localized,
          items: z.array(
            z.object({
              title: localized,
              meta: localized,
              text: localized.default({ tr: '', en: '' }),
              /** What the card shows top right ("1.440+ sa.", "10 seans"); empty hides it. */
              badge: localized.default({ tr: '', en: '' }),
              theory: z.number().nonnegative().default(0),
              practice: z.number().nonnegative().default(0),
              note: localized.default({ tr: '', en: '' }),
              lines: z
                .array(
                  z.object({
                    /** A small heading above the following lines ("Gelişim"). */
                    heading: localized.optional(),
                    title: localized.optional(),
                    theory: z.number().nonnegative().optional(),
                    practice: z.number().nonnegative().optional(),
                  }),
                )
                .default([]),
            }),
          ),
        }),
      ),
    })
    .optional(),
});

const contactSchema = z.object({
  intro: localized,
  workStyle: localized,
  responseTime: localized,
  emergencyNote: localized,
  email: z.string().regex(EMAIL_RE, 'geçerli bir e-posta adresi yazın (ör. ad@alanadi.com)'),
  /** The address on English pages; the Turkish one when missing. */
  emailEn: z.string().regex(EMAIL_RE, 'geçerli bir e-posta adresi yazın (ör. ad@alanadi.com)').optional(),
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
  .array(
    z.object({
      id: z.string().min(1),
      slug: z.object({ tr: slugSchema, en: slugSchema }),
      label: localized,
      /** The topic's icon on the Konular page (a name from src/lib/icons.ts); a tag when empty. */
      icon: z.string().optional(),
    }),
  )
  .superRefine((cats, ctx) => {
    rejectDuplicates(cats, (c) => c.slug.tr, ['slug', 'tr'], ctx, 'Kategori slug değeri');
    rejectDuplicates(cats, (c) => c.slug.en, ['slug', 'en'], ctx, 'Kategori slug değeri');
  });

/** Frequently asked questions. An item with an empty answer in a language is not shown in it. */
/** The pages that show questions (owner's review 2026-10-21): home, Sık sorulan sorular, Randevu. */
export const FAQ_PAGES = ['home', 'faq', 'booking'] as const;
export type FaqPage = (typeof FAQ_PAGES)[number];
/** Questions saved before `pages` existed show where they always did. */
export const DEFAULT_FAQ_PAGES: FaqPage[] = ['home', 'faq'];
const faqSchema = z
  .array(
    z.object({
      id: slugSchema,
      q: localized,
      a: localized,
      /** Where the question shows; missing = home and the FAQ page. */
      pages: z.array(z.enum(FAQ_PAGES)).optional(),
      /** The site icon beside the question on the booking page. */
      icon: z.string().optional(),
    }),
  )
  .superRefine((items, ctx) => rejectDuplicates(items, (f) => f.id, ['id'], ctx, 'Soru kimliği (id)'));

/** Booking and intro-call free times (booking.json): a weekly template per kind, Istanbul times. */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:DD biçiminde olmalı, örneğin 09:30.');
const availabilitySchema = z.object({
  weekdays: z.record(z.string().regex(/^[0-6]$/, 'Gün 0 (pazar) ile 6 (cumartesi) arasında bir sayı olmalı.'), z.array(hhmm)),
  minNoticeHours: z.number().min(0).max(24 * 14),
  weeksAhead: z.number().int().min(1).max(26),
});
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-AA-GG biçiminde olmalı.');
export const bookingSchema = z.object({
  session: availabilitySchema,
  intro: availabilitySchema,
  restMinutes: z.number().int().min(0).max(120),
  closed: z.array(z.object({ date: daySchema, name: z.string().min(1), from: hhmm.optional() })),
  intake: z.object({ tr: z.boolean(), en: z.boolean() }).optional(),
});

const seoSchema = z.object({
  siteName: localized,
  defaultDescription: localized,
  ogImage: z.string().min(1),
  gscVerification: z.string().optional(),
  /**
   * Google Analytics 4 measurement ID (`G-…`). Set only together with the privacy texts that
   * describe it: Analytics loads only after the visitor accepts the cookie notice (Analytics.astro).
   */
  gaId: z.string().regex(/^G-[A-Z0-9]{4,20}$/, 'Google Analytics kimliği "G-" ile başlamalı (ör. G-ABC123XYZ)').optional(),
  /** Owner's review 2026-10-21 (Gizlilik ve Analitik): keep the whole site out of search results. */
  noindex: z.boolean().optional(),
  /** Pages kept out of search results while the rest is shown. */
  noindexPages: z.array(z.enum(PAGE_KEYS)).optional(),
  /** The site's own anonymous counter; false switches it off for everyone. */
  counter: z.boolean().optional(),
  /** The cookie notice's text (shown only with a gaId); empty = the built-in text. */
  cookieText: localized.optional(),
  /** Code the owner adds to pages (a verification tag, a chat widget …), where and on which pages. */
  inject: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string(),
        where: z.enum(['head', 'body']),
        pages: z.enum(['all', 'home', 'blog', 'posts', 'other']),
        code: z.string(),
        enabled: z.boolean(),
      }),
    )
    .optional(),
});

export type CodeInjection = NonNullable<z.infer<typeof seoSchema>['inject']>[number];

/** Whether an injection belongs on the page at `path` (owner's choice per snippet). */
export function injectionFits(pages: CodeInjection['pages'], path: string): boolean {
  const home = path === '/' || path === '/en/';
  const blog = /^\/(en\/)?blog\//.test(path);
  const post = blog && !/^\/(en\/)?blog\/((kategori|category|konular|topics|populer|popular)\/.*)?$/.test(path);
  if (pages === 'all') return true;
  if (pages === 'home') return home;
  if (pages === 'blog') return blog;
  if (pages === 'posts') return post;
  return !home && !blog;
}

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
    /** The uncropped cover the panel keeps for "Kapağı ayarla"; a plain string, so the build never copies it. */
    coverOriginal: z.string().optional(),
    coverCrop: z
      .string()
      .refine((s) => parseCrop(s) !== null, { message: 'coverCrop "x,y,w,h" biçiminde, yüzde olarak olmalı.' })
      .optional(),
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
export const parseBooking = (raw: unknown): BookingConfig => parse(bookingSchema, raw, 'booking.json') as BookingConfig;

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
export function answeredFaq(faq: Faq, lang: Lang, page: FaqPage = 'faq'): { id: string; q: string; a: string; icon?: string }[] {
  return faq
    .filter((f) => (f.pages ?? DEFAULT_FAQ_PAGES).includes(page) && f.q[lang].trim() && f.a[lang].trim())
    .map((f) => ({ id: f.id, q: f.q[lang].trim(), a: f.a[lang].trim(), ...(f.icon ? { icon: f.icon } : {}) }));
}

/** src/data/mail.json: the owner's wording for the ready e-mails (src/lib/mail-texts.ts). */
const mailSchema = z.object({ subject: z.string(), body: z.string() });
export const mailTextsSchema = z.object({
  signature: z.object({ tr: z.string(), en: z.string() }).optional(),
  motivation: z.object({ tr: z.array(z.string()), en: z.array(z.string()) }).optional(),
  templates: z.record(z.string(), z.object({ tr: mailSchema.optional(), en: mailSchema.optional() })).optional(),
});
export const parseMailTexts = (raw: unknown) => parse(mailTextsSchema, raw, 'mail.json');
