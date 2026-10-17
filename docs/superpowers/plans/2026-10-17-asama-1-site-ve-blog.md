# Phase 1 — Site and Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish the bilingual (TR/EN) personal site and blog of Osman Güneş Özkurt as a fast, SEO-complete static site on GitHub Pages with the owner's domain. All content and settings live in files whose formats the Phase 2 admin panel will later write.

**Architecture:** An Astro static site. Posts are Markdown files with frontmatter (one folder per post with `tr.md` and `en.md`). Site settings are zod-validated JSON files. Each page is a shared component rendered twice: once for TR at the root and once for EN under `/en/`. GitHub Actions builds the site and deploys it to GitHub Pages. This plan covers **Phase 1 only** (spec §12). The admin panel (Phase 2) and the booking system (Phase 3) get their own plans. The contact form also moves to Phase 3, because it needs the Apps Script backend.

**Tech Stack:** Node 24 (installed), current stable Astro, TypeScript, `@astrojs/sitemap`, `@astrojs/rss`, `zod` (via `astro:content`), Vitest, `node-html-parser` (build-output tests), self-hosted fonts via `@fontsource/*`.

**Spec:** `docs/superpowers/specs/2026-10-17-kisisel-site-design.md` (Turkish). Phase 1 uses §4, §5, §6 (site, hosting and content parts), §9, §10 and §12.

## Global Constraints

- Every page exists in TR (root) and EN (`/en/`). Each page links to its counterpart with `hreflang` and `x-default` pointing to TR (§5, §9).
- Every post must have both `tr.md` and `en.md`. A post missing one language **fails the build** (§8.1: a post can't be published without both languages).
- Visual identity (§4): cream background, dark forest green primary, sage green surfaces, serif headings, sans-serif body, leaf line drawings, soft rounded cards, organic portrait frame, handwritten slogan "Daha iyi bir yaşam mümkün." / "A better life is possible." Light theme only.
- No address, office, city or "yüz yüze" (in-person) wording anywhere. Service is online only (§3, §4).
- No "NFC" section. No digital products. No cookie-based analytics, so no cookie banner (§9).
- Fonts are self-hosted, with no requests to Google Fonts (KVKK, §3 anti-goal on third parties). Fonts must support Turkish characters (ğ ş ı İ ç ö ü).
- Mobile Lighthouse Performance, SEO and Accessibility scores ≥ 90 (§9).
- Pages work fully without JavaScript. Category filtering uses real category pages, not client-side JS.
- URLs end with a trailing slash (`trailingSlash: 'always'`, `build.format: 'directory'`).
- Placeholder portrait until the owner uploads a real photo. Title text comes from `profile.json`. Do not hard-code "Psikolog" or "Klinik Psikolog" (§4).
- The "Randevu Al" button links to `/randevu/` (`/en/appointment/`). In Phase 1 that page explains booking is coming soon and offers an e-mail button (§12).

## Review Focus

1. **A post folder with only one language file.** The build fails with a message naming the folder and the missing language. Owned by Task 3.
2. **Turkish characters in titles and slugs** ("İlişkiler", "Kaygı ile Yaşamak: Düşman mı?"). Slugs are lowercased with Turkish rules and transliterated (`iliskiler`, `kaygi-ile-yasamak-dusman-mi`), never `i̇liskiler` and never with stray dashes. Owned by Task 2.
3. **A post without a cover image.** The page still builds, `og:image` falls back to the default share image from `seo.json`, and the post card shows a sage placeholder. Owned by Tasks 3 and 6.
4. **The language switch on a post page.** It must go to that post's translation (which has a different slug), not to `/en/blog/<tr-slug>/` (404). Owned by Task 6.
5. **A narrow phone (360 px) with a long Turkish word in a title.** No horizontal scroll, and the text wraps. Owned by Task 4 (CSS) and Task 9 (manual check).

---

## File Structure

```
web sitem/
├─ package.json, astro.config.mjs, tsconfig.json, vitest.config.ts
├─ .github/workflows/deploy.yml
├─ public/  CNAME, favicon.svg, og-default.jpg
├─ docs/kurulum/alan-adi-ve-yayin.md          # Turkish setup guide for the owner
├─ src/
│  ├─ content.config.ts                        # posts collection schema
│  ├─ content/posts/<key>/{tr.md,en.md,cover.webp}
│  ├─ data/                                    # public settings (Phase 2 panel writes these)
│  │  profile.json links.json home.json about.json contact.json
│  │  resources.json categories.json seo.json redirects.json
│  │  legal/{aydinlatma,gizlilik}.{tr,en}.md
│  ├─ i18n/ ui.ts  routes.ts
│  ├─ lib/ slug.ts readingTime.ts settings.ts posts.ts seo.ts jsonld.ts
│  ├─ styles/ tokens.css global.css
│  ├─ components/ Seo.astro Header.astro Footer.astro LangSwitch.astro Leaf.astro
│  │  Hero.astro LinkCard.astro PostCard.astro AuthorBox.astro CategoryNav.astro
│  │  NewsletterBox.astro ResourceCard.astro Timeline.astro
│  ├─ layouts/ BaseLayout.astro
│  ├─ views/  HomeView AboutView BlogListView PostView ResourcesView ContactView
│  │  AppointmentView LegalView NotFoundView (.astro, each takes `lang`)
│  └─ pages/  (thin wrappers, see Task 5/6/7)
└─ tests/ unit/*.test.ts  build/*.test.ts
```

Route map (single source: `src/i18n/routes.ts`):

| key | TR | EN |
|---|---|---|
| home | `/` | `/en/` |
| about | `/hakkimda/` | `/en/about/` |
| blog | `/blog/` | `/en/blog/` |
| category | `/blog/kategori/<tr-slug>/` | `/en/blog/category/<en-slug>/` |
| post | `/blog/<tr-slug>/` | `/en/blog/<en-slug>/` |
| resources | `/kaynaklar/` | `/en/resources/` |
| contact | `/iletisim/` | `/en/contact/` |
| appointment | `/randevu/` | `/en/appointment/` |
| privacyNotice | `/aydinlatma-metni/` | `/en/privacy-notice/` |
| privacyPolicy | `/gizlilik/` | `/en/privacy-policy/` |

---

### Task 1: Project scaffold, git and test harness

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/pages/index.astro` (temporary), `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces:
  - `npm run build` builds the real site from `src/content/posts` and `src/data` into `dist/`.
  - `npm test` runs the unit tests (`tests/unit`).
  - `npm run test:build` = `cross-env CONTENT_DIR=tests/fixtures/content DATA_DIR=tests/fixtures/data astro build --outDir dist-test && vitest run tests/build`. **Build tests always run against fixture content**, never the owner's real posts, so real content can change freely. Fixture builds use the default `SITE_URL` `https://example.com`. Production sets `SITE_URL` in Task 9.

- [ ] **Step 1:** `git init` in `web sitem/`. Scaffold Astro minimal TypeScript-strict in place (`npm create astro@latest . -- --template minimal --typescript strict --no-install --no-git`), then `npm install`. Add `vitest`, `node-html-parser`, `cross-env`, `@astrojs/sitemap`, `@astrojs/rss`. Add `dist-test/` to `.gitignore`.
- [ ] **Step 2:** Configure `astro.config.mjs`: `site: process.env.SITE_URL ?? 'https://example.com'`, `trailingSlash: 'always'`, `build: { format: 'directory' }`, `i18n: { locales: ['tr','en'], defaultLocale: 'tr', routing: { prefixDefaultLocale: false } }`, sitemap integration with `i18n: { defaultLocale: 'tr', locales: { tr: 'tr-TR', en: 'en-US' } }`.
- [ ] **Step 3:** Write `tests/unit/smoke.test.ts` asserting `1 + 1 === 2`. Run `npm test`. Expected: 1 passed.
- [ ] **Step 4:** Run `npm run build`. Expected: exit 0, `dist/index.html` exists.
- [ ] **Step 5:** Commit the existing `docs/` together with the scaffold: `git add . && git commit -m "chore: scaffold Astro site with test harness"`.

### Task 2: Shared utilities — slug and reading time

**Files:**
- Create: `src/lib/slug.ts`, `src/lib/readingTime.ts`
- Test: `tests/unit/slug.test.ts`, `tests/unit/readingTime.test.ts`

**Interfaces:**
- Produces: `slugify(text: string, lang: 'tr' | 'en'): string`, `readingTime(markdown: string): number` (minutes, integer ≥ 1). Phase 2 reuses `slugify` in the editor.

- [ ] **Step 1: Write failing tests**

```ts
expect(slugify('Kaygı ile Yaşamak: Düşman mı?', 'tr')).toBe('kaygi-ile-yasamak-dusman-mi');
expect(slugify('İlişkiler ve Sınırlar', 'tr')).toBe('iliskiler-ve-sinirlar');
expect(slugify('ÇOK ÖNEMLİ   ŞEY!!', 'tr')).toBe('cok-onemli-sey');
expect(slugify('Living with Anxiety — Enemy or Messenger?', 'en')).toBe('living-with-anxiety-enemy-or-messenger');
expect(slugify('  --a--  ', 'en')).toBe('a');
expect(readingTime('')).toBe(1);
expect(readingTime('kelime '.repeat(400))).toBe(2);   // 200 words/min, rounded up
expect(readingTime('# Başlık\n\n![alt](x.webp)\n\n' + 'söz '.repeat(201))).toBe(2); // markdown syntax and image refs not counted
```

- [ ] **Step 2:** Run `npx vitest run tests/unit/slug.test.ts tests/unit/readingTime.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement both. For `slugify`: `toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US')`, map `ç ğ ı ö ş ü` → `c g i o s u`, NFKD and strip combining marks, then replace non-`[a-z0-9]` runs with `-` and trim dashes. For `readingTime`: strip markdown syntax and image/link URLs, count whitespace-separated words, `Math.max(1, Math.ceil(words / 200))`.
- [ ] **Step 4:** Run the tests again. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add Turkish-aware slugify and reading time`.

### Task 3: Content model — posts collection, settings files, validation

**Files:**
- Create: `src/content.config.ts`, `src/lib/settings.ts`, `src/lib/posts.ts`, all files in `src/data/` (real seed: `redirects.json` = `[]`, no `gscVerification`), `src/content/posts/.gitkeep` (no real posts yet), the fixture copies `tests/fixtures/data/*` (same files plus the test-only values named in Tasks 6–7) and the fixture post `tests/fixtures/content/ornek-kucuk-adimlar/{tr.md,en.md,cover.webp}`
- Test: `tests/unit/settings.test.ts`, `tests/unit/posts.test.ts`

Settings are read with `fs` from `process.env.DATA_DIR ?? 'src/data'`. The posts glob loader `base` is `process.env.CONTENT_DIR ?? 'src/content/posts'`. Every page must build with zero posts (empty states).

**Interfaces:**
- Produces (types in `src/lib/settings.ts`):
  - `type Lang = 'tr' | 'en'`; `type Localized = { tr: string; en: string }`
  - `getProfile(): Profile` — `{ name: string; title: Localized; tagline: Localized; intro: Localized; photo: string | null; photoAlt: Localized }`
  - `getLinks(): Link[]` — `{ id: string; label: string; url: string; icon: 'instagram'|'linkedin'|'medium'|'substack'|'email'|'youtube'|'x'; inHero: boolean; inFooter: boolean }`
  - `getHome(): { cards: HomeCard[] }` — `HomeCard = { id: string; target: { page: RouteKey } | { url: string }; title: Localized; subtitle: Localized; icon: string; visible: boolean }`
  - `getAbout()`: `{ heading: Localized; lead: Localized; areas: { icon: string; label: Localized }[]; whoAmI: Localized /* markdown */; whyThisWork: Localized; quote: Localized; timeline: { title: Localized; detail: Localized; period: string }[] }`
  - `getContact()`: `{ intro: Localized; workStyle: Localized; responseTime: Localized; emergencyNote: Localized; email: string }`
  - `getResources(): Resource[]` — `{ id; type: 'book'|'article'|'scale'|'video'|'podcast'|'guide'; title: string; author?: string; note: Localized; url: string; cover?: string; featured: boolean }`
  - `getCategories(): Category[]` — `{ id: string; slug: Localized; label: Localized }`. Seed: zihinsel-saglik/mental-health, psikoloji/psychology, terapi/therapy, yasam/life, duygular/emotions, arastirma/research.
  - `getSeo()`: `{ siteName: Localized; defaultDescription: Localized; ogImage: string; gscVerification?: string }`
  - `getRedirects(): { from: string; to: string }[]`
  - Each getter parses with zod and throws a message naming the file and the field.
- Post frontmatter schema (`content.config.ts`, glob loader `**/{tr,en}.md`, entry id `<key>/<lang>`): `title: string`, `seoTitle?: string`, `description: string` (meta), `slug: string`, `focusKeyword: string`, `category: string` (must be a `categories.json` id), `cover?: image()`, `coverAlt?: string`, `publishedAt: date`, `updatedAt?: date`.
- `src/lib/posts.ts`:
  - `getPosts(lang: Lang): Promise<PostEntry[]>`, sorted newest first
  - `getTranslation(post: PostEntry): Promise<PostEntry>`
  - `getRelated(post: PostEntry, n = 3): Promise<PostEntry[]>`, same category first, then newest
  - `validatePostPairs(ids: string[]): void`, which throws `Yazı "<key>" için <lang>.md eksik — her yazı iki dilde olmalı.`
  - `PostEntry` adds `key: string`, `lang: Lang`, `readingMinutes: number`

- [ ] **Step 1: Write failing tests**

```ts
// settings.test.ts — real seed files parse
expect(() => getProfile()).not.toThrow();
expect(getCategories().map(c => c.id)).toContain('zihinsel-saglik');
// broken data names the field
expect(() => parseProfile({ name: 'x' })).toThrow(/profile\.json.*title/);
// posts.test.ts
expect(() => validatePostPairs(['a/tr', 'a/en', 'b/tr'])).toThrow('Yazı "b" için en.md eksik');
expect(() => validatePostPairs(['a/tr', 'a/en'])).not.toThrow();
```

- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Write the schemas, getters (`parseX(raw)` exported for tests, `getX()` = `parseX(readJson(DATA_DIR, file))`) and seed data. Seed copy comes from the mock-ups in spec §4 with locations removed. Profile `name: "Osman Güneş Özkurt"`, `title: { tr: "Psikolog", en: "Psychologist" }` (the owner will correct it later). The fixture post is "Daha İyi Bir Yaşam İçin Küçük Adımlar" / "Small Steps Towards a Better Life", with a cover image. Call `validatePostPairs` from `getPosts` so any page build fails on a missing pair. Seed legal markdown files with a clearly marked placeholder: "Bu metin hukuki içerik eklenene kadar taslaktır."
- [ ] **Step 4:** Run the tests. Expected: PASS. Then temporarily delete `en.md` from the fixture post and run `npm run test:build`. Expected: the build fails with the "eksik" message. Restore the file. Run `npm run build` (real content, zero posts). Expected: exit 0.
- [ ] **Step 5:** Commit `feat: add content model, settings files and validation`.

### Task 4: Design system and base layout with SEO head

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/i18n/ui.ts`, `src/i18n/routes.ts`, `src/lib/seo.ts`, `src/lib/jsonld.ts`, `src/components/{Seo,Header,Footer,LangSwitch,Leaf}.astro`, `src/layouts/BaseLayout.astro`
- Test: `tests/unit/routes.test.ts`, `tests/unit/seo.test.ts`

**Interfaces:**
- `routes.ts`: `type RouteKey = 'home'|'about'|'blog'|'resources'|'contact'|'appointment'|'privacyNotice'|'privacyPolicy'`; `pathFor(key: RouteKey, lang: Lang): string`; `categoryPath(cat: Category, lang): string`; `postPath(slug: string, lang): string`.
- `ui.ts`: `t(lang: Lang, key: UiKey): string`. All fixed interface strings live here (nav labels, "Randevu Al"/"Book a Session", "dk okuma"/"min read", "Tüm Yazılar"/"All Posts", footer slogan …).
- `seo.ts`: `buildMeta(input: { lang: Lang; title: string; description: string; path: string; alternates: { tr: string; en: string }; image?: string; type?: 'website'|'article' }): Meta`, where `Meta = { title: string; description: string; canonical: string; alternates: { hreflang: string; href: string }[]; og: Record<string,string> }`. `og` holds `og:title`, `og:description`, `og:url`, `og:image`, `og:type`, `og:locale` (`tr_TR`/`en_US`), `og:locale:alternate` and `twitter:card` = `summary_large_image`. The title is formatted as `"<title> | <siteName[lang]>"`, except the home page uses the site name alone. Absolute URLs are built from `Astro.site`.
- `jsonld.ts`: `personLd(lang)`, `professionalServiceLd(lang)` (`areaServed: "Online"`, `availableChannel` online, **no `address`**), `blogPostingLd(post, translationUrl)`, `breadcrumbLd(items: {name: string; url: string}[])`. Each returns a plain object.
- `BaseLayout.astro` props: `{ lang: Lang; meta: Meta; jsonLd?: object[]; alternatePaths: { tr: string; en: string } }`. It renders `<html lang>`, `Seo`, `Header` (logo, nav, "Randevu Al" pill, LangSwitch to `alternatePaths[otherLang]`), `<main>`, and `Footer` (inFooter links, slogan, ©, "Başa Dön").

- [ ] **Step 1: Write failing tests**

```ts
expect(pathFor('about', 'en')).toBe('/en/about/');
expect(pathFor('home', 'tr')).toBe('/');
expect(postPath('kaygi-ile-yasamak', 'tr')).toBe('/blog/kaygi-ile-yasamak/');
const m = buildMeta({ lang:'tr', title:'Hakkımda', description:'d', path:'/hakkimda/', alternates:{ tr:'/hakkimda/', en:'/en/about/' } });
expect(m.canonical).toBe('https://example.com/hakkimda/');
expect(m.alternates).toEqual([
  { hreflang:'tr', href:'https://example.com/hakkimda/' },
  { hreflang:'en', href:'https://example.com/en/about/' },
  { hreflang:'x-default', href:'https://example.com/hakkimda/' }]);
expect(m.og['og:image']).toBe('https://example.com/og-default.jpg'); // fallback when no image
expect(JSON.stringify(professionalServiceLd('tr'))).not.toContain('address');
```

- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Tokens: `--cream`, `--paper`, `--forest` (dark green, roughly `#2F4A3A`), `--sage`, `--sage-soft`, `--ink`, `--muted`, radii, spacing, plus font families (serif heading such as Fraunces or Cormorant, sans body such as Inter or DM Sans, hand such as Caveat, all via `@fontsource`, Turkish subsets). Global CSS: `overflow-wrap: anywhere` on headings and card titles, `img { max-width: 100% }`, mobile-first with 16 px side gutter, visible focus ring. `Leaf.astro` is an inline SVG line drawing.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add design tokens, layout and SEO helpers`.

### Task 5: Static pages — home, about, resources, contact, appointment, legal, 404

**Files:**
- Create: `src/views/{HomeView,AboutView,ResourcesView,ContactView,AppointmentView,LegalView,NotFoundView}.astro`, the components `Hero`, `LinkCard`, `ResourceCard`, `Timeline`, and the page wrappers `src/pages/{index,hakkimda,kaynaklar,iletisim,randevu,aydinlatma-metni,gizlilik,404}.astro` plus `src/pages/en/{index,about,resources,contact,appointment,privacy-notice,privacy-policy}.astro`
- Test: `tests/build/pages.test.ts`

**Interfaces:**
- Consumes: Task 3 getters, Task 4 `BaseLayout`/`buildMeta`/`pathFor`/`t`.
- Each view takes `{ lang: Lang }`. Each wrapper is one line: `<HomeView lang="tr" />`.
- Test helper `tests/build/load.ts`: `loadPage(path: string): HTMLElement` reads `dist-test/<path>/index.html` (all build tests read `dist-test/`, including `readFileSync` paths written as `dist/...` below) and parses it with `node-html-parser`. `allPages(): string[]` lists every built HTML path.

- [ ] **Step 1: Write failing build tests**

```ts
for (const p of allPages()) {           // every page, both languages
  const d = loadPage(p);
  expect(d.querySelectorAll('h1').length).toBe(1);
  expect(d.querySelector('title')?.text.length).toBeGreaterThan(0);
  expect(d.querySelector('meta[name=description]')?.getAttribute('content')).toBeTruthy();
  expect(d.querySelector('link[rel=canonical]')?.getAttribute('href')).toMatch(/^https:\/\//);
  expect(d.querySelectorAll('img:not([alt])').length).toBe(0);
  expect(d.textContent).not.toMatch(/Lefkoşa|İstanbul|yüz yüze|NFC/i);
}
expect(loadPage('/').querySelector('html')?.getAttribute('lang')).toBe('tr');
expect(loadPage('/en/').querySelector('html')?.getAttribute('lang')).toBe('en');
expect(loadPage('/').querySelector('a.cta-primary')?.getAttribute('href')).toBe('/randevu/');
const home = loadPage('/');                // hreflang trio on paired page
expect(home.querySelector('link[hreflang=en]')?.getAttribute('href')).toBe('https://example.com/en/');
expect(home.querySelector('link[hreflang=x-default]')).not.toBeNull();
const types = home.querySelectorAll('script[type="application/ld+json"]').map(s => JSON.parse(s.text)['@type']);
expect(types).toEqual(expect.arrayContaining(['Person', 'ProfessionalService']));
expect(existsSync('dist/404.html')).toBe(true);
```

- [ ] **Step 2:** Run `npm run test:build`. Expected: FAIL.
- [ ] **Step 3:** Build the views following the mock-ups in spec §4 and its listed changes:
  - **Home:** portrait in an organic frame (placeholder when `photo` is null), name, title, handwritten slogan, intro. One dominant "Randevu Al" CTA (`.cta-primary`) and an `inHero` link row. Visible home cards in 2-column tiles (Medium and Substack are not cards). Then "Son Yazılar" with the 3 newest `PostCard`s and "Tüm Yazılar →", and the footer.
  - **About:** areas row, "Ben Kimim?", "Neden Bu Mesleği Seçtim?" and the `Timeline`.
  - **Resources:** type filter as anchor links to `#book` etc., the featured resource, the list, and the "Benim Notum" box.
  - **Contact:** channel cards (e-mail, Instagram, LinkedIn, Randevu), work style (online, response time) and the emergency note. **No form in Phase 1.**
  - **Appointment (Phase 1):** heading "Randevu Al", the text "Online randevu sistemi çok yakında burada. Şimdilik e-posta ile ulaşabilirsiniz." / EN equivalent, a `mailto:` button to `contact.email`, and a link to the contact page.
  - **Legal:** renders `src/data/legal/<name>.<lang>.md`.
  - **404:** bilingual message and links to both home pages.
- [ ] **Step 4:** Run `npm run test:build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add static pages in TR and EN`.

### Task 6: Blog — list, category pages, post page, RSS, redirects

**Files:**
- Create: `src/views/{BlogListView,PostView}.astro`, the components `PostCard`, `AuthorBox`, `CategoryNav`, `NewsletterBox`, the pages `src/pages/blog/{index,[slug]}.astro`, `src/pages/blog/kategori/[category].astro`, `src/pages/en/blog/{index,[slug]}.astro`, `src/pages/en/blog/category/[category].astro`, `src/pages/rss.xml.ts`, `src/pages/en/rss.xml.ts`, `src/pages/[...redirect].astro`
- Test: `tests/build/blog.test.ts`

**Interfaces:**
- Consumes: `getPosts`, `getTranslation`, `getRelated`, `getCategories`, `getRedirects`, `postPath`, `categoryPath`, `blogPostingLd`, `breadcrumbLd`.
- `BlogListView` props: `{ lang: Lang; category?: Category }`. `PostView` props: `{ post: PostEntry }`.
- Redirect pages: for each `{from, to}` in `redirects.json`, emit a page at `from` with `<meta http-equiv="refresh" content="0; url=<to>">`, `<link rel="canonical" href="<abs to>">` and `<meta name="robots" content="noindex">`.

- [ ] **Step 1: Write failing build tests** (the fixture post's TR slug is `daha-iyi-bir-yasam-icin-kucuk-adimlar` and its EN slug is `small-steps-towards-a-better-life`; `tests/fixtures/data/redirects.json` holds `{ "from": "/blog/eski-adres/", "to": "/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/" }`)

```ts
const tr = loadPage('/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
expect(tr.querySelector('link[hreflang=en]')?.getAttribute('href'))
  .toBe('https://example.com/en/blog/small-steps-towards-a-better-life/');
expect(tr.querySelector('a.lang-switch')?.getAttribute('href'))
  .toBe('/en/blog/small-steps-towards-a-better-life/');
const ld = tr.querySelectorAll('script[type="application/ld+json"]').map(s => JSON.parse(s.text));
const bp = ld.find(x => x['@type'] === 'BlogPosting');
expect(bp.author.name).toBe('Osman Güneş Özkurt');
expect(bp.inLanguage).toBe('tr-TR');
expect(bp.datePublished).toBeTruthy(); expect(bp.dateModified).toBeTruthy();
expect(ld.some(x => x['@type'] === 'BreadcrumbList')).toBe(true);
expect(tr.querySelector('.author-box')).not.toBeNull();
expect(tr.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article');
expect(loadPage('/blog/kategori/zihinsel-saglik/').querySelector('h1')).not.toBeNull();
expect(loadPage('/en/blog/category/mental-health/').querySelector('html')?.getAttribute('lang')).toBe('en');
expect(readFileSync('dist/rss.xml','utf8')).toContain('<language>tr</language>');
expect(readFileSync('dist/en/rss.xml','utf8')).toContain('small-steps-towards-a-better-life');
const r = loadPage('/blog/eski-adres/');
expect(r.querySelector('meta[http-equiv=refresh]')?.getAttribute('content'))
  .toBe('0; url=/blog/daha-iyi-bir-yasam-icin-kucuk-adimlar/');
// a post without cover still builds with the default og:image (second seed post, no cover)
expect(loadPage('/blog/kapaksiz-ornek/').querySelector('meta[property="og:image"]')?.getAttribute('content'))
  .toBe('https://example.com/og-default.jpg');
```

- [ ] **Step 2:** Run `npm run test:build`. Expected: FAIL.
- [ ] **Step 3:** Add a second fixture post `kapaksiz-ornek` (TR slug `kapaksiz-ornek`, EN slug `no-cover-example`, no cover), then build the pages:
  - **Blog list:** heading, `CategoryNav` as links to category pages (current category highlighted), a grid of `PostCard`s (cover or sage placeholder, category chip, title, description, date in `tr-TR`/`en-US` long format, "N dk okuma"), and `NewsletterBox` linking to the Substack link from `links.json`.
  - **Post page:** breadcrumb, category, H1, date, "Son güncelleme" when `updatedAt` is set, reading time, cover, Markdown body, `AuthorBox` (photo, name, title, one-line intro, link to the about page), "İlgili Yazılar", and the language switch to the translation.
  - Category pages are generated for every category in both languages, even when empty ("Bu kategoride henüz yazı yok").
- [ ] **Step 4:** Run `npm run test:build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add bilingual blog, categories, RSS and redirects`.

### Task 7: Sitemap, robots, verification tag

**Files:**
- Create: `src/pages/robots.txt.ts`
- Modify: `astro.config.mjs` (sitemap `filter` to exclude redirect pages and 404), `src/components/Seo.astro` (GSC tag)
- Test: `tests/build/seo-files.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
const sm = readFileSync('dist/sitemap-0.xml','utf8');
expect(sm).toContain('https://example.com/en/about/');
expect(sm).toContain('hreflang="tr-TR"');
expect(sm).not.toContain('/blog/eski-adres/');
expect(sm).not.toContain('404');
expect(readFileSync('dist/robots.txt','utf8')).toContain('Sitemap: https://example.com/sitemap-index.xml');
```
Also: when `seo.json` has `gscVerification`, the home page has `meta[name=google-site-verification]`. Set it to `"test-code"` in `tests/fixtures/data/seo.json` only.

- [ ] **Step 2:** Run the tests. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: add sitemap filtering, robots.txt and GSC tag`.

### Task 8: Quality pass — performance, accessibility, mobile

**Files:**
- Modify: any view, component or style that fails the checks below
- Create: `tests/build/a11y-basics.test.ts`

- [ ] **Step 1: Write failing tests** for what HTML can show: every `<a>` has text or `aria-label`; every page has a skip link `a[href="#main"]`; no `<img>` above the fold on home is `loading="lazy"` (the portrait); other images use `loading="lazy"` and have `width`/`height` set; no external `<link>`/`<script>` to `fonts.googleapis.com` or any other host than the site.
- [ ] **Step 2:** Run the tests and fix the failures until they pass.
- [ ] **Step 3:** Run `npx astro preview` and Lighthouse (mobile) on `/`, `/blog/`, the sample post and `/en/`. Expected: Performance, SEO and Accessibility ≥ 90 on each. Record the scores in the commit message.
- [ ] **Step 4:** Check manually in the browser at 360 px and 1280 px widths on the same four pages: no horizontal scroll, long titles wrap, the CTA is visible without scrolling on a 360×740 viewport. Compare side by side with the PDF mock-ups (spec §4) for colour, typography and layout spirit.
- [ ] **Step 5:** Commit `perf/a11y: pass Lighthouse ≥90 and mobile checks (scores: …)`.

### Task 9: Deploy — GitHub Pages, domain, owner guide

**Files:**
- Create: `.github/workflows/deploy.yml`, `public/CNAME`, `docs/kurulum/alan-adi-ve-yayin.md`

**Needs from the owner (ask before starting this task):** the domain name; a GitHub account (creating it is the owner's job); the owner to create an empty **public** repository and grant access or push themselves. `gh` CLI is not installed, so the owner does these steps on github.com, following the guide.

- [ ] **Step 1:** Workflow: on push to `main`, set up Node 24, `npm ci`, `npm test`, `npm run test:build` (fixtures, default URL), then `npm run build` with `SITE_URL=https://<domain>` and deploy `dist/` with `actions/upload-pages-artifact` + `actions/deploy-pages`. A failing test blocks the deploy.
- [ ] **Step 2:** Set `public/CNAME` to the domain. Run `SITE_URL=https://<domain> npm run build` locally. Expected: `dist/robots.txt` names `https://<domain>/sitemap-index.xml`.
- [ ] **Step 3:** Write `docs/kurulum/alan-adi-ve-yayin.md` in plain Turkish, for a non-technical reader:
  - Create the GitHub repository and push.
  - Settings → Pages → Source: GitHub Actions.
  - In the domain's DNS (most likely Squarespace Domains, the former Google Domains): A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; AAAA `2606:50c0:8000::153` … `8003::153`; CNAME `www` → `<kullanici>.github.io`. **Do not touch the MX records of Google Workspace** (shown as a warning box).
  - Enter the custom domain in GitHub and tick "Enforce HTTPS".
  - Add the site to Google Search Console and copy the code into `seo.json` (until Phase 2, Claude does this).
  - Include a "Yazı yayın düzeni" section: publish on the site first, import into Medium with "Import a story" (adds the canonical automatically), and put only a summary or a different version on Substack (spec §9).
  - Verify the IP addresses against GitHub's current documentation when writing the guide.
- [ ] **Step 4:** After the owner completes the guide: push and check that the Actions run is green, `https://<domain>/` and `https://<domain>/en/` load over HTTPS, `www` redirects to the apex, and Google Workspace mail still arrives (send a test mail).
- [ ] **Step 5:** Commit `ci: deploy to GitHub Pages with custom domain`.
