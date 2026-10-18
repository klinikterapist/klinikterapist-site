# Site D — Panel Fixes and Substack Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship stage 1 of the site redesign:
- the owner's eight small panel fixes (spec §6);
- the Substack link (spec §5.11);
- the new site name (spec §5.11).

**Architecture:** Panel-only edits in `src/admin/ui/editor/**` and `src/admin/lib/checklist.ts`, plus two data-file edits. It reuses Plan A's side rail (`SideRail.tsx`, `RailPanel`), `useHistoryLayer`, kit components and the Lucide `icons.tsx`.

**Tech Stack:** React 19, Vitest + Testing Library, lucide-react 1.51.0.

**Spec:** `docs/superpowers/specs/2026-10-18-site-yeniden-tasarim-design.md` (§6, §5.11). Background: Plan A of panel v3, already merged to `main`.

## Global Constraints

- Branch from `main` (e.g. `site-redesign`); one branch for plans D, E and F, with per-task commits. Never push without the owner's explicit OK.
- Panel copy is Turkish, plain and non-technical. Exact strings from the spec:
  - "← Düzenlemeye dön"
  - "Bazı uygulamalar site adını gösterir, bazıları yalnızca adresi."
  - "Kapak görselinin alt metni (Türkçe)" / "Kapak görselinin alt metni (İngilizce)"
  - the checklist help text quoted in spec §6 item 2
- Site name: TR "Psikolog Osman Güneş Özkurt", EN "Psychologist Osman Güneş Özkurt".
- Substack URL: `https://substack.com/@klinikterapist`.
- Lucide icons come only through `src/admin/ui/icons.tsx`.
- `npm test`, `npm run test:build` and `npm run check` (no new errors in touched files) must be green before each commit.
- Commits end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

- **A help "?" opened inside the bottom sheet on a phone.** Expect: it opens inline. It must not close the sheet or push a history entry. Tested in Task 2.
- **The checklist panel opening from a blocked Yayınla while another panel is open.** Expect: it switches to the checklist panel, and only one panel is open. Tested in Task 3.
- **A cover removed after its alt text was typed.** Expect: the alt-text field disappears and the checklist item for alt text disappears too. The stored alt text stays in the draft and is harmless. Tested in Task 3.

---

### Task 1: Preview "← Düzenlemeye dön", site name, Substack link

**Files:**
- Modify: `src/admin/ui/editor/PreviewDialog.tsx`, `src/data/seo.json`, `src/data/links.json`
- Test: `tests/unit/admin/editor.test.tsx` (preview test), `tests/unit/seo.test.ts`

- [ ] **Step 1: Write the failing tests.**
  - The preview has `getByRole('button', { name: '← Düzenlemeye dön' })` and no "Kapat" button. Clicking it closes the preview and the hash stays `#/yazi/<key>`.
  - `seo.test.ts`, against the real data via `getSeo()`: `siteName.tr === 'Psikolog Osman Güneş Özkurt'`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Rename the button. Keep it in the same place, using the same `close()` from `useHistoryLayer`.
  - Update `seo.json` `siteName` (TR and EN).
  - Append to `links.json`: `{ "id": "substack", "label": "Substack", "url": "https://substack.com/@klinikterapist", "icon": "substack", "inHero": true, "inFooter": true }`.
- [ ] **Step 4: Run** `npm test` and `npm run test:build`. Expected: PASS. If `NewsletterBox` now appears on the blog page, update the existing assertions about it.
- [ ] **Step 5: Commit.** Message: `feat: preview back button text, site name, Substack link`.

### Task 2: Help "?" popovers

**Files:**
- Create: `src/admin/ui/kit/HelpTip.tsx`, exported from `kit/index.tsx`
- Modify: `src/admin/ui/editor/SeoPanel.tsx`, `src/admin/ui/editor/MetaPanel.tsx`, the checklist panel (Task 3), `src/admin/ui/admin.css`
- Create: `src/admin/lib/help-texts.ts`
- Test: `tests/unit/admin/kit.test.tsx`, `tests/unit/admin/editor.test.tsx`

**Interfaces:**
- Produces: `HelpTip({ label: string; children: ReactNode })`. It is a small round "?" button with `aria-expanded`, `aria-controls` and `aria-label={\`${label} hakkında bilgi\`}`. It toggles an inline region below the field's label row.
  - It closes on Escape and on a second click.
  - It is not a modal and does not use `useHistoryLayer`.
- Produces: `HELP` in `src/admin/lib/help-texts.ts`, with keys `focusKeyword`, `seo`, `seoTitle`, `description`, `slug`, `coverAlt`, `checklist`.
  - Plain Turkish, 2–4 sentences each.
  - `checklist` is the exact text from spec §6 item 2.
  - `focusKeyword` says what it is, where the panel checks it (title, meta description, first paragraph, slug, other posts), and how to choose one. Keep it short.

- [ ] **Step 1: Write the failing tests.**
  - `kit.test.tsx`: clicking "? Odak kelime hakkında bilgi" reveals the text, and clicking again hides it.
  - `editor.test.tsx`: the SEO panel heading and the focus keyword field each have a HelpTip. The Meta panel has HelpTips on SEO başlığı, Meta açıklama and URL kısa adı.
  - Mobile sheet case: at width 500, open Meta, open the Meta açıklama help. The dialog "Meta" is still open and `history.length` is unchanged.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Pass the field's `field` id so the region is placed next to it. Add an optional `help?: ReactNode` prop to kit `Field` and `Select` that renders a `HelpTip` beside the label.
- [ ] **Step 4: Run the tests and the full suites.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(editor): help popovers for SEO and meta fields`.

### Task 3: Checklist gets its own rail panel, cover alt moves to Ayarlar, new Meta icon

**Files:**
- Modify:
  - `src/admin/lib/checklist.ts`: `RailPanel` gains `'checklist'`; coverAlt items point to `'settings'`
  - `src/admin/ui/editor/SideRail.tsx`: icons, order, dot moves
  - `src/admin/ui/editor/SettingsPanel.tsx`: remove the checklist; add the cover alt field
  - `src/admin/ui/editor/MetaPanel.tsx`: remove the cover alt field
  - `src/admin/ui/editor/EditorPage.tsx`: a blocked Yayınla opens `'checklist'`
- Create: `src/admin/ui/editor/ChecklistPanel.tsx`
- Test: `tests/unit/admin/checklist.test.ts`, `tests/unit/admin/editor.test.tsx`

**Interfaces:**
- `type RailPanel = 'settings' | 'seo' | 'meta' | 'checklist'`.
- Rail order and icons: Ayarlar `Settings`, SEO `SearchCheck`, Meta `FileText` (replaces `Tag`), Kontrol listesi `CircleCheck`.
- The yellow "missing" dot moves from Ayarlar to Kontrol listesi.
- `ChecklistPanel` holds the list (`aria-label="Yayın kontrol listesi"`). Its heading carries a `HelpTip` with `HELP.checklist`.

- [ ] **Step 1: Update and add the failing tests.**
  - `checklist.test.ts`: the coverAlt item has `panel: 'settings'`, `field: 'coverAlt'`.
  - `editor.test.tsx`:
    - the rail has four buttons in the order Ayarlar, SEO, Meta, Kontrol listesi;
    - a blocked Yayınla opens region "Kontrol listesi" (dialog under 768px);
    - with a cover set, the Ayarlar panel shows "Kapak görselinin alt metni (Türkçe)" right after the cover controls, and the Meta panel no longer has it;
    - clicking the checklist item "Türkçe: Kapak görselinin alt metni" opens Ayarlar and focuses that field;
    - the Kontrol listesi button shows the missing dot and Ayarlar does not.
  - Update the existing tests that expected the checklist inside Ayarlar.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the `panel.rail` localStorage key. A stored value of `'checklist'` is now valid; unknown values fall back to the default.
- [ ] **Step 4: Run the full suites.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(editor): checklist rail panel, cover alt in Ayarlar, new Meta icon`.

### Task 4: Share preview shows the site name and a note

**Files:**
- Modify: `src/admin/ui/editor/MetaPanel.tsx` (the `SocialPreview` part)
- Test: `tests/unit/admin/seo-panel.test.tsx` or `editor.test.tsx`

- [ ] **Step 1: Write the failing test.** The social preview card shows "KLINIKTERAPIST.COM" and, under it, the TR site name read from `src/data/seo.json` (loaded via the panel's settings read or passed in from EditorPage). Under the card is the note "Bazı uygulamalar site adını gösterir, bazıları yalnızca adresi."
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Load `seo.json` once in EditorPage alongside `loadSiteState` (it is already read in the repo tree) and pass `siteName[lang]` down to the preview.
- [ ] **Step 4: Run the full suites.** Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat(editor): share preview shows the site name`.

### Task 5: Browser check

- [ ] Start the dev server with `?mock`. At desktop width and at 375px, in both panel themes, check:
  - the four rail icons;
  - the help popovers;
  - the checklist panel;
  - cover alt under the cover;
  - the share preview;
  - "← Düzenlemeye dön" in the preview.

  Take screenshots for the owner. If anything is wrong, fix it in the relevant task's files with a test, then commit.
