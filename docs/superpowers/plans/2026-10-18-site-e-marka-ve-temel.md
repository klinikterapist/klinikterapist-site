# Site E — Brand, Day/Night Theme, Mobile Building Blocks, Content Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship stages 2–3 of the site redesign:
- the sun mark and klinikterapist wordmark as clean SVGs, with all icon files;
- the "Gün & Gece" design tokens and a flash-free day/night theme;
- the shared mobile "app" building blocks;
- the new content fields and panel screens.

Page layouts come in Plan F.

**Architecture:**
- **Colours:** `src/styles/tokens.css` becomes two themes of CSS custom properties, switched by `html[data-theme]`. A tiny inline head script sets the theme before first paint.
- **Shared parts:** new Astro components in `src/components/ui/`, using native `<details>` for accordions and zero JS except the theme toggle and the sticky CTA.
- **Content:** new fields are optional zod fields in `src/lib/schemas.ts`. Panel screens extend the existing settings screens.

**Tech Stack:** Astro 7, CSS custom properties, Vitest, React panel, sharp, `potrace` (devDependency, for tracing the wordmark once).

**Spec:** `docs/superpowers/specs/2026-10-18-site-yeniden-tasarim-design.md` (§4, §5.1–5.5, §5.10–5.11, §10). Visual references are in `docs/superpowers/specs/assets/2026-10-18-site/` (start with `canli-anasayfa-2.html`).

## Global Constraints

- **Branch:** same as Plan D (`site-redesign`). No push without the owner's OK.
- **Palette** (verbatim from spec §5.2):

  | Role | Day | Night |
  |---|---|---|
  | bg | `#FBF3E4` | `#1F2E4A` |
  | surface | `#F4E9D4` | `#26385A` |
  | text | `#2A2420` | `#F4EBDD` |
  | muted | `#5C5348` | `#B9C4D6` |
  | line | `#2A2420` at 12% | `#F4EBDD` at 13% |
  | button bg / text | `#1F2E4A` / `#FBF3E4` | `#F6B92B` / `#1F2E4A` |
  | link | `#1F2E4A` | `#FCD873` |
  | sun halo / disc | `#FCD873` / `#F6B92B` | same |
  | sun face | `#2A2420` | `#1F2E4A` |
  | drop cap | `#1F2E4A` | `#F6B92B` |
  | quote rule | `#F6B92B` | `#F6B92B` |
  | focus | `#1F2E4A` | `#FCD873` |

- **Sunflower yellow** is never used as a text colour on the day background.
- **Contrast:** WCAG AA in both themes (4.5:1 text, 3:1 large text/UI).
- **Mark and logos:** the sun mark is flat and symmetric, never rotated. Flags are inline SVG, never emoji.
- **Visitor JS:** only the theme script/toggle, the sticky CTA and (Plan F) blog search. No libraries.
- **Copy:** all visitor copy in TR and EN. Panel copy in plain Turkish.
- **Tests:** `npm test`, `npm run test:build` and `npm run check` (no new errors in touched files) must be green before each commit.
- **Commits** end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

- **First visit with OS dark mode and no stored choice.** Expect: the page paints dark immediately, with no white flash. Tested in Task 3 (the build test asserts the inline script is the first thing in `<head>` and sets `data-theme` before any stylesheet).
- **localStorage throws (Safari private mode).** Expect: the theme still follows the OS, and the toggle works for the visit. Tested in Task 3.
- **A `links.json` entry without `note`, and a profile without `memberships` or `heroStyle`** (all current data). Expect: no empty badges, no "undefined", the default hero style is used. Tested in Task 5.
- **A long Turkish name or title at 320px.** Expect: it wraps without horizontal scroll. Covered by the Task 4 browser check.
- **Keyboard user.** Expect: accordions toggle with Enter/Space (native), the theme toggle has an accessible name and state, and focus rings are visible in both themes. Tested in Task 4.

---

### Task 1: Sun mark, wordmark and icon files

**Files:**
- Create:
  - `src/assets/brand/sun.svg` (clean source)
  - `src/components/brand/SunMark.astro`
  - `src/components/brand/Wordmark.astro`
  - `scripts/brand-icons.mjs` (one-off generator, kept in the repo)
- Replace: `public/favicon.svg`, `public/favicon.ico`
- Create:
  - `public/apple-touch-icon.png` (180, cream background)
  - `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
- Outside the repo, written by the script when run locally: `C:\Users\ogune\Desktop\Klinik Terapist\Logo\gunes-instagram-krem.png` and `-lacivert.png` (1080×1080).
- Test: `tests/unit/brand.test.ts` (new), `tests/build/pages.test.ts`

**Interfaces:**
- `SunMark.astro`: props `{ size?: number; label?: string }`. It renders inline SVG. The halo and disc use fixed fills (`#FCD873`, `#F6B92B`); the face stroke is `var(--sun-face)`.
  - With `label` it gets `role="img"` and `aria-label`; without, `aria-hidden="true"`.
- `Wordmark.astro`: props `{ height?: number }`. Inline SVG, `fill="currentColor"`, `aria-label="klinikterapist"`.

- [ ] **Step 1: Write the failing tests.**
  - `brand.test.ts`: read `src/assets/brand/sun.svg`.
    - It has exactly three paths in the face group, and a viewBox of `0 0 100 100`.
    - The halo/disc shape is mirror-symmetric within 1 unit: compare the path's bounding box centre to x=50 (use a simple path-points parse, or store the cleaned paths as mirrored halves).
  - `pages.test.ts`: the home page `<head>` links `/favicon.svg`, `/apple-touch-icon.png`, and `<link rel="icon" sizes="32x32">`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Create the clean sun.**
  - Rebuild the shape from `docs/superpowers/specs/assets/2026-10-18-site/gunes-taslak-gunduz.svg`: halo, disc, two closed-eye arcs, smile.
  - Make it symmetric by drawing one half and mirroring.
  - Keep the halo's soft waves: about 12 gentle bumps.
  - The face is the downward arcs `M37 47q5.5 5 11 0`, `M52 47q5.5 5 11 0`, `M43 57q7 5.5 14 0` (stroke 2.8, round caps).
  - Visually check it at 16px, 48px and 300px.
- [ ] **Step 4: Trace the wordmark.**
  - Source: `C:\Users\ogune\Desktop\Klinik Terapist\Logo\klinikterapist-siyah.webp`. Crop to its bounds with sharp, trace with `potrace`, simplify, and set `fill="currentColor"`.
  - Commit only the resulting SVG markup inside `Wordmark.astro`, not the source image.
- [ ] **Step 5: Write `scripts/brand-icons.mjs`.**
  - It produces the PNG/ICO files from `sun.svg` with sharp.
  - `favicon.svg` embeds a `<style>` with `@media (prefers-color-scheme: dark)`, so the face colour follows the OS.
  - Run it.
- [ ] **Step 6: Replace the favicon links** in `BaseLayout.astro`/`Seo.astro`.
- [ ] **Step 7: Run the tests.** Expected: PASS.
- [ ] **Step 8: Commit.** Message: `feat(brand): sun mark, wordmark and icon files`.

### Task 2: "Gün & Gece" tokens

**Files:**
- Modify:
  - `src/styles/tokens.css`: two themes; old `--cream`, `--forest`, `--sage*` tokens removed; semantic names such as `--bg`, `--surface`, `--text`, `--muted`, `--line`, `--btn-bg`, `--btn-text`, `--link`, `--sun-halo`, `--sun-disc`, `--sun-face`, `--dropcap`, `--quote-rule`, `--focus`
  - every site component and view that uses an old token (find them with `grep -rn "var(--\(cream\|paper\|forest\|sage\|ink\|on-forest\|highlight\)" src/components src/views src/styles src/layouts`)
- Create: `src/lib/contrast.ts` (WCAG ratio helper)
- Test: `tests/unit/contrast.test.ts` (new), plus the existing build tests

**Interfaces:**
- `contrastRatio(hexA: string, hexB: string): number`
- `PALETTE: Record<'day' | 'night', Record<string, string>>`, exported from `src/lib/palette.ts`, which mirrors tokens.css. A test asserts the two stay in sync by parsing tokens.css.

- [ ] **Step 1: Write the failing tests.**
  - `contrast.test.ts`: for both themes, `text/bg ≥ 4.5`, `muted/bg ≥ 4.5`, `muted/surface ≥ 4.5`, `btn-text/btn-bg ≥ 4.5`, `link/bg ≥ 4.5`, `focus/bg ≥ 3`.
  - Sunflower `#F6B92B` on the day bg must be below 4.5. This documents why it is never used as text there.
  - Every hex in `PALETTE` appears in `tokens.css` under the right theme.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement the tokens and migrate components.** `:root` (and `html[data-theme=light]`) carries the day values; `html[data-theme=dark]` carries night. Set `color-scheme` per theme. Remove Caveat imports if nothing uses `--font-hand` after Plan F; leave a TODO-free state by checking with grep.
- [ ] **Step 4: Run** `npm test` and `npm run test:build`. Expected: PASS. Fix snapshot-like assertions that referenced old colours.
- [ ] **Step 5: Commit.** Message: `feat(site): Gün & Gece design tokens`.

### Task 3: Theme script and toggles

**Files:**
- Create:
  - `src/components/ThemeScript.astro` (inline, first child of `<head>`)
  - `src/components/ThemeToggle.astro` (`variant: 'segmented' | 'chip'`)
- Modify:
  - `src/layouts/BaseLayout.astro`: `<meta name="color-scheme" content="light dark">`, ThemeScript first
  - `src/data/legal/gizlilik.tr.md`, `gizlilik.en.md`: the theme-preference sentence from spec §5.4
- Test: `tests/build/theme.test.ts` (new), `tests/unit/theme-script.test.ts` (new, jsdom)

**Interfaces:**
- localStorage key `site.theme`, values `'light' | 'dark'`. A missing key means "system".
- The script sets `document.documentElement.dataset.theme` to the stored value, or to the OS preference via `matchMedia`. The storage read is wrapped in try/catch. The script also listens for OS changes while in system mode.
- `ThemeToggle` variants:
  - **segmented** (desktop): three buttons, Sistem / Gündüz / Gece, each with `aria-pressed`, monitor/sun/moon icons, TR/EN labels via `t()`.
  - **chip** (mobile): one button showing the current mode ("☼ Gündüz" / "☾ Gece"). A tap toggles light ↔ dark. A long-press (≥600 ms) resets to system and shows "Sistem" for 1.5 s.
- A small shared module script handles both variants, with event delegation on `[data-theme-set]`.

- [ ] **Step 1: Write the failing tests.**
  - `theme.test.ts` (fixture build), for every built page: the first element in `<head>` is the inline theme script; `meta[name=color-scheme]` exists; there is no `<link rel=stylesheet>` before the script.
  - `theme-script.test.ts`: evaluate the script string in jsdom.
    - stored `dark` → `data-theme=dark`;
    - no storage and `matchMedia` dark → dark;
    - `localStorage.getItem` throws → still follows `matchMedia`;
    - toggling writes `site.theme`; choosing "Sistem" removes the key.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Colour transitions are 0.3 s on `background-color, color, border-color`, and none under `prefers-reduced-motion`. Add the privacy sentence to both languages.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(site): flash-free day/night theme with toggles`.

### Task 4: Mobile "app" building blocks

**Files:**
- Create, in `src/components/ui/`:
  - `TopBar.astro`: left slot is `logo | back(href,label) | none`; the theme chip; `LangSwitch` with flag
  - `ListItem.astro`: icon, title, subtitle, href, optional thumb, optional `meta` slot
  - `Accordion.astro`: `<details>`; icon, title, subtitle, default slot; `name` optional
  - `TilePair.astro`: two tiles, each icon/title/subtitle/href; renders one full-width tile if only one is given
  - `StickyCta.astro`: `mode: 'afterTopCta' | 'always'`, href, label
  - `PageEnd.astro`: the 112 line + `© {year} klinikterapist.com · Tüm hakları saklıdır.` (TR) / `All rights reserved.` (EN)
  - `Flag.astro`: `tr | gb`
- Modify: `src/components/LangSwitch.astro` (flag + "ENG"/"TR"), `src/i18n/ui.ts` (new strings)
- Test: `tests/build/ui-blocks.test.ts` (new; uses a hidden fixture page `src/pages/_ui-test.astro` excluded from the sitemap and built only under the fixture env, or test via an existing page once Plan F uses them, whichever is simpler; the implementer chooses and notes it)

**Interfaces:**
- **Shape:** box radius 14px; mobile padding 13–14px; tap targets ≥ 44px; chevron "›" icon on the right.
- **StickyCta:** fixed bottom, width ≤ 440px centred, translucent `var(--bg)` with blur, top hairline, `padding-bottom: calc(16px + env(safe-area-inset-bottom))`.
  - With `afterTopCta`, a tiny inline script shows it when `#top-cta`'s bottom is under 90px and hides it otherwise. With `always`, it is always visible.
  - It is hidden at ≥ 768px (desktop has its header button).
- **LangSwitch:** on TR pages, GB flag + "ENG" linking to the EN counterpart; on EN pages, TR flag + "TR".

- [ ] **Step 1: Write the failing tests.**
  - an Accordion renders `<details><summary>` with the title and an `aria-hidden` chevron;
  - a TilePair with one item renders a single full-width tile;
  - PageEnd contains "112" and the current year;
  - LangSwitch on a TR page shows "ENG" and an `svg` flag, never an emoji flag (assert no regional-indicator characters `/[\u{1F1E6}-\u{1F1FF}]/u`);
  - StickyCta `always` has no hidden class, and `afterTopCta` starts hidden.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement the components** to match `canli-anasayfa-2.html` and `diger-sayfalar-2.html` visually.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Check in the browser** at 320, 375 and 430px in both themes: no horizontal scroll, focus rings visible, accordions work with the keyboard.
- [ ] **Step 6: Commit.** Message: `feat(site): mobile app building blocks`.

### Task 5: Content fields, panel screens and portrait

**Files:**
- Modify:
  - `src/lib/schemas.ts`:
    - `profileSchema`: `heroStyle: z.enum(['background','round']).optional()`, `memberships: z.array(z.object({ org: localized, number: z.string().optional() })).optional()`
    - `linkSchema`: `note: localized.optional()`
    - `homeSchema`: `process: z.array(z.object({ title: localized, text: localized })).max(3).optional()`
    - `postFrontmatterSchema`: `featured: z.boolean().optional()`
  - New `faqSchema`: `z.array(z.object({ id: slug-like, q: localized, a: localized }))`
  - `src/lib/settings.ts`: `getFaq(lang)`, returning only the items answered in that language
  - New data file `src/data/faq.json`, seeded with the five questions from spec §5.11. Answers are **empty** (`{ "tr": "", "en": "" }`). A question with an empty answer in a language is not rendered in that language, so nothing blocks deploys and nothing half-finished shows.
  - Panel:
    - `src/admin/ui/settings/screens/simple.tsx` (Profil): "Ana sayfa görünümü" select (Arka planda fotoğraf / Yuvarlak fotoğraf) and a "Mesleki üyelikler" list editor
    - new `faq.tsx` screen "Sık sorulan sorular" with id `sss`, icon `MessageCircleQuestion`, intro "Ana sayfada ve Sık sorulanlar sayfasında görünen sorular."; registered in `screens.ts`/`SettingsPage.tsx`
    - `lists.tsx` (Linkler): optional "Not" localized field
    - `lists.tsx` (Ana sayfa): "Süreç adımları" editor (max 3)
    - `src/admin/ui/editor/SettingsPanel.tsx`: "Öne çıkan yazı" toggle (`featured`)
    - `src/admin/lib/publish.ts` / `frontmatter.ts`: carry `featured`
  - `src/admin/lib/image.ts`: the `profile` preset becomes `{ maxW: 1600, maxH: 1600, type: 'image/webp', q: 0.85 }` (no forced crop; both hero styles crop with CSS); update the Profil hint text accordingly
  - `src/data/profile.json`: `photo` set to the committed portrait path, using the same public path pattern the panel's ImageField writes (inspect an ImageField upload in the mock to confirm the folder and name pattern)
  - Add `public/images/profil-<hash>.webp` (or whatever path pattern the panel uses), generated from `C:\Users\ogune\Desktop\Klinik Terapist\Fotoğraflar\portre.webp` with the new preset
  - `src/data/profile.json`: `memberships` with `{ org: { tr: 'Türk Psikologlar Derneği', en: 'Turkish Psychological Association' } }` (no number until the owner adds it)
  - `src/data/links.json`: Medium gets `"note": { "tr": "İngilizce", "en": "In English" }`
- Test: `tests/unit/settings.test.ts`, `tests/unit/admin/settings.test.tsx`, `tests/unit/admin/publish.test.ts`, `tests/unit/admin/frontmatter.test.ts`

- [ ] **Step 1: Write the failing tests.**
  - The schemas accept current data unchanged; they accept the new optional fields; they reject `heroStyle: 'x'`.
  - `getFaq('tr')` returns only answered items: zero with the seed data, one after filling one answer.
  - Panel:
    - the Profil screen shows "Ana sayfa görünümü" with the two options;
    - the new "Sık sorulan sorular" screen lists five questions and can add, reorder and delete;
    - the Linkler screen shows "Not";
    - SettingsPanel "Öne çıkan yazı" toggles `featured`, and publish writes `featured: true` to both languages' frontmatter (omitted when false).
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Follow the existing settings screen patterns (`useSettingsFile`, `SettingsForm` with a `screen` id, `ListEditor`).
- [ ] **Step 4: Run all suites.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: FAQ, memberships, hero style, link notes, featured posts, portrait`.
