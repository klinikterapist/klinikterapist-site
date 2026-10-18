# Panel v3 — A: Fixes, Social Accounts, Icons, Panel Look, Editor Side Rail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship phases 1–3 of the panel v3 spec. That covers the preview "back" fix, TikTok/Threads/X with Contact cards for every social account, Lucide icons and the polished panel shell, and the editor's new top bar (flag language buttons, Yayınla on top) with the three-icon side rail (Ayarlar / SEO / Meta) and its publish checklist.

**Architecture:** Panel-only changes in `src/admin/ui/**` plus pure helpers in `src/admin/lib/**`. Site changes are limited to `links` data and schema, `src/lib/icons.ts` and `ContactView.astro`. Overlays join browser history through one hook, so "back" closes them. The side rail replaces the single `editor-side` column. The old `PostSettings` and `SeoPanel` are split into three panels that share the existing draft `update` callbacks.

**Tech Stack:** Astro 7, React 19, Tiptap 3, Vitest 5 + Testing Library (jsdom), `lucide-react` (new).

**Spec:** `docs/superpowers/specs/2026-10-18-panel-v3-design.md` (§5.1–§5.4, §5.11, §5.12). Plans B and C cover the rest:
- `2026-10-18-panel-v3-b-gorseller-ve-buyuk-harf.md`
- `2026-10-18-panel-v3-c-planlama-ve-istatistik.md`

## Global Constraints

- Work on a branch cut from `main` (e.g. `panel-v3`). Never push to `main` without the owner's explicit OK: a push is a live deploy.
- All panel copy is Turkish, plain and non-technical. Exact labels from the spec: "Türkçe Sayfa", "English Page", "Önizle", "Yayınla", "Planla" (Plan C), "Değişiklikleri yayınla", "Ayarlar", "SEO", "Meta".
- No new server or paid service. The visitor-facing site ships no new JavaScript in this plan.
- Flags are inline SVG, never emoji: Windows shows flag emoji as letters.
- Both panel themes stay readable (WCAG AA). No new colours beyond `--cream`, `--forest`, `--ink` and the existing dark greys.
- iPhone Safari must work: no overflowing top bar, side panels open as a bottom sheet under 768px.
- `npm test` and `npm run test:build` stay green after every task. Run both before each commit.
- Existing drafts and Markdown must open and render unchanged.
- Keep `SAFE_LINK`, raw-HTML escaping and the owner-only write rules as they are.

## Review Focus

- **Back gesture with a nested overlay** (e.g. the "⋯" menu or a confirm dialog open over the editor). Expect: back closes only the top layer and never leaves the post. This is tested in Task 1 (the dialog that opens first closes last).
- **Opening a post by URL, then pressing back with no overlay.** Expect: normal navigation to the previous page. The history hook must not swallow it. Tested in Task 1.
- **A link in `links.json` whose `icon` is `email`.** Expect: the Contact page still shows exactly one e-mail card, the one from `contact.json`. Tested in Task 2.
- **Narrow phone width (375px) in the editor top bar.** Expect: flags with ✓/⚠ only, no horizontal page scroll, Yayınla still visible. Covered by the Task 5 browser check.
- **Yayınla pressed while the other language is incomplete.** Expect: the Ayarlar panel opens and the checklist marks the missing items. Clicking an item switches to that language and opens the panel that holds the field. Tested in Task 5.

---

### Task 1: Overlays join browser history (preview "back" fix)

**Files:**
- Create: `src/admin/ui/history-layer.ts`
- Modify: `src/admin/ui/editor/PreviewDialog.tsx`, `src/admin/ui/editor/VersionsDialog.tsx`
- Test: `tests/unit/admin/history-layer.test.tsx`, add a case to `tests/unit/admin/editor.test.tsx`

**Interfaces:**
- Produces: `useHistoryLayer(onClose: () => void): () => void`. Call it while an overlay is mounted. On mount it pushes one history entry (`history.pushState({ layer: <unique id> }, '', location.href)`). A `popstate` whose state is not that entry calls `onClose`. The returned `close()` must be used by the overlay's own close paths (button, Esc). It calls `history.back()` if the entry is still on top, so no stray entry is left behind. Plan B's crop dialogs use the same hook.

- [ ] **Step 1: Reproduce the bug in a test.** Add `it('back while previewing closes the preview and stays on the post')` to `editor.test.tsx`:
  - set `location.hash = '#/yazi/<key>'` and open "Önizle";
  - call `history.back()` and wait for `popstate`;
  - assert `screen.queryByRole('dialog', { name: 'Önizleme' })` is null, `location.hash === '#/yazi/<key>'`, and the editor heading "Yazıyı düzenle" is still in the document.
- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run tests/unit/admin/editor.test.tsx -t "back while previewing"`. Expected: FAIL, because the dialog is still open or the hash changed. If it unexpectedly passes in jsdom, check by hand in the browser preview: Önizle, then Alt+←. Note what you found in the commit message.
- [ ] **Step 3: Write `history-layer.test.tsx`:**
  - `'pushes one entry on mount and closes on back'`: `history.length` grows by 1; `history.back()` → `onClose` called once.
  - `'close() removes its own entry'`: after `close()`, `history.length` is back to the original value and `onClose` is not called twice.
  - `'two layers: back closes the top one only'`.
  - `'without a layer, back is not intercepted'`: no listener remains after unmount.
- [ ] **Step 4: Implement `useHistoryLayer`** in `src/admin/ui/history-layer.ts`. Use `PreviewDialog` and `VersionsDialog` with it: their "Kapat" button and Esc call the returned `close`; `onClose` stays the parent's state setter.
- [ ] **Step 5: Run** `npx vitest run tests/unit/admin/history-layer.test.tsx tests/unit/admin/editor.test.tsx tests/unit/admin/versions-dialog.test.tsx`. Expected: PASS.
- [ ] **Step 6: Commit** with `fix(editor): back closes the preview instead of leaving the post`.

### Task 2: TikTok, Threads, X and Contact cards for every social account

**Files:**
- Modify: `src/lib/schemas.ts:71` (icon enum), `src/lib/icons.ts`, `src/admin/ui/settings/screens/lists.tsx:66`, `src/data/links.json`, `tests/fixtures/data/links.json`, `src/views/ContactView.astro:20-29`, `src/i18n/ui.ts:95-98`
- Test: `tests/unit/settings.test.ts`, `tests/build/pages.test.ts`, `tests/unit/seo.test.ts`

**Interfaces:**
- Produces: `Link['icon']` becomes `'instagram' | 'linkedin' | 'medium' | 'substack' | 'email' | 'youtube' | 'x' | 'tiktok' | 'threads'`. `ICONS` gains `tiktok` and `threads`, and `x` is redrawn as the X logo.

- [ ] **Step 1: Write the failing tests.**
  - `settings.test.ts`: `expect(() => parseLinks(link('tiktok', 'https://www.tiktok.com/@klinikterapist'))).not.toThrow()`, and the same for `'threads'`.
  - `pages.test.ts` (fixture build): the contact page `ul.channels` has one card per non-email link in the fixture `links.json` + the e-mail card + the Randevu card. Card titles follow `links.json` order between e-mail (first) and Randevu (last). Add TikTok, X and Threads to the fixture `links.json` so the test covers them.
  - `seo.test.ts`: `ld.sameAs` contains `'https://www.tiktok.com/@klinikterapist'`. Reuse the existing sameAs test's data source.
- [ ] **Step 2: Run** `npm test -- settings seo`, then `npm run test:build`. Expected: FAIL (enum and cards are missing).
- [ ] **Step 3: Implement.**
  - **Schema and links:** add the enum values and `LINK_ICONS` entries. In the Simge select, show each option's label as its readable name (`TikTok`, `Threads`, `X`, …). Append to `src/data/links.json`, all with `inHero: true, inFooter: true`:
    - `{ "id": "tiktok", "label": "TikTok", "url": "https://www.tiktok.com/@klinikterapist", "icon": "tiktok" }`
    - `{ "id": "x", "label": "X", "url": "https://x.com/klinikterapist", "icon": "x" }`
    - `{ "id": "threads", "label": "Threads", "url": "https://www.threads.com/@klinikterapist", "icon": "threads" }`
  - **Icons:** draw `tiktok`, `threads` and the new `x` in the same 24×24 stroke style as the others. Simple Icons (CC0) shapes are the reference.
  - **ContactView:** build the channels list as:
    1. e-mail from `contact.json`;
    2. `links.filter((l) => l.icon !== 'email')`, in file order, each with `subtitle: t(lang, \`${l.icon}Hint\`)` (fall back to the label if a key is missing);
    3. Randevu.
  - **Hints:** add to `ui.ts`, TR / EN:
    - `tiktokHint`: "Kısa videolar" / "Short videos"
    - `xHint`: "Kısa notlar" / "Short notes"
    - `threadsHint`: "Sohbetler" / "Conversations"
    - `mediumHint`: "Uzun yazılar" / "Long reads"
    - `substackHint`: "Bülten" / "Newsletter"
    - `youtubeHint`: "Videolar" / "Videos"
    - Change `linkedinHint` to "Mesleki geçmiş" / "Professional background".
- [ ] **Step 4: Run** `npm test` and `npm run test:build`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(site): TikTok, Threads and X; contact page lists every social account`.

### Task 3: Lucide icons and the panel shell

**Files:**
- Modify: `package.json` (add `lucide-react`), `src/admin/ui/Shell.tsx`, `src/admin/ui/editor/Toolbar.tsx`, `src/admin/ui/settings/fields.tsx:208-222` (`SettingsForm`), `src/admin/ui/Home.tsx:452-457`, `src/admin/ui/admin.css`
- Create: `src/admin/ui/icons.tsx`
- Test: `tests/unit/admin/app.test.tsx`, `tests/unit/admin/home.test.tsx`, `tests/unit/admin/settings.test.tsx`

**Interfaces:**
- Produces:
  - `src/admin/ui/icons.tsx` exports `Icon` (a thin wrapper: `({ as: LucideIcon, size = 18, label? })`, `aria-hidden` unless `label` is set) and re-exports the Lucide components the panel uses.
  - `SETTINGS_SCREENS` becomes `{ id: string; label: string; icon: LucideIcon; intro: string }[]` and stays exported from `Shell.tsx`.
  - Icon per screen (spec §5.1):

    | id | Lucide icon |
    |---|---|
    | profil | `UserRound` |
    | ana-sayfa | `LayoutTemplate` |
    | linkler | `Share2` |
    | hakkimda | `IdCard` |
    | kaynaklar | `BookOpen` |
    | iletisim | `Mail` |
    | kategoriler | `Tags` |
    | seo | `Search` |
    | yasal | `Scale` |
- `SettingsForm` reads its icon and intro from `SETTINGS_SCREENS` by a new optional `screen` prop. Every screen passes its id.

- [ ] **Step 1: Write the failing tests.**
  - `app.test.tsx` `'the theme switch sits at the bottom of the menu'`:
    - `within(screen.getByRole('navigation', { name: 'Panel menüsü' })).getByRole('button', { name: /Karanlık mod|Açık mod/ })` exists;
    - `document.querySelector('.panel-tools')` is null.
  - `home.test.tsx`: `screen.queryByRole('button', { name: 'Yeni yazı' })` is null inside `<Home />`.
  - `settings.test.tsx`: the Sosyal ve linkler screen header contains an `svg` and the intro "Sitede görünen sosyal hesaplarınız."
- [ ] **Step 2: Run** `npx vitest run tests/unit/admin/app.test.tsx tests/unit/admin/home.test.tsx tests/unit/admin/settings.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Install `lucide-react` (exact version pinned in `package.json`).
  - Replace the hand-drawn `ICONS` in `Shell.tsx` and `Toolbar.tsx` with Lucide components. Toolbar mapping:
    - `Undo2`, `Redo2`, `Link`, `Image`, `Youtube`, `Quote`
    - `List`, `ListOrdered`, `BookOpenText` (Referans ekle), `Ellipsis`
    - Kalın / İtalik / Üstü çizili / Vurgula: `Bold`, `Italic`, `Strikethrough`, `Highlighter`
  - Move the theme toggle into `ul.nav-end` above "Çıkış yap" (`Moon` / `Sun`). Delete `.panel-tools`.
  - Remove the "Yeni yazı" button from `Home`'s `screen-head`.
  - Give each screen a one-line `intro` in Turkish, for example:
    - linkler: "Sitede görünen sosyal hesaplarınız."
    - profil: "Adınız, unvanınız ve fotoğrafınız."
    - Write the remaining seven in the same tone.
- [ ] **Step 4: Run** `npm test`. Expected: PASS. Fix any existing test that looked up the old "Yeni yazı" button on Home.
- [ ] **Step 5: Commit** with `feat(panel): Lucide icons, per-screen icons, theme switch in the menu`.

### Task 4: Visual polish — spacing scale, button levels, empty states

**Files:**
- Modify: `src/admin/ui/admin.css` (tokens at `:root` / `html[data-theme='dark']`, `.k-btn-*`, cards, nav), `src/admin/ui/kit/index.tsx`, `src/admin/ui/Home.tsx`, `src/admin/ui/PostsList.tsx`
- Test: `tests/unit/admin/kit.test.tsx` (new), `tests/build/admin-css.test.ts` must stay green

**Interfaces:**
- Produces: `EmptyState({ icon: LucideIcon; children: ReactNode; action?: ReactNode })` in `kit/index.tsx`. CSS tokens:
  - spacing: `--k-space-1..6` = 4, 8, 12, 16, 24, 32px
  - radii: `--k-radius` (cards) and `--k-radius-sm` (inputs, buttons)
  - shadows: `--k-shadow-1` and `--k-shadow-2`

- [ ] **Step 1: Write the failing test.** In `kit.test.tsx`, `'EmptyState shows the icon, text and action'`: render `<EmptyState icon={FileText} action={<a href="#/x">Yeni</a>}>Taslak yok.</EmptyState>` and assert an `svg`, the text and the link are present.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add `EmptyState`. Use it for the empty texts in Home ("Taslak yok.", "Henüz yayınlanmış yazı yok.", "Eksik yok.") and in PostsList.
  - Rewrite the admin CSS onto the tokens. Button levels per spec §5.2: primary filled forest, secondary outlined, ghost text-only. The active nav item gets a soft background.
  - Keep every editor rule that competes with `prose.css` more specific than it: `admin-css.test.ts` enforces this.
- [ ] **Step 4: Run** `npm test` and `npm run test:build`. Expected: PASS.
- [ ] **Step 5: Check in the browser.** Start the dev server with the mock backend. Screenshot Home, Yazılar and one settings screen, each in light and dark mode at desktop width and at 375px. Check: no horizontal scroll, AA-readable text, each icon is distinct.
- [ ] **Step 6: Commit** with `style(panel): spacing scale, button levels, empty states`.

### Task 5: Editor side rail with Ayarlar / SEO / Meta, checklist, and the new top bar

**Files:**
- Create:
  - `src/admin/lib/checklist.ts`
  - `src/admin/ui/editor/SideRail.tsx`
  - `src/admin/ui/editor/SettingsPanel.tsx`
  - `src/admin/ui/editor/MetaPanel.tsx`
  - `src/admin/ui/editor/LangButtons.tsx`
  - `src/admin/ui/flags.tsx`
- Modify:
  - `src/admin/ui/editor/EditorPage.tsx`: top bar lines 523–555, aside lines 600–641
  - `src/admin/ui/editor/SeoPanel.tsx`: keep the score, checks and focus keyword; move the SERP and social previews out to `MetaPanel`
  - `src/admin/ui/admin.css`
- Delete: `src/admin/ui/editor/PostSettings.tsx`, after its fields move. Keep the exported `typingSlug` by moving it to `MetaPanel.tsx`, and update its imports.
- Test:
  - `tests/unit/admin/checklist.test.ts` (new)
  - `tests/unit/admin/editor.test.tsx`
  - `tests/unit/admin/seo-panel.test.tsx`

**Interfaces:**
- Consumes: `canPublish`, `missingFields`, `LANG_LABEL` (`src/admin/lib/draft.ts`); `runSeoChecks` (`src/admin/lib/seo-check.ts`); `useHistoryLayer` (Task 1) for the mobile bottom sheet.
- Produces:
  - `type RailPanel = 'settings' | 'seo' | 'meta'`. The open panel, or `null`, is stored in localStorage key `panel.rail`. The old `panel.side` key is ignored.
  - `type ChecklistItem = { id: string; label: string; done: boolean; required: boolean; lang: Lang | null; panel: RailPanel; field: string }`.
  - `publishChecklist(d: Draft, seoScore: Record<Lang, number>): ChecklistItem[]`.
    - Required items mirror `canPublish` exactly, with the same labels as `missingFields`, plus "Kategori". They also include one item per language, "Türkçe: atıfların referansları kayıtlı" / "İngilizce: atıfların referansları kayıtlı". That item is done unless `docToMarkdown(f.doc, lang, f.references)` throws `UnknownReferenceError`, and it points to `panel: 'settings'` with `field: 'references'`. Clicking it only switches language, because the citation lives in the text.
    - Recommended items, all `required: false`, labels verbatim:
      - "Kapak görseli eklendi"
      - "Türkçe: alt başlık var" / "İngilizce: alt başlık var"
      - "Türkçe: görsellerin alt metni var" / "İngilizce: görsellerin alt metni var"
      - "Türkçe: SEO puanı 80 ve üzeri" / "İngilizce: SEO puanı 80 ve üzeri"
      - "Türkçe: meta açıklama 120–158 karakter" / "İngilizce: meta açıklama 120–158 karakter"
  - Field placement:

    | Panel | Fields |
    |---|---|
    | `settings` | category, publishedAt, cover |
    | `meta` | slug, seoTitle, description, coverAlt |
    | `seo` | focusKeyword |

  - `SettingsPanel`, `MetaPanel` and `SeoPanel` each take `{ draft, lang, onShared, onLang, images, … }`, the same callback shapes `PostSettings` uses today.
  - `focusField(id: string)`: `SettingsPanel` and `MetaPanel` give each input `data-field="<field>"`. The checklist scrolls to it and focuses it.

- [ ] **Step 1: Write `checklist.test.ts`.**
  - `'required items match canPublish'`: for an empty `newDraft`, `items.filter(i => i.required && !i.done).length === describeMissing(canPublish(d)).length`.
  - `'a complete draft has every required item done; recommended ones stay open without a cover'`.
  - `'coverAlt is required per language only when a cover is set'`.
  - `'each item names the panel that holds its field'`: description → `'meta'`, focusKeyword → `'seo'`, category → `'settings'`.
- [ ] **Step 2: Write the editor tests in `editor.test.tsx`.**
  - `'language buttons are named "Türkçe Sayfa" and "English Page" and show a flag'`: `getByRole('button', { name: /Türkçe Sayfa/ })` contains an `svg`.
  - `'Yayınla sits in the top bar next to Önizle'`: both buttons are inside `.editor-top-actions`, Yayınla comes after Önizle in DOM order, and "Yazı ayarlarını gizle" no longer exists.
  - `'the rail opens one panel at a time and remembers it'`:
    - click `getByRole('button', { name: 'SEO' })` → the SEO panel region is visible; click `'Meta'` → the SEO panel is gone and the Meta one is visible;
    - `localStorage.getItem('panel.rail') === 'meta'`;
    - click `'Meta'` again → no panel, and `panel.rail` is `'closed'`.
  - `'Yayınla with missing fields opens Ayarlar and the checklist'`: with the English side empty, click "Yayınla". Assert:
    - no confirm dialog;
    - the Ayarlar panel is open;
    - `getByRole('list', { name: 'Yayın kontrol listesi' })` contains "İngilizce: Meta açıklama" marked not done.
  - `'clicking a checklist item switches language and opens the right panel'`: click "İngilizce: Meta açıklama". The EN button is `aria-pressed=true`, the Meta panel is open, and the description textarea has focus.
  - `'the ⋯ menu holds Taslağı sil'`: open `getByRole('button', { name: 'Diğer işlemler' })`, and the menu item "Taslağı sil" opens the existing delete confirm.
  - Update the existing tests that clicked "Yayınla" in the side card. The name stays "Yayınla", so most keep working.
- [ ] **Step 3: Run** `npx vitest run tests/unit/admin/checklist.test.ts tests/unit/admin/editor.test.tsx tests/unit/admin/seo-panel.test.tsx`. Expected: FAIL.
- [ ] **Step 4: Implement `publishChecklist`** in `src/admin/lib/checklist.ts`. A figure's alt text is missing when any `figure` node in that language's doc has an empty `alt`.
- [ ] **Step 5: Implement `flags.tsx`, `LangButtons`, `SideRail` and the three panels. Rewire `EditorPage`.**
  - **Flags:** `FlagTR` and `FlagGB`, 20×14 SVG with `aria-hidden`.
  - **LangButtons:** at widths under 560px, the visible name is hidden with the existing `.k-visually-hidden` and the flag plus ✓/⚠ remain.
  - **Top bar order:**
    1. `← Yazılar`
    2. save status
    3. LangButtons
    4. Önizle
    5. Yayınla (primary; label "Değişiklikleri yayınla" when `draft.published`)
    6. the "⋯" menu (`aria-label="Diğer işlemler"`) with "Yayından kaldır" and "Değişiklikleri at" / "Taslağı sil", under the same conditions as today
  - **Rail:** a vertical strip on the right edge. Each icon button has `aria-pressed` and a `title`.
    - Icons: `Settings` (Ayarlar), `SearchCheck` (SEO), `Tag` (Meta).
    - A small dot on SEO uses the score colour. A yellow dot on Ayarlar shows when a required item is missing.
    - Under 768px the open panel renders as a bottom sheet (`role="dialog"`, `aria-label` = panel name) and registers `useHistoryLayer`. The default there is closed.
  - **SettingsPanel**, in this order:
    1. status badge (Taslak / Yayında)
    2. Kategori
    3. Yayın tarihi
    4. Kapak görseli (the current upload / change / remove controls)
    5. the checklist (`<ul aria-label="Yayın kontrol listesi">`), with required items first; each item is a button
- [ ] **Step 6: Run** `npm test` and `npm run test:build`. Expected: PASS.
- [ ] **Step 7: Check in the browser** (mock backend), at desktop width and at 375px, in both themes:
  - the top bar fits;
  - the bottom sheet opens and closes;
  - the phone back gesture (Alt+←) closes the sheet;
  - the checklist navigation works.

  Take screenshots.
- [ ] **Step 8: Commit** with `feat(editor): side rail (Ayarlar, SEO, Meta), publish checklist, flag language buttons, Yayınla in the top bar`.

---

## Self-review notes

- Spec coverage of this plan:
  - §5.12 → Task 1
  - §5.11 → Task 2
  - §5.1 → Tasks 2 (site icons) and 3 (panel)
  - §5.2 → Tasks 3 and 4
  - §5.3 → Task 5
  - §5.4 and §5.4.1 → Task 5

  The "Planla" label and "Planlandı" badge from §5.3 and §5.4 belong to Plan C (Task C4). §5.6 (cover in the editor) belongs to Plan B; until then the cover controls stay in `SettingsPanel`.
- After this plan the owner can use everything here without waiting for Plans B and C. Deploying is the owner's call.
