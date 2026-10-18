# Site F — Pages: Home, Blog, Post, Other Pages, FAQ, Author Meta, Home-Screen App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship stages 4–7 of the site redesign. Every page moves to the new design: app-like on phones, the wide layout on desktop. The plan also adds the FAQ page, the author metadata, the read-count plumbing and the optional home-screen app manifest.

**Architecture:**
- **Views:** each view in `src/views/` composes the Plan E building blocks (`src/components/ui/*`, `brand/*`, `ThemeToggle`).
- **Phone vs desktop:** one markup per page, laid out mobile-first. At ≥ 768px a desktop layout takes over: the header with nav and a segmented theme toggle, and grids.
- **Read counts:** fetched once at build time from a configurable URL. A daily scheduled deploy keeps them fresh.

**Tech Stack:** Astro 7, CSS, small inline scripts, Vitest build tests (`tests/build`), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-18-site-yeniden-tasarim-design.md` (§5.5–5.12, §10). Visual references are in `docs/superpowers/specs/assets/2026-10-18-site/`:
- `canli-anasayfa-2.html` (phone home, primary)
- `biolink-8.html` (phone home without photo)
- `portre-ayri.html` (style 2)
- `anasayfa-masaustu.html`, `blog.html`, `blog-mobil-6.html`, `diger-sayfalar-2.html`

Plans D and E come first.

## Global Constraints

- Everything in Plan E's Global Constraints applies: palette, contrast, flat symmetric sun, SVG flags, small visitor JS, TR+EN, green suites, commit trailer, no push without the owner's OK.
- Phone breakpoint < 768px. Phone pages have no hamburger menu (spec §5.5).
- **Sticky CTA:** `afterTopCta` on the home page; `always` on every other page.
- **Read count:**
  - format: < 1000 as is ("980"); ≥ 1000 as "1,2B", "12,5B", "1,2M" (TR); "1.2K", "12.5K", "1.2M" (EN). The label is "okunma" / "reads";
  - hidden below 50;
  - hidden when no data.
- **Post byline** (left-aligned, no TPD): "Osman Güneş Özkurt · Klinik Psikolog", then "date · N dk okuma · 👁 count okunma".
- **Page end:** the 112 line plus "© {year} klinikterapist.com · Tüm hakları saklıdır." on every page.
- **Never shown:** testimonials, star ratings or discount wording anywhere.

## Review Focus

- **Profile with no photo** (fallback). Expect: the phone home uses the sun layout (`biolink-8.html`), and the desktop hero shows the big sun with its halo. Tested in Task 1.
- **The stats endpoint is down or slow at build time.** Expect: the build still succeeds within ~5 s extra, and no counts are shown anywhere. Tested in Task 4.
- **No featured posts and no counts.** Expect: the "Popüler yazılar" tile is hidden, and "Tüm blog yazıları" spans the row. On the blog page, "Konular" spans the row. Tested in Tasks 1 and 3.
- **An English page.** Expect: every new string in English, the flag switch shows TR, the read count says "1.2K reads", and the FAQ route is `/en/faq/`. Tested in Tasks 1, 4 and 6.
- **A blog with zero posts** (the real site today). Expect: the phone home skips the "Yeni yazı" card, and the blog page shows a friendly empty state, not broken tiles. Tested in Tasks 1 and 3.

---

### Task 1: Home: phone (both portrait styles, no-photo) and desktop

**Files:**
- Rewrite: `src/views/HomeView.astro`
- Create:
  - `src/components/home/PortraitHero.astro`: `style: 'background' | 'round' | 'none'`
  - `src/components/home/DesktopHero.astro`
  - `src/components/home/ProcessSteps.astro`
- Modify: `src/components/Header.astro` (desktop header: sun + name/title, nav, segmented ThemeToggle, LangSwitch, "Randevu Al"; hidden under 768px), `src/components/Footer.astro`
- Remove when unused: `Hero.astro`, `LinkCard.astro`
- Test: `tests/build/home.test.ts` (new), `tests/build/pages.test.ts`

**Interfaces:**
- Consumes: `getProfile()` (`heroStyle`, `photo`, `memberships`, `intro`, `tagline`), `getLinks()` (`note`), `getHome()` (cards, `process`), `getFaq(lang)`, posts (newest, featured), and `readCount(path)` from Task 4 (until Task 4 lands, a stub returning `null`).
- Phone order (spec §5.6):
  1. PortraitHero
  2. name, title + "Online görüşme", TPD line if `memberships` is non-empty
  3. intro
  4. `#top-cta` "Randevu Al"
  5. Accordion "Sosyal medyada takip et": links without email, in file order, 26px icons, names only; `note` as a badge with the GB flag when `note` exists; X labelled "X (Twitter)" (rename the X entry's label in `links.json` to "X (Twitter)")
  6. newest-post ListItem (skipped when there are no posts)
  7. TilePair: Tüm blog yazıları (from the `blog` card) + Popüler yazılar (hidden when there is nothing to show)
  8. Accordion "Sık sorulan sorular": nested `<details>` per answered question; the whole accordion is hidden if none
  9. ListItem for each visible card except `blog` and `contact` (Hakkımda, Kaynaklar)
  10. ListItem "Bültene abone ol" (Substack link from `links.json`; hidden if there is no Substack link)
  11. PageEnd
  12. StickyCta `afterTopCta`
- PortraitHero `background`:
  - sticky photo at `min(64vh, 430px)`, `object-position: center 25%`;
  - a fade into `var(--bg)`;
  - TopBar chips over the photo with a translucent white chip style;
  - the card overlaps by 64px with 28px top radius;
  - SunMark in a bg-coloured circle overlapping the card edge.
- PortraitHero `round`: a 112px round photo with a SunMark badge bottom-right.
- PortraitHero `none`: a 96px surface circle containing SunMark.
- Desktop: DesktopHero (tagline as h1; intro; "Randevu Al" + "İlk görüşme nasıl geçer?" → `/sik-sorulan-sorular/#ilk-gorusme`; TPD + response-time line), latest 3 posts + TilePair, ProcessSteps (from `home.process`; the section is hidden if empty), FAQ list + "Merhaba, ben Osman" card (→ about), newsletter band, Footer.
- DesktopHero right side:
  - `background` style: a large rounded-rect portrait with a SunMark badge;
  - `round` style: a round portrait with a badge;
  - no photo: the big SunMark with a radial halo glow.

- [ ] **Step 1: Write the failing tests** (`home.test.ts`, fixture build; the fixture data gets a photo, `heroStyle`, one membership, links with a note, and two answered FAQs):
  - `'phone home order'`: the DOM order of `#top-cta`, the social accordion, the FAQ accordion, Hakkımda and Kaynaklar matches.
  - `'social accordion lists every non-email link with notes'`: it contains "X (Twitter)" and an "İngilizce" badge with an svg flag.
  - `'portrait styles'`: three fixture variants via env `PROFILE_FIXTURE=background|round|none`, or by building the component in a test page. Expect: `.portrait-hero--background img`, `.portrait-hero--round img + .sun-badge`, and `.portrait-hero--none svg`.
  - `'popular tile hidden with no featured and no counts'`.
  - `'no posts: no new-post card'` (built with an empty posts fixture dir).
  - `'EN home'`: `/en/` shows "Follow on social media" and a TR flag switch.
  - `'sticky CTA'`: the home page has `data-mode="afterTopCta"`.
- [ ] **Step 2: Run** `npm run test:build`. Expected: FAIL.
- [ ] **Step 3: Implement** to match `canli-anasayfa-2.html` (phone) and `anasayfa-masaustu.html` (desktop).
- [ ] **Step 4: Run all suites.** Expected: PASS.
- [ ] **Step 5: Check in the browser** at 375px and 1280px, in both themes and all three portrait styles (switch `profile.json` locally; do not commit the switch). Verify the sticky photo and card scroll, and the CTA appearance. Test with iPhone emulation, including `env(safe-area-inset-bottom)`. Take screenshots.
- [ ] **Step 6: Commit.** Message: `feat(site): new home page (phone bio link, desktop)`.

### Task 2: Shared page shell for all other pages

**Files:**
- Create: `src/layouts/PageShell.astro`. It is BaseLayout plus: on phones a TopBar (logo or back), on desktop the Header, and in every layout the PageEnd and a StickyCta (`always`).
- Modify:
  - `src/views/ContactView.astro`, `AboutView.astro`, `ResourcesView.astro`, `AppointmentView.astro`, `LegalView.astro`, `NotFoundView.astro`: use PageShell; the content restyle comes in Task 5
  - `src/components/Breadcrumb.astro`: kept on desktop only
- Test: `tests/build/pages.test.ts`

- [ ] **Step 1: Write the failing tests.**
  - Every non-home page has the wordmark link to `/` (or `/en/`) in the phone TopBar, a `StickyCta` with `data-mode="always"`, the PageEnd with "112", and the desktop Header.
  - The post page TopBar shows "← Blog" instead of the logo.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all suites.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(site): shared page shell with top bar, page end and sticky CTA`.

### Task 3: Blog list (phone + desktop) with client-side search and filter

**Files:**
- Rewrite: `src/views/BlogListView.astro`
- Modify: `src/components/PostCard.astro` (phone ListItem style; desktop card), `src/components/CategoryNav.astro` (phone accordion "Konular"; desktop chips), `src/components/NewsletterBox.astro` (box style)
- Create: `src/components/blog/BlogSearch.astro` (input plus a small inline script that filters `[data-post]` items by title and category text, case- and diacritic-insensitive for Turkish)
- Test: `tests/build/blog.test.ts`, `tests/unit/search-fold.test.ts` (new)

**Interfaces:**
- `foldTr(s: string): string` in `src/lib/search.ts` (lowercase `tr-TR`, strip combining marks). It is also inlined into the search script at build time to avoid a duplicate implementation; export it and serialise it.

- [ ] **Step 1: Write the failing tests.**
  - `search-fold`: `foldTr('İLİŞKİ')` equals `foldTr('ilişki')`, and `foldTr('Kaygı')` contains `'kaygi'` after the dotless-ı mapping.
  - `blog.test.ts`:
    - the phone list shows a big newest-post card, the "Popüler yazılar · Konular" pair (Popüler hidden in the fixture unless featured), ListItems with read count only where count ≥ 50, and the newsletter box;
    - the desktop part has chips and a featured card;
    - an empty-blog fixture shows the empty state text.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** to match `blog-mobil-6.html` (left phone) and `blog.html` (list).
- [ ] **Step 4: Run all suites.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(site): blog list redesign with search and filters`.

### Task 4: Read counts, popular posts and the daily rebuild

**Files:**
- Create:
  - `src/lib/read-counts.ts`
  - `src/lib/format-count.ts`
- Modify:
  - `.github/workflows/deploy.yml`: add `schedule: - cron: '17 3 * * *'` (≈06:17 Istanbul) next to `push`/`workflow_dispatch`
  - `astro.config.mjs` / env: `STATS_URL` (optional; empty means no counts)
- Test: `tests/unit/format-count.test.ts`, `tests/unit/read-counts.test.ts` (new)

**Interfaces:**
- `formatCount(n: number, lang: Lang): string | null`:
  - returns null when `n < 50`;
  - TR: `980` → "980", `1248` → "1,2B", `12500` → "12,5B", `1200000` → "1,2M";
  - EN: "1.2K", "12.5K", "1.2M";
  - one decimal, trailing ",0" / ".0" dropped (`2000` → "2B" / "2K").
- `readCountLabel(n, lang)`: "1,2B okunma" / "1.2K reads".
- `loadReadCounts(): Promise<Map<string, number>>`:
  - fetches `STATS_URL` once per build (memoised), 4 s timeout;
  - expects `{ counts: Record<path, number> }` where paths are site paths (both languages);
  - on any error or a missing URL, returns an empty map and logs one warning.
- `readCount(postKey)` sums the TR and EN paths of that post.
- `popularPosts(limit = 5)`: posts sorted by count when the map has entries; otherwise `featured: true` posts; otherwise `[]`.
- **Plan C note:** Plan C must add a public, read-only `stats.reads` action that returns `{ counts }` with per-path read totals and nothing else. Record this as a dependency line in Plan C's Task C5 when Plan C runs. Until then `STATS_URL` stays empty and nothing shows.

- [ ] **Step 1: Write the failing tests.**
  - The `formatCount` cases above, `49` → null, `50` → "50".
  - `loadReadCounts`: with a fake fetch resolving `{ counts: {'/blog/a/': 40, '/en/blog/a-en/': 30} }`, `readCount('a')` → 70. A timeout or rejection → an empty map with no throw. An empty URL → no fetch.
  - `popularPosts`: with an empty map, featured posts are returned; with neither, `[]`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Wire `readCount` into Tasks 1 and 3, and into Task 5's post page, replacing the stub.
- [ ] **Step 4: Run all suites.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(site): read counts, popular posts and daily rebuild`.

### Task 5: Post page and other pages restyle

**Files:**
- Rewrite: `src/views/PostView.astro`
- Modify:
  - `src/components/References.astro`: wrapped in an Accordion "Kaynakça" / "References" (open by default on desktop, closed on phones)
  - `src/components/AuthorBox.astro`: centred box with SunMark or photo, name, "Klinik Psikolog · {memberships[0].org}", shortIntro, "Randevu Al"
  - `src/styles/prose.css`: Fraunces body at `SOFT` 50, 18–19px, 1.7; quote box with the sunflower rule; drop-cap colour hooks `var(--dropcap)` for Plan B
  - `src/views/AboutView.astro`, `ResourcesView.astro`, `ContactView.astro`, `AppointmentView.astro`, `LegalView.astro`, `NotFoundView.astro`: spec §5.9 layouts
- Create: `src/components/post/ShareButton.astro` (button "Yazıyı paylaş"; inline script: `navigator.share` → fallback `navigator.clipboard.writeText` with a "Bağlantı kopyalandı" status message in an `aria-live` region)
- Test: `tests/build/blog.test.ts`, `tests/build/pages.test.ts`

- [ ] **Step 1: Write the failing tests.**
  - Post page:
    - the byline is left-aligned (has class `byline--left`) and has no "Türk Psikologlar";
    - the meta line has the reading time and, in the fixture with counts, "1,2B okunma";
    - the 16:9 cover keeps the existing `.cover` class;
    - the Kaynakça accordion contains the references list;
    - the share button exists;
    - the author box contains the membership org;
    - similar posts are listed.
  - About: accordions "Ben kimim?", "Bu işi neden yapıyorum?", "Eğitim ve deneyim", the areas TilePairs, and the TPD line.
  - Resources: the featured card, the six type tiles linking to `#tur-<type>`, and per-type accordions with those ids.
  - Contact: a big CTA, the e-mail ListItem, the "Online görüşme" / "Dönüş süresi" pair, the social accordion, TPD, and the dashed emergency box with `emergencyNote`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement** to match `blog-mobil-6.html` (post) and `diger-sayfalar-2.html`.
- [ ] **Step 4: Run all suites.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(site): post page and inner pages redesign`.

### Task 6: FAQ page, author metadata, home-screen app

**Files:**
- Modify:
  - `src/lib/schemas.ts` `PAGE_KEYS` (add `faq`)
  - `src/i18n/routes.ts` (`faq: { tr: '/sik-sorulan-sorular/', en: '/en/faq/' }`)
  - `src/i18n/ui.ts`
  - `src/lib/seo.ts`: `<meta name="author" content="Osman Güneş Özkurt, Klinik Psikolog">` on posts and `article:author`
  - `src/lib/jsonld.ts`: the person gets `memberOf`; the post author gets `jobTitle` and `url` (about page); FAQ page `FAQPage`
  - `src/lib/rss.ts`: item author `merhaba@klinikterapist.com (Osman Güneş Özkurt, Klinik Psikolog)`, or `dc:creator` with name and title
  - `BaseLayout.astro`: `<link rel="manifest">`, `theme-color` meta for both schemes
- Create:
  - `src/pages/sik-sorulan-sorular.astro`, `src/pages/en/faq.astro`, `src/views/FaqView.astro` (answered items as Accordions; the first item has `id="ilk-gorusme"` when its id is `ilk-gorusme`)
  - `public/manifest.webmanifest` (name "Osman Güneş Özkurt", short_name "Güneş", `display: standalone`, `background_color` and `theme_color` `#FBF3E4`, icons from Plan E Task 1 including maskable)
- Test: `tests/build/seo-files.test.ts`, `tests/unit/seo.test.ts`, `tests/build/pages.test.ts`, `tests/unit/routes.test.ts`

- [ ] **Step 1: Write the failing tests.**
  - The routes test covers `faq`.
  - Both FAQ pages are built, with `FAQPage` JSON-LD listing only answered questions.
  - The post page has `meta[name=author]` and `meta[property="article:author"]`.
  - The JSON-LD author has `jobTitle` "Klinik Psikolog" / "Clinical Psychologist" and `url` ending `/hakkimda/`.
  - The person has `memberOf.name` "Türk Psikologlar Derneği".
  - RSS items include the author.
  - `manifest.webmanifest` exists with `short_name` "Güneş" and a 512 maskable icon.
  - Every page links the manifest.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all suites and `npm run check`.** Expected: PASS, with no new type errors.
- [ ] **Step 5: Commit.** Message: `feat(site): FAQ page, author metadata, home-screen manifest`.

### Task 7: Final visual pass

- [ ] Run the dev server and capture every page at 375px and 1280px, in both themes, in TR and EN:
  - home (all three portrait styles)
  - blog
  - a fixture post
  - about, resources, contact, appointment
  - a legal page
  - 404
  - FAQ
- [ ] Check:
  - no horizontal scroll;
  - focus rings visible;
  - contrast spot-checks with computed colours;
  - the sticky CTA behaviour;
  - the theme toggle persists across navigation;
  - no flash on reload in dark mode.
- [ ] Fix issues with tests where reasonable. Commit with the message `style(site): final visual pass`.
- [ ] Prepare a short Turkish summary with screenshots for the owner. Push only after explicit approval.
