# Yazı Editörü v2 ve Panel Görünümü — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the admin panel into a Substack-style two-theme panel. Give the post editor a fixed toolbar, a subtitle, strike and highlight marks, a word count, APA 7 citations with an automatic reference list, a preview and a version history.

**Architecture:** Everything stays static. Citations are stored in the post Markdown as inline `<cite>` HTML, with the formatted text already inside. The reference list lives in the frontmatter, and an Astro component renders it as the "Kaynakça" at build time. No Markdown plugin is needed and no JavaScript runs on the site. A single APA module (`src/lib/apa/`) formats references for both the site build and the panel. Version snapshots are extra JSON files in Drive, written by the existing Apps Script `drafts.save`.

**Tech Stack:** Astro 7 + Sätteri Markdown, React 19, Tiptap 3 (`@tiptap/extension-highlight` is new), Google Apps Script (esbuild bundle), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-17-editor-v2-design.md`. Section numbers below (§5.x) refer to it.

## Global Constraints

- Work on a new branch `editor-v2`, cut from `main` **after** Faz 2 is merged and live (spec §7). Do not push without the owner's explicit approval; a push deploys the live site.
- All panel copy is Turkish, plain and non-technical. In the panel the word is "referans" ("Referans ekle", "Kayıtlı referanslar", "Yeni referans"). The list heading on the site stays "Kaynakça" / "References".
- Existing posts must build unchanged. Every new frontmatter field is optional.
- Nothing new runs in the visitor's browser. Citations and the reference list are static HTML.
- Keep the Faz 2 safety rules: `SAFE_LINK` for every link (reference DOIs/URLs included), escape raw text, owner-only API.
- Apps Script code: no `atob`/`btoa`/`TextEncoder`; it must bundle with `apps-script/build.mjs`.
- Must be usable on iPhone Safari at 360 px width; the toolbar scrolls horizontally there.
- `npm test`, `npm run test:build`, `npm run check:launch` stay green after every task.
- Stage order (spec §7). Each stage must ship on its own: **A** panel look (Tasks 1–4), **B** editor basics (5–7), **C** APA (8–11), **D** preview (12), **E** version history (13–14).

## Review Focus

1. **An old draft in Drive or localStorage without `subtitle`/`references`.** It must open, autosave and publish without crashing (`normalizeDraft`, Task 5).
2. **Literal text that looks like our syntax.** The owner types `<cite>`, `<mark>`, `~~` or `[@x]` as plain text. It must round-trip as text, never as a citation or mark (Tasks 6 and 10).
3. **Deleting a reference that is still cited, or deleting the last citation of a reference.** The first is blocked. In the second case the reference drops out of the Kaynakça but stays in the saved list (Tasks 10–11).
4. **A DOI lookup that fails or returns an unsupported type** (offline, 404, `report`, `dissertation`). The owner gets a Turkish message and the manual form, never a silent wrong entry (Tasks 9 and 11).
5. **Restoring a version, then wanting the pre-restore text back.** The restore forces a snapshot of the current state, so the restore itself can be undone (Tasks 13–14).

---

## Stage A — Panel look

### Task 1: Light/dark theme

**Files:**
- Create: `src/admin/ui/theme.ts`
- Modify: `src/admin/ui/admin.css` (colour tokens), `src/pages/admin/index.astro` (pre-paint script, `theme-color`)
- Test: `tests/unit/admin/theme.test.ts`

**Interfaces:**
- Produces: `type Theme = 'light' | 'dark'`; `THEME_KEY = 'panel.theme'`; `resolveTheme(stored: string | null, prefersDark: boolean): Theme`; `applyTheme(t: Theme, root?: HTMLElement): void` (sets `data-theme` on `<html>`); `useTheme(): [Theme, () => void]` (toggle stores the choice; storage access is in try/catch).

- [ ] **Step 1: Write the failing test**

```ts
it('stored choice wins, else the device setting', () => {
  expect(resolveTheme('dark', false)).toBe('dark');
  expect(resolveTheme('light', true)).toBe('light');
  expect(resolveTheme(null, true)).toBe('dark');
  expect(resolveTheme('bogus', false)).toBe('light');
});
it('applyTheme sets data-theme on the root', () => {
  applyTheme('dark', document.documentElement);
  expect(document.documentElement.dataset.theme).toBe('dark');
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/admin/theme.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `theme.ts`.** In `admin.css`, move every hard-coded panel colour into panel tokens: `--p-bg`, `--p-surface`, `--p-sidebar`, `--p-border`, `--p-text`, `--p-muted`, `--p-accent`, `--p-accent-text`, `--p-selected`. Light values come from the site tokens (`--cream`, `--forest`, `--ink`). Dark values are set under `html[data-theme="dark"]` (`--p-bg:#17181a; --p-surface:#1d1f22; --p-sidebar:#1d1f22; --p-border:#2f3236; --p-text:#e9e6df; --p-muted:#a5a29b; --p-accent:#6f9a80`). In `index.astro`, add an inline `<script is:inline>` in `<head>` that sets `data-theme` before first paint, using the same logic as `resolveTheme`.
- [ ] **Step 4: Run** the test. Expected: PASS. Run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(admin): light and dark theme`

### Task 2: Logo, sidebar and routes

**Files:**
- Create: `public/admin/logo-black.png`, `public/admin/logo-white.png` (made from `C:\Users\ogune\Desktop\Klinik Terapist\Logo\3.png`: crop to the alpha bounding box, resize to 800 px wide; the black copy is the same alpha with RGB set to 0. Use a one-off Python/PIL command; do not commit the script.)
- Create: `src/admin/lib/new-post.ts`
- Modify: `src/admin/ui/context.tsx`, `src/admin/ui/Shell.tsx`, `src/admin/ui/App.tsx`, `src/admin/ui/PostsList.tsx` (use `startNewPost`), `src/pages/admin/index.astro` (the visible "Yönetim paneli" header becomes a visually hidden `h1`), `admin.css`
- Test: `tests/unit/admin/app.test.tsx` (extend), `tests/unit/admin/routes-admin.test.ts`

**Interfaces:**
- Produces: `Route = { name: 'home' } | { name: 'posts'; tab: 'live' | 'drafts' } | { name: 'post'; key: string } | { name: 'settings'; screen: string }`. Hashes: `''`, `#/` → home; `#/yazilar` → posts/live; `#/yazilar/taslaklar` → posts/drafts; the existing `#/yazi/<key>` and `#/ayarlar/<screen>` stay. `startNewPost(storage: Storage, now: Date): string` creates the draft, writes the backup and returns the hash `#/yazi/<key>`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(parseRoute('')).toEqual({ name: 'home' });
expect(parseRoute('#/yazilar')).toEqual({ name: 'posts', tab: 'live' });
expect(parseRoute('#/yazilar/taslaklar')).toEqual({ name: 'posts', tab: 'drafts' });
expect(parseRoute('#/yazi/abc-1')).toEqual({ name: 'post', key: 'abc-1' });
```

In `app.test.tsx`, after sign-in with the mock API:
- both `img[alt="klinikterapist"]` are present, `/admin/logo-black.png` and `/admin/logo-white.png`;
- the nav has links named "Ana sayfa", "Yazılar", "Siteyi aç", and a button "Yeni yazı";
- clicking "Yeni yazı" lands on `#/yazi/taslak-…`;
- a button labelled "Karanlık mod" exists; after a click its label is "Açık mod".

- [ ] **Step 2: Run** both test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Sidebar order (spec §5.8): logo (both images; CSS shows the one matching `data-theme`), Ana sayfa, Siteyi aç ↗, "+ Yeni yazı" (primary button), Yazılar, the "Site ayarları" group (the existing `SETTINGS_SCREENS`), then Çıkış yap at the bottom.
  - Every item gets a small inline SVG icon. The theme toggle sits at the top right of `panel-main`.
  - On phones, the menu stays the existing ☰ drawer.
  - `App` routes `home` to `<Home />`. Until Task 3 lands, that is a placeholder that renders `<PostsList tab="live" />`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. Some existing tests use the old `posts` route shape; fix them by adding the new `tab` field.
- [ ] **Step 5: Commit** `feat(admin): Substack-style sidebar with logo`

### Task 3: Home dashboard

**Files:**
- Create: `src/admin/lib/dashboard.ts`, `src/admin/ui/Home.tsx`
- Modify: `src/admin/ui/App.tsx`
- Test: `tests/unit/admin/dashboard.test.ts`, `tests/unit/admin/home.test.tsx`

**Interfaces:**
- Consumes: `loadSiteState(api)`, `mergeList(live, drafts): PostRow[]`, `api.listDrafts()`, the existing `DeployStatus` context.
- Produces: `dashboard(live: LivePost[], drafts: DraftSummary[], now: Date): { lastLive: LivePost | null; recentDrafts: DraftSummary[]; publishedThisMonth: number; incomplete: { key: string; title: string; missing: 'tr' | 'en' }[] }`.

- [ ] **Step 1: Write the failing test** `dashboard.test.ts`, with now = `2026-10-17`:
  - `lastLive` is the live post with the latest `publishedAt`;
  - `recentDrafts` holds at most 5, newest `updatedAt` first;
  - `publishedThisMonth` counts live posts with `publishedAt` starting `2026-10`;
  - a draft summary with `title.en === ''` and `title.tr === 'Bağlanma'` yields `{ missing: 'en', title: 'Bağlanma' }`;
  - a draft with both titles empty is not listed as incomplete.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `dashboard()` and `Home.tsx`.** Use four cards:
  - "Son yayınlanan": title, date, the site status from DeployStatus.
  - "Taslaklar": rows link to `#/yazi/<key>`; "Tümü" links to `#/yazilar/taslaklar`.
  - "Bu ay": "N yazı yayınlandı".
  - "Eksikler": "“X” İngilizcesi yok" / "Türkçesi yok".

  The loading, error and retry states copy `PostsList`.
- [ ] **Step 4: Run** `npx vitest run tests/unit/admin/dashboard.test.ts tests/unit/admin/home.test.tsx`. Expected: PASS. In `home.test.tsx`, with the mock seeded with one live post and one draft, the cards render their titles.
- [ ] **Step 5: Commit** `feat(admin): home dashboard`

### Task 4: Posts screen tabs and sorting

**Files:**
- Modify: `src/admin/ui/PostsList.tsx`
- Test: `tests/unit/admin/posts-list.test.tsx` (extend)

**Interfaces:**
- Consumes: `Route` posts `tab` (Task 2).
- Produces: `<PostsList tab: 'live' | 'drafts' />`. "Yayında" lists rows with status `yayında` or `yayında-değişiklik-var`. "Taslaklar" lists rows with status `taslak` or `yayında-değişiklik-var`, so a live post with unsaved changes appears in both. The tabs are links to the two hashes and show their counts, e.g. "Yayında 12".

- [ ] **Step 1: Write failing tests.**
  - The tab counts match the seeded rows.
  - The "Taslaklar" tab hides plain live rows.
  - The sort select "En yeni önce" / "En eski önce" orders by `updatedAt`.
  - The existing search and category tests still pass.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): posts tabs and sorting`

## Stage B — Editor basics

### Task 5: Subtitle and the new draft fields

**Files:**
- Modify: `src/admin/api/types.ts` (`LangFields`), `src/admin/lib/draft.ts`, `src/admin/lib/frontmatter.ts`, `src/admin/lib/posts-repo.ts`, `src/admin/lib/publish.ts`, `src/lib/schemas.ts`, `src/lib/posts.ts` (`PostData`), `src/views/PostView.astro`, `src/admin/ui/editor/PostEditor.tsx`, `src/admin/ui/editor/EditorPage.tsx` and `useAutosave.ts` (normalize on every load path)
- Test: `tests/unit/admin/frontmatter.test.ts`, `tests/unit/admin/draft.test.ts`, `tests/unit/admin/publish.test.ts`, `tests/build/blog.test.ts`, plus a fixture: add `subtitle` to `tests/fixtures/content/ornek-kucuk-adimlar/tr.md`

**Interfaces:**
- Produces:
  - `LangFields` gains `subtitle: string` and `references: Reference[]` (the `Reference` type comes from Task 8; until then, declare it in `src/lib/apa/types.ts` as written in Task 8).
  - `normalizeDraft(d: unknown): Draft` fills the missing `subtitle: ''` and `references: []` on both languages.
  - `PostFrontmatter` gains `subtitle?: string` and `references?: Reference[]`. `ORDER` gets `subtitle` after `title` and `references` after `updatedAt`. `references` is written as one JSON line (valid YAML).
  - The schema adds `subtitle: z.string().optional()` and `references: z.array(referenceSchema).optional()`. `referenceSchema` lives in `src/lib/apa/types.ts`.

- [ ] **Step 1: Write failing tests.**
  - `serializePost` writes `subtitle: "Kaygı düşman değil"` on line 2 and omits it when empty.
  - `parsePost` round-trips `subtitle` and `references` (deep equal).
  - `normalizeDraft({ ...oldDraftWithoutFields })` returns `tr.subtitle === ''` and `en.references` equal to `[]`.
  - The publish changeset for a draft with a subtitle contains `subtitle:` in `tr.md`.
  - Build test: the fixture post page `.standfirst` text equals the fixture subtitle. The page `meta[name=description]` still equals the fixture description.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - PostView shows `data.subtitle ?? data.description` in `.standfirst`. This is Claude's call: the description stays the SEO text, and the subtitle replaces it on the page only when it is set.
  - In the editor, the subtitle is a one-line auto-growing textarea under the title, with class `ed-subtitle`, placeholder "Alt başlık ekleyin…" / "Add a subtitle…", grey and smaller.
- [ ] **Step 4: Run** `npm test && npm run test:build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: optional post subtitle`

### Task 6: Strikethrough and highlight

**Files:**
- Modify: `package.json` (add `@tiptap/extension-highlight` at the same `^3.32.0`), `src/admin/lib/markdown.ts`, `src/admin/ui/editor/PostEditor.tsx` (enable `strike` in StarterKit, add `Highlight`), `src/views/PostView.astro` (`mark` style; move it into `prose.css` if Task 12 has already landed)
- Test: `tests/unit/admin/markdown.test.ts`, `tests/build/blog.test.ts`, fixture paragraph in `tests/fixtures/content/ornek-kucuk-adimlar/tr.md`: `Bu ~~eski~~ ve <mark>önemli</mark> bir cümle.`

**Interfaces:**
- Produces: the mark types `strike` ⇄ `~~text~~` and `highlight` ⇄ `<mark>text</mark>`. `MARK_ORDER` becomes `['link', 'bold', 'italic', 'strike', 'highlight']`.

- [ ] **Step 1: Write failing tests.**
  - The `everything` round-trip doc gains `t('çizik', strike)` and `t('vurgu', highlight)` and still round-trips.
  - `docToMarkdown` of a plain text node `"a ~~b~~ <mark>c</mark>"` contains `\~\~b\~\~` and `\<mark>`, and parsing it back gives the same plain text with no marks (Review Focus 2).
  - Build: the fixture page has `.prose del` with text `eski` and `.prose mark` with text `önemli`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** In `inlineTokens`, the `del` case maps to the `strike` mark instead of dropping it. An inline `html` token exactly `<mark>` opens `highlight` until the matching `</mark>`. Every other inline html stays text.
  - If the build test shows that Sätteri escapes inline HTML, stop and report it. That case needs an mdast plugin like `markdown-figure.ts`, and the plan must change.
- [ ] **Step 4: Run** `npm test && npm run test:build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(editor): strikethrough and highlight`

### Task 7: Fixed toolbar, language buttons, collapsible settings, word count

**Files:**
- Create: `src/admin/ui/editor/Toolbar.tsx`
- Modify: `src/admin/ui/editor/PostEditor.tsx` (remove `BubbleMenu` and `FloatingMenu`, mount `Toolbar`), `src/admin/ui/editor/EditorPage.tsx`, `src/lib/readingTime.ts`, `admin.css`
- Test: `tests/unit/admin/editor.test.tsx` (extend), `tests/unit/readingTime.test.ts`

**Interfaces:**
- Produces:
  - `countWords(markdown: string): number`, exported from `readingTime.ts`; `readingTime` now uses it.
  - `<Toolbar editor={Editor} onLink() onImage() onYoutube() onReference() />`. `onReference` stays disabled until Task 11.
  - Side-panel state is kept in localStorage `panel.side` (`'open' | 'closed'`). The default is `'closed'` below 768 px and `'open'` otherwise.

- [ ] **Step 1: Write failing tests.**
  - `countWords('Bir iki ![x](./a.webp) [üç](https://a.co)')` is `3`.
  - The toolbar renders buttons in this order, with these accessible names: "Geri al", "Yinele", the "Paragraf türü" select (Paragraf / Alt başlık / Küçük alt başlık), "Kalın", "İtalik", "Üstü çizili", "Vurgula", "Bağlantı", "Görsel", "YouTube", "Alıntı", "Madde listesi", "Numaralı liste", "Referans ekle", "Daha fazla" (whose menu holds "Vurgu kutusu" and "Ayraç").
  - Clicking "Kalın" with a selection makes it `aria-pressed="true"`.
  - The top bar has a group "Dil" with buttons "TR" and "EN". Each shows ✓ when `missingFields` is empty and ⚠ otherwise. Clicking EN switches the editor to English.
  - "Yazı ayarlarını gizle" hides the side panel. After a re-render the label is "Yazı ayarlarını göster" and `localStorage['panel.side'] === 'closed'`.
  - The footer reads "N kelime · M dk okuma" for the current language.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The "Referans ekle" icon is an open book (inline SVG). It must not be the quotation mark used for "Alıntı".
  - The toolbar is `position: sticky; top: 0`. On narrow screens it does not wrap; it scrolls horizontally (`overflow-x: auto`).
  - The footer's left slot is reserved for "Sürüm geçmişi" (Task 14).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(editor): fixed toolbar, TR/EN buttons, collapsible settings, word count`

## Stage C — APA 7 references

### Task 8: APA formatting module

**Files:**
- Create: `src/lib/apa/types.ts`, `src/lib/apa/terms.ts`, `src/lib/apa/names.ts`, `src/lib/apa/format.ts`, `src/lib/apa/index.ts`
- Test: `tests/unit/apa.test.ts`

**Interfaces:**
- Produces:

```ts
export type Person = { family: string; given?: string; suffix?: string } | { literal: string };
export type RefType = 'article' | 'book' | 'chapter' | 'web';
export type Year = number | 'nd' | 'inpress';
export type Reference = {
  id: string; type: RefType; authors: Person[]; editors?: Person[]; year: Year;
  title: string; container?: string; volume?: string; issue?: string; pages?: string;
  edition?: string; publisher?: string; doi?: string; url?: string; accessed?: string /* YYYY-MM-DD */;
};
export type LocatorKind = 'p' | 'pp' | 'para' | 'ch';
export type CiteItem = { id: string; locator?: { kind: LocatorKind; value: string } };
export type Citation = { items: CiteItem[]; narrative: boolean };
export const referenceSchema; // zod, matching Reference (src/lib uses 'astro/zod')

export function sentenceCase(title: string): string;
export function citationText(c: Citation, refs: Reference[], lang: Lang): string;
export function bibliography(refs: Reference[], citedIds: Set<string>, lang: Lang): Reference[]; // cited only, sorted
export function formatReferenceHtml(ref: Reference, refs: Reference[], lang: Lang): string; // escaped HTML; `refs` for 2004a/b
export function makeRefId(ref: Pick<Reference, 'authors' | 'year' | 'title'>, taken: Set<string>): string;
```

`terms.ts` holds one table per language with the exact strings from spec §5.7. This is the only place those strings live.

- [ ] **Step 1: Write failing tests.** Use exact strings. `R` = Ray 2004 article (vol 59, issue 1, pages 29–40, DOI `10.1037/0003-066X.59.1.29`).
  - `formatReferenceHtml(R, [R], 'en')` = `Ray, O. (2004). How the mind hurts and heals the body. <i>American Psychologist, 59</i>(1), 29–40. <a href="https://doi.org/10.1037/0003-066X.59.1.29">https://doi.org/10.1037/0003-066X.59.1.29</a>`
  - Two authors, reference list: EN `Smith, J., &amp; Lee, K. (2010).`; TR `Smith, J. ve Lee, K. (2010).`
  - Book with edition: EN `Sapolsky, R. M. (2004). <i>Why zebras don't get ulcers</i> (3rd ed.). Holt.`; TR `… (3. bs.). Holt.`
  - Chapter: TR `Yılmaz, A. (2019). Bağlanma kuramı. B. Demir (Ed.), <i>Gelişim psikolojisi</i> içinde (ss. 10–20). Nobel.`; EN `Yılmaz, A. (2019). Bağlanma kuramı. In B. Demir (Ed.), <i>Gelişim psikolojisi</i> (pp. 10–20). Nobel.`
  - Organization author, no date: TR `American Psychiatric Association. (t.y.).`; EN `(n.d.).`
  - Web with `accessed`: TR ends `Erişim tarihi: 5 Ocak 2026, https://…`; EN ends `Retrieved January 5, 2026, from https://…`
  - A `url` that fails `SAFE_LINK` (`javascript:x`) is printed as escaped text with no `<a>`.
  - Suffix: `{family:'King', given:'Martin Luther', suffix:'Jr.'}` → `King, M. L., Jr.`
  - 21 authors: all 21 listed. 22 authors: the first 19, then `. . .`, then the last.
  - Citations:
    - TR `(Ray, 2004)`, `(Smith ve Lee, 2010)`, 3+ authors `(Kaya vd., 2021)`; EN `(Smith & Lee, 2010)`, `(Kaya et al., 2021)`.
    - Narrative: TR `Smith ve Lee (2010)`, EN `Smith and Lee (2010)`.
    - Several sources: `(Ray, 2004; Smith ve Lee, 2010)`, given in either order. Same author: `(Ray, 2004, 2010)`.
    - Locators: TR `(Ray, 2004, s. 34)`, `(Ray, 2004, ss. 34–36)`, `(Ray, 2004, paragraf 3)`, `(Ray, 2004, Bölüm 2)`; EN `p. 34`, `pp. 34–36`, `para. 3`, `Chapter 2`.
    - Two Ray 2004 references, ordered by title, give `(Ray, 2004a)` and `(Ray, 2004b)` in the citation and in their reference entries.
    - No author: a book title in italics in the reference; the citation uses the title, e.g. `(<i>Mental health</i>, 2022)`. `citationText` returns plain text, so test it as `(Mental health, 2022)`; the `<cite>` writer (Task 10) handles the italics.
    - `(American Psychiatric Association, 2013)`; `(Ray, t.y.)`, `(Ray, baskıda)`; EN `(Ray, n.d.)`, `(Ray, in press)`.
  - `bibliography` sorts by first author family/literal (for no author: the title) with `localeCompare(lang)`. Ties go to year (`nd` first, `inpress` last), then title. TR: `Çelik` comes before `Demir`, `İnce` after `Ilgaz`. Uncited references are excluded.
  - `sentenceCase('How the Mind Hurts: The Body and APA')` = `How the mind hurts: The body and APA` (all-caps words and the first word after `:`, `?`, `!` are kept).
  - `makeRefId` gives `ray2004`, then `ray2004-2` when that is taken. Non-ASCII is folded (`Yılmaz` → `yilmaz`). No author gives the first title word.
- [ ] **Step 2: Run** `npx vitest run tests/unit/apa.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Given names become initials (`Robert M.` → `R. M.`, `Jean-Paul` → `J.-P.`). Page ranges use an en dash (`29-40` → `29–40`). Every text field is HTML-escaped before tags are added.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: APA 7 formatter (TR/EN)`

### Task 9: DOI lookup

**Files:**
- Create: `src/admin/lib/doi.ts`
- Test: `tests/unit/admin/doi.test.ts`

**Interfaces:**
- Consumes: `Reference`, `sentenceCase`, `makeRefId` (Task 8).
- Produces:
  - `parseDoi(input: string): string | null`
  - `fetchCsl(doi: string, fetchFn?: typeof fetch): Promise<unknown>`. It GETs `https://doi.org/<doi>` with `Accept: application/vnd.citationstyles.csl+json`. It throws `DoiError` with the Turkish messages "Bu DOI bulunamadı." (404), "DOI servisine ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin." (network error or 5xx).
  - `cslToReference(csl: unknown, taken: Set<string>): { ref: Reference; unsupported: string | null }`

- [ ] **Step 1: Write failing tests.**
  - `parseDoi` accepts `10.1037/x`, `https://doi.org/10.1037/x`, `doi:10.1037/x` and ` http://dx.doi.org/10.1037/x `. It returns null for `ray 2004`.
  - With a stubbed `fetchFn` returning the CSL-JSON of the Ray article (`type: 'article-journal'`, `title: 'How the Mind Hurts and Heals the Body'`, `container-title`, `volume`, `issue`, `page: '29-40'`, `issued: {date-parts: [[2004]]}`, `author: [{family:'Ray', given:'Oakley'}]`, `DOI`), `cslToReference` returns `type: 'article'`, `title: 'How the mind hurts and heals the body'`, `pages: '29–40'`, `id: 'ray2004'`, `unsupported: null`.
  - `{type: 'report'}` returns `unsupported: 'report'` and `type: 'book'`. The dialog must not allow "Ekle" until the owner picks a type (Review Focus 4).
  - An author given as `{literal: 'World Health Organization'}` maps to `{ literal: … }`. A missing `issued` gives `year: 'nd'`.
  - A 404 rejects with "Bu DOI bulunamadı."; a network error rejects with the network message.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Type mapping: `article-journal`/`article`/`article-magazine`/`article-newspaper` → article; `book` → book; `chapter` → chapter; `webpage`/`post`/`post-weblog` → web. Everything else is unsupported and defaults to `book`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): DOI lookup to APA reference`

### Task 10: Citations in Markdown and the Kaynakça on the site

**Files:**
- Create: `src/components/References.astro`, `src/lib/citations.ts`
- Modify: `src/admin/lib/markdown.ts` (`docToMarkdown(doc, lang, refs)`; `markdownToDoc` reads `<cite>`), `src/admin/lib/publish.ts` (pass `refs`), `src/admin/lib/posts-repo.ts`, `src/views/PostView.astro`, `src/lib/posts.ts` (build-time check), `src/i18n/ui.ts` (`references: { tr: 'Kaynakça', en: 'References' }`), fixture `tests/fixtures/content/ornek-kucuk-adimlar/{tr,en}.md` (two references, three citations, one uncited reference)
- Test: `tests/unit/admin/markdown.test.ts`, `tests/unit/citations.test.ts`, `tests/build/blog.test.ts`

**Interfaces:**
- Consumes: Task 8.
- Produces:
  - `docToMarkdown(doc: JSONContent, lang: Lang, refs: Reference[] = []): string`.
  - The Markdown form is `<cite data-refs="ray2004;smith2010~p~34" data-narrative>(Ray, 2004; Smith ve Lee, 2010, s. 34)</cite>`. In `data-refs`, items are separated by `;` and each item is `id` or `id~kind~value`. `data-narrative` is present only for narrative citations. The inner text is `citationText()` and is escaped. A no-author title in italics becomes `<i>…</i>` inside the cite.
  - `src/lib/citations.ts` exports `parseCiteAttr(v: string): CiteItem[] | null` (null when invalid; an invalid one is left as text), `writeCiteAttr(items: CiteItem[]): string` and `citedIds(markdown: string): Set<string>`. Locator values may not contain `;~"<>&`.
  - The Tiptap node is `citation` (inline atom) with attrs `{ items: CiteItem[], narrative: boolean }`.

- [ ] **Step 1: Write failing tests.**
  - The round-trip doc with a citation node gives `docToMarkdown` output containing the exact `<cite …>` string above (TR refs). `markdownToDoc` returns the same node.
  - A `<cite>` with an unknown attribute shape stays plain text. Escaped text `\<cite data-refs="x">` stays text (Review Focus 2).
  - `citedIds` of a body with two cites returns both ids, without duplicates.
  - Build:
    - the fixture TR page has `.prose cite` with text `(Ray, 2004)`;
    - `section.references h2` reads "Kaynakça" (EN: "References");
    - the list items are in alphabetical order;
    - the uncited reference is absent;
    - the DOI is an `<a href="https://doi.org/…">`.
  - A unit test for the build check: `validateCitations(body, refs, file)` throws `"<file>: metinde atıf yapılan \"x\" referansı kaynak listesinde yok."` when a cited id is missing.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `References.astro` gets `references`, `body` and `lang`. It renders `<section class="references"><h2>…</h2><ol class="references-list">` (no visible numbers, `list-style: none`, hanging indent `padding-left: 1.5em; text-indent: -1.5em`) with `formatReferenceHtml` via `set:html`.
  - It renders nothing when no reference is cited.
  - `validateCitations` runs where `posts.ts` builds entries.
- [ ] **Step 4: Run** `npm test && npm run test:build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: APA citations and reference list on posts`

### Task 11: "Referans ekle" in the editor

**Files:**
- Create: `src/admin/ui/editor/Citation.tsx` (Tiptap node and node view), `src/admin/ui/editor/ReferenceDialog.tsx`, `src/admin/ui/editor/CitationMenu.tsx`
- Modify: `PostEditor.tsx`, `Toolbar.tsx` (enable "Referans ekle"), `EditorPage.tsx` (references live in `draft[lang].references`)
- Test: `tests/unit/admin/references.test.tsx`

**Interfaces:**
- Consumes: Tasks 8–10, `LangFields.references`.
- Produces:
  - The node view reads the refs from `editor.storage.citation.refs`, which `PostEditor` updates on every change, and shows `citationText()`.
  - `canRemoveReference(doc: JSONContent, id: string): boolean`

- [ ] **Step 1: Write failing tests** (React Testing Library, `fetchFn` stubbed).
  - "Referans ekle" opens the dialog "Referans ekle" with the tabs "Kayıtlı referanslar (0)" and "Yeni referans".
  - Typing a DOI and pressing "Bul" fills the fields, shows "Başlığın büyük/küçük harflerini kontrol edin." and shows the APA preview. "Ekle" inserts a citation; the editor text contains `(Ray, 2004)` and `references` has one item.
  - The page field "s. 34" with the format "Ray (2004)" inserts `Ray (2004, s. 34)`.
  - With the cursor on a citation, adding a second reference produces `(Ray, 2004; Smith ve Lee, 2010)`. It joins the citation instead of making a new one.
  - A failed lookup shows the Turkish error and switches to the manual form.
  - The manual form's "Tür" select offers "Dergi makalesi / Kitap / Kitap bölümü / Web sayfası", and its fields change with the type (a chapter shows "Editörler" and "Kitap adı").
  - An unsupported DOI type shows "Bu kaynak türü (report) otomatik biçimlendirilemiyor. Uygun türü seçip alanları kontrol edin." and keeps "Ekle" disabled until a type is chosen.
  - On a cited reference, "Kayıtlı referanslar" › "Sil" is disabled with the hint "Bu referans metinde kullanılıyor." Clicking a citation opens a menu with "Sayfayı / biçimi değiştir", "Referansı düzenle" and "Atıfı kaldır".
  - Removing the last citation keeps the reference in "Kayıtlı referanslar" (Review Focus 3).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Author entry: one row per author ("Soyadı", "Adı") plus a "Kurum" toggle that switches the row to a single name field. The year field accepts a number, "t.y." or "baskıda".
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(editor): Referans ekle with DOI lookup and APA preview`

## Stage D — Preview

### Task 12: Önizle

**Files:**
- Create: `src/styles/prose.css` (the `.prose` rules moved out of `PostView.astro`, written as plain selectors), `src/admin/lib/preview.ts`, `src/admin/ui/editor/PreviewDialog.tsx`
- Modify: `src/views/PostView.astro` (import `prose.css`, delete the moved rules), `src/pages/admin/index.astro` (import `prose.css`), `EditorPage.tsx` ("Önizle" button)
- Test: `tests/unit/admin/preview.test.ts`, `tests/build/blog.test.ts` (unchanged assertions must still pass), `tests/build/a11y-basics.test.ts`

**Interfaces:**
- Consumes: `docToMarkdown(doc, lang, refs)`, `bibliography`, `formatReferenceHtml`, `citedIds`.
- Produces: `renderPreviewHtml(draft: Draft, lang: Lang, imageUrl: (name: string) => string | null): string`. It returns the HTML of the header (title, subtitle or description) and the `.prose` body, then the references section with the same markup as `References.astro`.

- [ ] **Step 1: Write failing tests.**
  - A lone image paragraph becomes `<figure><img src="blob:…"><figcaption>…</figcaption></figure>`, using `imageUrl`.
  - A callout gives `<aside class="callout">`. A citation keeps its `<cite>`.
  - The references section lists the cited references only.
  - A raw `<script>` typed as text appears escaped.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `marked` with `gfm: true`, plus a renderer for lone-image paragraphs (same rule as `loneImageCaption`).
  - The dialog is full screen, always uses the light site look (`data-theme` is ignored inside it), and has a "Kapat" button. It shows the language selected by the TR/EN buttons.
  - YouTube boxes show the same placeholder link as on the site.
- [ ] **Step 4: Run** `npm test && npm run test:build`. Expected: PASS, including the unchanged blog build assertions (the prose move must not change the site).
- [ ] **Step 5: Commit** `feat(editor): preview with the site's own styles`

## Stage E — Version history

### Task 13: Snapshots in Apps Script

**Files:**
- Modify: `apps-script/src/drive.ts`, `apps-script/src/main.ts`, `src/admin/api/types.ts`, `src/admin/api/http.ts`, `src/admin/api/mock.ts`, `tests/unit/apps-script/fake-gas.ts` (only if needed)
- Test: `tests/unit/apps-script/drive.test.ts`, `tests/unit/apps-script/main.test.ts`, `tests/unit/admin/http.test.ts`

**Interfaces:**
- Produces:
  - `Api.saveDraft(draft: Draft, opts?: { snapshot?: boolean })`, sent on the wire as `{ draft, snapshot }`.
  - `Api.listVersions(key: string): Promise<{ versions: VersionSummary[] }>` (action `drafts.versions`).
  - `Api.getVersion(key: string, name: string): Promise<{ draft: Draft }>` (action `drafts.version`).
  - `type VersionSummary = { name: string; rev: number; savedAt: string; title: { tr: string; en: string } }`.
  - Storage: `Klinikterapist Panel/surumler/<key>/<rev>-<YYYYMMDDTHHMMSSZ>.json`, holding the **previous** stored draft. Names must match `/^\d+-\d{8}T\d{6}Z\.json$/`.

- [ ] **Step 1: Write failing tests** (fake GAS, controlled `now`).
  - The first save of a new draft makes no snapshot.
  - A save 11 minutes after the last snapshot makes a snapshot of the stored copy (its `rev` is the old rev). A save 3 minutes after does not.
  - `snapshot: true` always makes one (Review Focus 5).
  - A snapshot older than 30 days is trashed on the next save.
  - `drafts.versions` lists newest first. `drafts.version` with a bad name is `bad_request`; with a missing name it is `not_found`.
  - `drafts.delete` also trashes `surumler/<key>`.
  - Snapshot work happens inside the existing `withLock`. A `conflict` save writes no snapshot.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The time of the last snapshot comes from the newest file name, so no extra metadata file is needed. The mock API keeps snapshots in memory with the same rules.
- [ ] **Step 4: Run** `npm test` and `npm run gas:build`. Expected: PASS and a successful bundle.
- [ ] **Step 5: Commit** `feat(apps-script): draft version snapshots`

### Task 14: "Sürüm geçmişi" in the editor

**Files:**
- Create: `src/admin/lib/versions.ts`, `src/admin/ui/editor/VersionsDialog.tsx`
- Modify: `EditorPage.tsx` (footer button, restore path through the autosave save with `snapshot: true`)
- Test: `tests/unit/admin/versions.test.ts`, `tests/unit/admin/versions-dialog.test.tsx`

**Interfaces:**
- Consumes: Task 13 API.
- Produces:
  - `restoreLang(current: Draft, version: Draft, lang: Lang): Draft`. It copies `title`, `subtitle`, `doc` and `references` of `lang` from `version`. It keeps `current.rev`, the other language, `category`, `cover`, `publishedAt` and the slug/SEO fields.
  - `relativeLabel(iso: string, now: Date): string` gives "Bugün 14.32", "Dün 21.05" or "12 Ekim 09.10".

- [ ] **Step 1: Write failing tests.**
  - `restoreLang` changes only the chosen language's four fields.
  - `relativeLabel` gives the three forms above.
  - Dialog:
    - lists the versions with their labels;
    - clicking one shows its text read-only;
    - "Bu sürüme dön" calls `saveDraft` with `snapshot: true` and the restored draft;
    - the editor then shows the restored text;
    - an empty list shows "Henüz kayıtlı bir önceki sürüm yok.";
    - a backend that has not been updated yet (`bad_request` "Bilinmeyen işlem") shows "Sürüm geçmişi için Apps Script'in güncellenmesi gerekiyor." instead of crashing.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run test:build && npm run check:launch`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(editor): version history with per-language restore`

**After Task 14 (owner step, not code):** the backend must be updated with `npm run gas:push` then `npm run gas:deploy`. The deploy keeps the same URL. Do this together with the owner before pushing Stage E. Verify in the Apps Script "Yürütmeler" log that `drafts.versions` runs.
