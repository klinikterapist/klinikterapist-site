# Panel v3 — B: Cover in the Editor, Image Crop / Shape / Size, Drop Cap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship spec phases 4–5:
- the cover shown under the subtitle at a fixed 16:9, with owner-set crop and zoom;
- a crop / shape / size editor for body images;
- an owner-placed drop cap.

All three must look the same in the editor, the preview and the site.

**Architecture:** One crop model is shared by the cover and the figures. A crop is a rectangle in percent of the original image. The browser renders the cropped WebP that gets published. The original stays as `<name>-orig.<ext>` next to it (Drive while it is a draft, the post folder once published), so the crop can be changed later. Shape, size and crop of a figure are stored in a `<div class="figure" …>` wrapper around the existing image paragraph, the same pattern callouts use. The drop cap is an empty `<span class="dropcap"></span>` at the start of a paragraph, styled with `::first-letter`.

**Tech Stack:** React 19, Tiptap 3, `react-easy-crop` (new; handles drag, wheel and pinch zoom), Canvas, Astro 7 + Sätteri mdast plugin, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-panel-v3-design.md` (§5.6, §5.7, §5.8). Plan A (`2026-10-18-panel-v3-a-gorunum-ve-editor-paneli.md`) must be merged first. This plan uses its `useHistoryLayer`, `SettingsPanel`, `MetaPanel` and Lucide `Icon`.

## Global Constraints

- Everything in Plan A's Global Constraints applies: branch from `main`, no push without the owner's OK, Turkish plain copy, iPhone Safari, both themes, `npm test` and `npm run test:build` green, existing drafts unchanged, `SAFE_LINK` and HTML escaping kept.
- Cover ratio 16:9, output 1600×900 WebP q 0.82. The share image stays 1200×630, derived from the cropped cover.
- Shapes and ratios, verbatim from spec §5.7:

  | Shape | Ratio |
  |---|---|
  | Özgün | own ratio, default |
  | Dikdörtgen | 3:2 landscape, or 2:3 with the direction toggle |
  | Kare | 1:1 |
  | Hap | 2:1, fully rounded ends |
  | Yuvarlak | 1:1 circle |

- Sizes: Tam genişlik (full, default), Orta (~2/3, centred), Küçük (~1/3, centred). Yuvarlak and Kare default to Orta.
- Zoom range 1×–3×.
- Originals are capped at 2000px on the long side, WebP q 0.85. They never reach `dist/`: no page references them.
- Drop cap: at most one per language per post. Only the first word of a paragraph can take it. A leading quote mark grows with the letter. Fraunces, about three lines tall, forest green.
- No visitor-side JavaScript for any of this.

## Review Focus

- **A draft cover with no crop data** (every existing draft). Expect: shown centre-cropped at 16:9 in the editor, preview and site, and "Kapağı ayarla" opens with a centred 16:9 frame. Tested in Task 2.
- **Publishing a live post after changing only a figure's crop.** Expect: the new cropped file replaces the old one and the `-orig` file is kept, not deleted as unused. Tested in Task 3.
- **Hand-written Markdown with a malformed `<div class="figure" data-shape="star">` wrapper.** Expect: it stays plain text and is escaped in the preview. Nothing is styled and nothing crashes. Tested in Task 3.
- **Drop cap on a paragraph that starts with a citation or a bold word.** Expect: the drop cap still applies to the first letter. The citation or bold mark survives the Markdown round trip. Tested in Task 4.
- **A HEIC or very large photo from an iPhone** opened in the crop dialog. Expect: it decodes upright via the existing `resizeImage` path, and the original is downscaled to 2000px before upload. Covered by the Task 1 browser check.

---

### Task 1: Crop model, renderer and the crop dialog

**Files:**
- Create:
  - `src/admin/lib/crop.ts`
  - `src/admin/ui/editor/CropDialog.tsx`
- Modify:
  - `src/admin/lib/image.ts`: add a `original` preset (`{ maxW: 2000, maxH: 2000, type: 'image/webp', q: 0.85 }`) and export a `decodeImage(file | base64)` helper if `resizeImage` does not already expose one
  - `package.json`: add `react-easy-crop` at a pinned exact version
- Test:
  - `tests/unit/admin/crop.test.ts` (new)
  - `tests/unit/admin/crop-dialog.test.tsx` (new)

**Interfaces:**
- Produces:
  - `type CropArea = { x: number; y: number; w: number; h: number }`, in percent of the original (0–100), the same shape as `react-easy-crop`'s `croppedAreaPercentages`.
  - `centredCrop(imgW: number, imgH: number, aspect: number): CropArea`: the largest rectangle of the given ratio, centred.
  - `clampCrop(a: CropArea): CropArea`: keeps the area inside 0–100.
  - `formatCrop(a: CropArea): string` / `parseCrop(s: string): CropArea | null`: the format is `"x,y,w,h"` with at most 2 decimals. Parsing rejects non-numbers, negatives, `x + w > 100.01` and `y + h > 100.01`.
  - `renderCrop(originalBase64: string, area: CropArea, out: { w: number; h: number } | { maxW: number }, type: 'image/webp', q: number): Promise<{ base64: string; ext: 'webp' }>`.
  - `CropDialog` props:
    `{ title: string; imageUrl: string; aspect: number | null; shape?: 'circle' | 'pill' | null; initial: CropArea | null; onApply: (a: CropArea) => void; onClose: () => void; children?: ReactNode }`.
    - `aspect: null` means free crop.
    - `children` holds Plan B Task 3's shape and size controls.
    - The dialog uses `useHistoryLayer`. Its zoom slider is labelled "Yakınlaştır". Its buttons are "Uygula" and "Vazgeç".

- [ ] **Step 1: Write `crop.test.ts`.**
  - `centredCrop(1600, 1600, 16/9)` → `{ x: 0, y: 21.88, w: 100, h: 56.25 }`, compared to 2 decimals.
  - `centredCrop(900, 1600, 16/9)` gives `w: 100`, `h` matching 16:9, and `x: 0`.
  - `parseCrop(formatCrop(a))` round-trips.
  - `parseCrop('10,10,95,10')` → null, because it overflows.
  - `parseCrop('a,b,c,d')` → null.
  - `parseCrop('-1,0,50,50')` → null.
- [ ] **Step 2: Write `crop-dialog.test.tsx`.** Mock `react-easy-crop` with a stub that calls `onCropComplete` with fixed percentages.
  - "Uygula" calls `onApply` with the stub's area.
  - "Vazgeç" calls `onClose`.
  - The slider has `min=1`, `max=3`.
  - The dialog has `role="dialog"` and the given title.
- [ ] **Step 3: Run** `npx vitest run tests/unit/admin/crop.test.ts tests/unit/admin/crop-dialog.test.tsx`. Expected: FAIL.
- [ ] **Step 4: Implement `crop.ts`** (`renderCrop` draws `area` of the decoded image onto a canvas of the output size and reuses `image.ts`'s encode/size checks) **and `CropDialog`** (`cropShape="round"` for circle; the pill gets a CSS mask class over the round-rect frame).
- [ ] **Step 5: Run the tests.** Expected: PASS.
- [ ] **Step 6: Check in the browser** (mock backend, a temporary harness route or Plan B Task 2's cover flow). Test drag, wheel and pinch (emulated touch at 375px), and an iPhone HEIC photo if one is available. Take a screenshot.
- [ ] **Step 7: Commit** with `feat(editor): crop model, renderer and crop dialog`.

### Task 2: Cover under the subtitle at 16:9 with "Kapağı ayarla"

**Files:**
- Modify:
  - `src/admin/api/types.ts` (`Draft`)
  - `src/admin/lib/draft.ts` (`newDraft`, `normalizeDraft`)
  - `src/admin/lib/frontmatter.ts` (`PostFrontmatter`, `ORDER`, `parsePost`)
  - `src/lib/schemas.ts:191-207`
  - `src/lib/posts.ts` (`PostData`)
  - `src/admin/lib/publish.ts:96-140`
  - `src/admin/lib/posts-repo.ts` (`liveToDraft`)
  - `src/admin/ui/editor/PostEditor.tsx`: render the cover block between the subtitle and the text
  - `src/admin/ui/editor/SettingsPanel.tsx`: cover buttons call the same handlers
  - `src/admin/lib/preview.ts`
  - `src/styles/prose.css`: `.cover-wrap .cover` gets `aspect-ratio: 16 / 9; object-fit: cover`
  - `src/views/PostView.astro`: unchanged markup; the share image is still `getImage({ width: 1200, height: 630, format: 'jpg' })` from the cropped cover
- Create: `src/admin/ui/editor/CoverBlock.tsx`
- Test:
  - `tests/unit/admin/publish.test.ts`
  - `tests/unit/admin/frontmatter.test.ts`
  - `tests/unit/admin/draft.test.ts`
  - `tests/unit/admin/editor.test.tsx`
  - `tests/build/blog.test.ts`

**Interfaces:**
- Consumes: `CropArea`, `centredCrop`, `formatCrop`, `parseCrop`, `renderCrop`, `CropDialog` (Task 1).
- Produces:
  - `Draft` gains `coverOriginal: string | null` (image name, e.g. `cover-orig.webp`) and `coverCrop: CropArea | null`. `normalizeDraft` fills both with `null` for older drafts.
  - Frontmatter gains optional `coverOriginal: "./cover-orig.webp"` and `coverCrop: "x,y,w,h"`. In `ORDER` they go right after `coverAlt`. The schema accepts both as optional strings, and `coverCrop` must pass `parseCrop`.
  - Publishing adds `coverOriginal` to the used image names, so it is committed and never deleted as unused.

- [ ] **Step 1: Write the failing tests.**
  - `frontmatter.test.ts`: `serializePost` / `parsePost` round-trip `coverOriginal` and `coverCrop`. A file without them parses with neither key present.
  - `publish.test.ts`:
    - `'publishing a cropped cover commits both the cover and its original'`: the writes include `…/cover.webp` and `…/cover-orig.webp`, and the frontmatter has `coverCrop: "0,21.88,100,56.25"`.
    - `'re-publishing a live post keeps the original'`: neither file is in `deletes`.
  - `draft.test.ts`: `normalizeDraft` of an old draft gives `coverOriginal: null, coverCrop: null`.
  - `editor.test.tsx`:
    - `'the cover shows under the subtitle'`: in DOM order the subtitle input comes before `figure.ed-cover`, and that comes before `.ProseMirror`;
    - `'without a cover there is an "Kapak görseli ekle" drop zone'`.
  - `blog.test.ts` (fixture build): the post page cover `img.cover` exists. Assert on the CSS rule in the built stylesheet that `aspect-ratio: 16 / 9` applies to `.cover-wrap .cover`.
- [ ] **Step 2: Run** `npm test -- frontmatter publish draft editor` and `npm run test:build`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Upload flow:**
    1. On upload, store the original: `resizeImage(file, IMAGE_PRESETS.original)` → `images.add('cover-orig.webp', …)`.
    2. Open `CropDialog` with `aspect: 16/9` and `initial: centredCrop(...)`.
    3. On "Uygula", call `renderCrop(orig, area, { w: 1600, h: 900 }, 'image/webp', 0.82)` → `images.add('cover.webp', …)` → `onShared({ cover: 'cover.webp', coverOriginal: 'cover-orig.webp', coverCrop: area })`.
  - **Overlay buttons:** `CoverBlock` shows "Kapağı ayarla", "Değiştir" and "Kaldır" over the image on hover and focus; on touch they are always visible.
  - **Legacy cover** (`coverOriginal === null`): "Kapağı ayarla" uses the current `cover` as the original, then saves it as `cover-orig.webp` on first apply.
  - **Preview:** `preview.ts` adds `aspect-ratio` through the same `.cover` class it already uses.
- [ ] **Step 4: Run** `npm test` and `npm run test:build`. Expected: PASS.
- [ ] **Step 5: Check in the browser.** Upload a portrait photo, crop it, reload, and re-open "Kapağı ayarla": the previous frame comes back. Check that the Meta panel's share preview shows the cropped cover. Take a screenshot in both themes.
- [ ] **Step 6: Commit** with `feat(editor): cover under the subtitle at 16:9 with crop and zoom`.

### Task 3: Body images — shape, size and crop

**Files:**
- Modify:
  - `src/admin/ui/editor/nodes.tsx` (`Figure` attrs, `FigureView`)
  - `src/admin/lib/markdown.ts` (doc → md `figure` case; md → doc `html` block case)
  - `src/admin/lib/preview.ts` (allowed wrapper)
  - `src/admin/lib/publish.ts` (`figureNames` also collects `orig`)
  - `src/admin/ui/editor/EditorPage.tsx` (`figureNames` there too)
  - `src/admin/ui/editor/PreviewDialog.tsx` (`previewImageNames` ignores `orig`)
  - `src/admin/ui/editor/PostEditor.tsx` (insert flow opens the dialog)
  - `src/styles/prose.css`
- Create:
  - `src/lib/figure-frame.ts`, shared by the build, the preview and the panel
  - `src/admin/ui/editor/ImageEditDialog.tsx`
- Test:
  - `tests/unit/admin/markdown.test.ts`
  - `tests/unit/admin/preview.test.ts`
  - `tests/unit/admin/publish.test.ts`
  - `tests/unit/admin/nodes.test.ts`
  - `tests/unit/figure-frame.test.ts` (new)
  - `tests/build/blog.test.ts` (add a fixture post using a wrapper)

**Interfaces:**
- Produces, in `src/lib/figure-frame.ts`:
  - `type Shape = 'original' | 'rect' | 'rect-portrait' | 'square' | 'pill' | 'circle'`
  - `type Size = 'full' | 'md' | 'sm'`
  - `type FrameAttrs = { shape: Shape; size: Size; crop: string | null; orig: string | null }`, where `crop` holds the `formatCrop` string and `orig` is the image name without `./`
  - `ASPECT: Record<Shape, number | null>`: `{ original: null, rect: 3/2, 'rect-portrait': 2/3, square: 1, pill: 2, circle: 1 }`
  - `frameOpen(a: FrameAttrs): string` returns exactly
    `<div class="figure" data-shape="<shape>" data-size="<size>"[ data-crop="<x,y,w,h>"][ data-orig="./<name>"]>`.
  - `FRAME_OPEN: RegExp` matches only that exact tag:
    `/^<div class="figure" data-shape="(original|rect|rect-portrait|square|pill|circle)" data-size="(full|md|sm)"(?: data-crop="([0-9.,]+)")?(?: data-orig="\.\/([a-z0-9-]+\.(?:webp|jpg))")?>$/`
  - `parseFrameOpen(tag: string): FrameAttrs | null`. It returns null when `crop` fails `parseCrop`.
  - `FRAME_CLOSE = '</div>'`
- The `Figure` node gains attrs `shape` (default `'original'`), `size` (default `'full'`), `crop` (default `null`) and `orig` (default `null`). `renderHTML` / `parseHTML` carry them as `data-shape`, `data-size`, `data-crop` and `data-orig`.
- Markdown:
  - A figure with `shape: 'original'`, `size: 'full'` and no crop is written exactly as today, with no wrapper. Existing drafts stay unchanged.
  - Otherwise it is written as: `frameOpen(attrs)`, a blank line, the image line, a blank line, `</div>`.

- [ ] **Step 1: Write the failing tests.**
  - `figure-frame.test.ts`:
    - `parseFrameOpen(frameOpen(a))` round-trips for every shape and size;
    - `parseFrameOpen('<div class="figure" data-shape="star" data-size="full">')` → null;
    - extra attributes → null;
    - `data-orig="../x.webp"` → null.
  - `markdown.test.ts`:
    - `'a plain figure is written without a wrapper'`: the output is unchanged from today's fixture;
    - `'a shaped figure round-trips'`: doc → md → doc keeps `shape: 'circle', size: 'md', crop: '10,0,80,80', orig: 'foto-orig.webp'`, plus caption and alt;
    - `'an unknown wrapper stays text'`: `markdownToDoc` of `<div class="figure" data-shape="star" data-size="full">\n\n![a](./x.webp)\n\n</div>` keeps the tag as paragraph text and does not create a figure with a shape.
  - `preview.test.ts`:
    - the shaped figure renders `<div class="figure" data-shape="circle" data-size="md" …><figure><img …></figure></div>`;
    - the star wrapper is escaped as `&lt;div …`.
  - `publish.test.ts`: `'a cropped figure commits its original and keeps it on re-publish'`.
  - `blog.test.ts`: the fixture post with a circle figure renders `div.figure[data-shape="circle"] > figure > img`. The built HTML must not reference `-orig.webp` in any `img` `src` or `srcset`.
- [ ] **Step 2: Run** `npm test -- figure-frame markdown preview publish nodes` and `npm run test:build`. Expected: FAIL.
- [ ] **Step 3: Implement `figure-frame.ts`, the Markdown cases, the preview allow-rule, the publish and preview image-name changes, and the site CSS.**
  - In `blockTokens`, an `html` token that matches `FRAME_OPEN` is paired with the next `html` token whose trimmed text is `</div>`. A lone image paragraph between them becomes the figure. Anything else falls back to today's text handling.
  - **Site CSS** (`prose.css`):
    - `.prose .figure[data-size="md"] { max-width: 66% }`, `[data-size="sm"] { max-width: 33% }`, both with `margin-inline: auto`;
    - `[data-shape="circle"] img { border-radius: 50% }`, `[data-shape="pill"] img { border-radius: 9999px }`;
    - `rect`, `rect-portrait` and `square` get the site's small radius;
    - under 560px, `sm` grows to 50%.
  - The site needs no mdast change: the existing `figurePlugin` still turns the inner paragraph into `<figure>`. Confirm this with the build test.
- [ ] **Step 4: Implement `ImageEditDialog`.** It wraps `CropDialog` and passes these `children`:
  - shape chips: Özgün, Dikdörtgen, Kare, Hap, Yuvarlak;
  - a direction toggle, shown only for Dikdörtgen;
  - size chips: Tam genişlik, Orta, Küçük. Picking Yuvarlak or Kare sets Orta, unless the owner already picked a size.

  "Uygula" does the following:
  - renders the crop with `renderCrop` from the original. The output is `maxW: 1600` for Özgün; otherwise the long side is 1600 at the shape's ratio;
  - uploads it under the figure's current `src` name, replacing the file;
  - updates the node attrs.

  `FigureView`:
  - gets a "Düzenle" button;
  - shows the shape and size in the editor with the same CSS classes as the site, scoped under `.ed-figure`.

  Inserting a new image:
  - stores `<name>-orig.webp` first, then the resized body image as today;
  - opens `ImageEditDialog` with shape Özgün.
- [ ] **Step 5: Run** `npm test` and `npm run test:build`. Expected: PASS.
- [ ] **Step 6: Check in the browser.** Insert an image and try every shape and size. Reload and re-open "Düzenle": the previous crop comes back. Compare the preview with the editor. Check 375px. Take screenshots.
- [ ] **Step 7: Commit** with `feat(editor): body image shapes, sizes and re-editable crop`.

### Task 4: Owner-placed drop cap

**Files:**
- Create: `src/admin/ui/editor/dropcap.ts` (Tiptap extension that adds a `dropCap` attr to `paragraph`, plus a command)
- Modify:
  - `src/admin/ui/editor/PostEditor.tsx` (register the extension)
  - `src/admin/ui/editor/Toolbar.tsx` (button in the "Daha fazla" menu, Lucide `CaseUpper` or similar, labelled "Büyük baş harf")
  - `src/admin/lib/markdown.ts` (paragraph case, both directions)
  - `src/admin/lib/preview.ts` (allow `<span class="dropcap">` and `</span>`)
  - `src/styles/prose.css`
  - `src/admin/ui/admin.css`
- Test:
  - `tests/unit/admin/markdown.test.ts`
  - `tests/unit/admin/dropcap.test.ts` (new)
  - `tests/unit/admin/preview.test.ts`
  - `tests/build/blog.test.ts`

**Interfaces:**
- Produces:
  - Paragraph attr `dropCap: boolean` (default false). It renders as `<p class="dropcap">` in the editor.
  - Markdown: a paragraph with `dropCap` is written as `<span class="dropcap"></span>` followed immediately by the paragraph's inline Markdown. `markdownToDoc` reads a paragraph whose first two inline tokens are `<span class="dropcap">` and `</span>` as `dropCap: true` and drops both tokens.
  - Command `toggleDropCap()`: `(state) => boolean`.
    - It returns false and does nothing unless the selection is inside the paragraph's first word: the selection starts before the first whitespace of the paragraph's text.
    - Otherwise it sets `dropCap` on that paragraph and clears it on every other paragraph in the doc.
    - If that paragraph already had it, it clears it.
  - When the command returns false, the Toolbar shows the hint "Büyük baş harf yalnızca bir paragrafın ilk kelimesine uygulanabilir." via the editor's existing `onError` channel.

- [ ] **Step 1: Write the failing tests.**
  - `dropcap.test.ts`, using a headless Tiptap `Editor` with the extension:
    - cursor in the first word of paragraph 2 → `toggleDropCap()` is true and only paragraph 2 has `dropCap`;
    - cursor in the third word → false, no change;
    - applying it to paragraph 3 clears paragraph 2;
    - toggling it on the same paragraph clears it.
  - `markdown.test.ts`:
    - `'drop cap round-trips'`: `docToMarkdown` of a dropCap paragraph "“Bu gün” dedi." gives `<span class="dropcap"></span>“Bu gün” dedi.`, and `markdownToDoc` gives back `dropCap: true` with the same text;
    - `'drop cap before a citation or bold text round-trips'`.
  - `preview.test.ts`: the output contains `<p><span class="dropcap"></span>…`.
  - `blog.test.ts`: the fixture post with a drop cap renders `p > span.dropcap:first-child`. The built CSS contains a rule selecting `.prose p:has(> span.dropcap:first-child)::first-letter`.
- [ ] **Step 2: Run** `npm test -- dropcap markdown preview` and `npm run test:build`. Expected: FAIL.
- [ ] **Step 3: Implement the extension, the Markdown cases, the preview allow-rule and the CSS.**
  - Site and preview: `.prose p:has(> span.dropcap:first-child)::first-letter`.
  - Editor: `.ed-content p.dropcap::first-letter`.
  - Both use: `float: left; font-family: Fraunces; font-size: ~3.2em; line-height: .85; margin: .05em .08em 0 0; color: var(--forest)`. `::first-letter` already includes leading punctuation, which covers the quote-mark rule. The empty span adds no text, so screen readers read the word whole.
- [ ] **Step 4: Run** `npm test` and `npm run test:build`. Expected: PASS.
- [ ] **Step 5: Check in the browser.** Compare the editor, the preview and a built post page. Check a paragraph starting with “ and check dark mode in the editor. Take a screenshot.
- [ ] **Step 6: Commit** with `feat(editor): owner-placed drop cap`.

---

## Self-review notes

- Spec coverage of this plan:
  - §5.6 → Task 2
  - §5.7 → Tasks 1 and 3
  - §5.8 → Task 4
  - §4 "kırpılan görselin geri dönülemez olması" → originals in Tasks 2 and 3
  - §4 "var olan yazıların bozulması" → no-wrapper output for plain figures (Task 3) and null crop for legacy covers (Task 2)
- Decisions the spec left to the builder, made here:
  - wrapper-div syntax for figures;
  - empty-span syntax for the drop cap;
  - originals as `-orig` files in Drive, then in the post folder;
  - `react-easy-crop` as the crop library.
