# Phase 2 — Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Turkish, phone-friendly admin panel at `klinikterapist.com/admin/` that lets the owner write bilingual posts, check SEO and edit every public site setting without code. Changes are committed to GitHub through a Google Apps Script backend that keeps the GitHub token server-side.

**Architecture:** The panel is a client-only React island on one Astro page (`src/pages/admin/index.astro`), shipped with the static site. It signs in with Google Identity Services, trades the Google ID token for a short-lived session from an Apps Script web app, and sends every read and write to that web app. Apps Script verifies the session, stores drafts and draft images in a private Drive folder, and writes to the public repo with one atomic Git Data API commit per change. The commit triggers the existing GitHub Actions deploy. All logic that decides *what* to write (Markdown, frontmatter, redirects, validation) is pure TypeScript in the panel and unit-tested. Apps Script stays a thin, tested transport layer.

**Tech Stack:** Astro 7 (existing), `@astrojs/react` + React 19, Tiptap 3 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extensions`, menus from `@tiptap/react/menus`), `yaml`, zod via `astro/zod` (existing schemas), Vitest 5 + jsdom + `@testing-library/react`, Google Identity Services (`https://accounts.google.com/gsi/client`), Google Apps Script V8 written in TypeScript and bundled with esbuild, `@google/clasp` for deployment. Install the current stable versions with `npm install`. Do not pin versions by hand.

**Spec:** `docs/superpowers/specs/2026-10-17-kisisel-site-design.md` (Turkish). This plan implements §6 (panel write path, sign-in, images), §8.1, §8.2, §8.3 (all screens except the booking ones, see below), §8.4 and the redirect rule in §9. It also implements every deferred item in `docs/superpowers/notes/faz-2-notlari.md`.

## Owner decisions taken while planning (17 Oct 2026)

- Sign-in account: **merhaba@klinikterapist.com**, and only that account.
- **"Yayından kaldır"** exists. The post leaves the site and goes back to drafts, and its old addresses redirect to the blog index.
- **No scheduled publishing.** "Yayınla" publishes now. The date field is only the date shown on the post.
- **Categories are editable** in the panel (add, rename, change slug). A category that any post or draft uses cannot be deleted.

## Global Constraints

- Panel UI text is Turkish only (§8). It uses the site's tokens from `src/styles/tokens.css` (cream, forest green, sage, Fraunces/DM Sans) and must be usable at 360 px width (§8).
- The browser never receives a secret. The GitHub token lives only in Apps Script Script Properties (§6, §8.3 last line).
- Apps Script accepts a request only with a valid session. A session is issued only for a Google ID token whose `aud` is our OAuth client ID, `iss` is `accounts.google.com` or `https://accounts.google.com`, `email_verified` is true, `exp` is in the future and `email` equals `OWNER_EMAIL` (`merhaba@klinikterapist.com`, compared lowercase) (§6).
- Commits may only touch `src/content/posts/**`, `src/data/**` and `public/images/**`. Apps Script rejects any other path (§8.4: the repo holds only public data).
- Drafts, autosave and draft images live in the owner's Drive folder only. Autosave never commits to GitHub (§8.4).
- A post can be published only when both TR and EN are complete (§8.1). SEO red lights never block publishing (§8.2).
- Every file the panel writes must parse with the same zod schemas the build uses (`src/lib/schemas.ts` after Task 1). The panel validates before sending. A write that would fail the build is never committed.
- Data contracts from `faz-2-notlari.md`: `resources.json` is `{ myNote, items }`. `about.json` `whoAmI`/`whyThisWork` are Markdown. Timeline `period` is `string | { tr, en }`. Redirect `from`/`to` are lowercase site paths with a trailing slash, `from` ≠ `/`, with no duplicates and no chains, and no `from` may equal a live page. Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$` and are unique per language.
- Reserved slugs: TR post slug ≠ `kategori`, EN post slug ≠ `category`.
- `/admin/` is `noindex`, disallowed in `robots.txt` and absent from the sitemap. It loads no JavaScript on any other page.
- Booking screens are **Phase 3** (spec §12 puts "panelin randevu ayarları ile randevular görünümü" in Phase 3): Randevu settings, Mail şablonları, Bildirimler (WhatsApp) and Randevular görünümü are not built here. The panel's menu shows no placeholder for them.
- Owner-facing errors are short Turkish sentences that say what to do next. They never show a stack trace or a raw API message.
- Never `git push` without the owner's explicit go-ahead in chat. Local commits per task are fine.

## Review Focus

1. **The session expires, or the phone goes offline, while the owner is writing.** No text is lost. The editor keeps working, the change is kept in `localStorage`, autosave retries, and after signing in again the same draft continues. Owned by Task 11.
2. **The same draft is open on the phone and the laptop.** A save from the older copy never silently overwrites the newer one. The owner gets a Turkish choice dialog. Owned by Tasks 5 and 11.
3. **Turkish focus keywords with suffixes and dotted/dotless I** ("kaygı" must match "Kaygının", and "İlişki" must match "ilişkiler"). The SEO checks count these as hits. Owned by Task 8.
4. **An iPhone photo**: large, EXIF-rotated, sometimes HEIC. It is uploaded upright and resized. If the browser cannot decode it, a Turkish message asks for JPEG/PNG and nothing is half-uploaded. Owned by Task 9.
5. **Publishing when GitHub refuses or the build fails** (expired token, a conflict, a red CI run). The owner sees a clear Turkish status, the live site keeps its old version, and the draft is deleted only after the commit succeeded. Owned by Tasks 4, 10 and 11.

---

## File Structure

```
web sitem/
├─ astro.config.mjs                 # + react(), rehypeFigure, sitemap filter /admin/, hreflang tr/en
├─ src/
│  ├─ lib/schemas.ts                # NEW: browser-safe zod schemas + parse* + types + slug rules (moved from settings.ts)
│  ├─ lib/settings.ts               # keeps fs readers; re-exports schemas.ts
│  ├─ lib/rehype-figure.ts          # NEW: <p><img title></p> → <figure><img><figcaption>
│  ├─ views/PostView.astro          # + callout / youtube styles, youtube click-to-load script
│  ├─ pages/admin/index.astro       # NEW: noindex shell, <AdminApp client:only="react" />
│  ├─ pages/[...redirect].astro     # bilingual, visible fallback text
│  └─ admin/
│     ├─ config.ts                  # public values: API URL, Google client ID, owner email
│     ├─ api/types.ts               # Api interface + DTOs (the contract with Apps Script)
│     ├─ api/http.ts                # createHttpApi()
│     ├─ api/mock.ts                # createMockApi() — dev only (?mock)
│     ├─ lib/markdown.ts            # Tiptap JSON ⇄ Markdown
│     ├─ lib/frontmatter.ts         # post file ⇄ { frontmatter, body }
│     ├─ lib/draft.ts               # Draft types, completeness, slug checks
│     ├─ lib/redirects.ts           # applyPathChanges()
│     ├─ lib/publish.ts             # publish / unpublish / category changesets
│     ├─ lib/seo-check.ts           # runSeoChecks()
│     ├─ lib/text-width.ts          # SERP pixel width
│     ├─ lib/image.ts               # fitWithin(), coverCrop(), resizeImage()
│     ├─ lib/youtube.ts             # parseYoutubeId()
│     ├─ lib/hash.ts                # shortHash() for cache-busting file names
│     └─ ui/                        # React: App, Login, Shell, PostsList, Editor/*, SeoPanel, settings/*, kit/*
├─ apps-script/
│  ├─ appsscript.json  .clasp.json(.example)
│  ├─ build.mjs                     # esbuild → dist/Code.js (+ global doPost/doGet shims)
│  └─ src/ main.ts auth.ts github.ts drive.ts respond.ts gas.ts
├─ tests/unit/
│  ├─ admin/*.test.ts(x)            # panel logic + components (jsdom via docblock)
│  └─ apps-script/*.test.ts         # backend with fake GAS services
└─ docs/kurulum/yonetim-paneli.md   # Turkish step-by-step setup guide for the owner
```

`npm test` already runs `tests/unit`, so the new tests run in CI without a workflow change. Component tests start with `// @vitest-environment jsdom`.

## The API contract (Task 3 defines it in `src/admin/api/types.ts`; everything else uses it)

One endpoint: `POST <APPS_SCRIPT_URL>` with `Content-Type: text/plain;charset=utf-8` (a CORS "simple request", so no preflight) and body `{ action, session?, ...params }`. The reply is always HTTP 200 with JSON `{ ok: true, data } | { ok: false, error: { code: ErrorCode, message: string } }`. `ErrorCode = 'unauthorized' | 'forbidden_path' | 'conflict' | 'not_found' | 'github' | 'github_token' | 'bad_request' | 'internal'`. `message` is Turkish and safe to show.

| action | params | data |
|---|---|---|
| `auth.login` | `idToken` | `{ session: string, email: string, expiresAt: number }` |
| `auth.logout` | — | `{}` (invalidates all sessions) |
| `site.tree` | — | `{ headSha: string, files: { path, sha, size }[] }` for `src/content/posts/**` and `src/data/**` |
| `site.read` | `paths: string[]` | `{ files: { path, sha, content: string, encoding: 'utf8' \| 'base64' }[] }` (images base64) |
| `site.commit` | `message`, `writes: { path, content, encoding, expectSha: string \| null }[]`, `deletes: { path, expectSha }[]` | `{ commitSha }`. `expectSha: null` means "must not exist yet". A mismatch is `conflict`. |
| `site.status` | — | `{ state: 'queued' \| 'in_progress' \| 'success' \| 'failure' \| 'unknown', commitSha, url, updatedAt, tokenExpiresAt: string \| null }` |
| `drafts.list` | — | `{ drafts: DraftSummary[] }` |
| `drafts.get` | `key` | `{ draft: Draft }` or `not_found` |
| `drafts.save` | `draft` (with `rev` = the rev it was based on) | `{ rev, updatedAt }`, or `conflict` with `data.current: Draft` |
| `drafts.delete` | `key` | `{}` |
| `images.put` | `key, name, base64` | `{}` |
| `images.get` | `key, name` | `{ base64 }` |

---

### Task 1: Browser-safe schemas and the deferred site hardening

**Files:**
- Create: `src/lib/schemas.ts`
- Modify: `src/lib/settings.ts`, `src/content.config.ts`, `src/lib/posts.ts`, `src/lib/markdown.ts:12`, `src/components/AuthorBox.astro`, `src/pages/[...redirect].astro`, `src/views/BlogListView.astro`, `astro.config.mjs`, `src/pages/robots.txt.ts`, `src/data/profile.json`, `tests/fixtures/data/profile.json`
- Test: `tests/unit/settings.test.ts`, `tests/unit/markdown.test.ts`, `tests/unit/posts.test.ts`, `tests/build/seo-files.test.ts`, `tests/build/blog.test.ts`

**Interfaces:**
- Produces (`src/lib/schemas.ts`, no `node:` imports): every schema, `parse*` function and type that `settings.ts` exports today, plus `SLUG_RE`, `SITE_PATH_RE`, `RESERVED_SLUGS: Record<Lang, readonly string[]> = { tr: ['kategori'], en: ['category'] }`, `slugError(slug: string, lang: Lang): string | null` (Turkish message, or null when valid), `postFrontmatterSchema(categoryIds: string[])` (the content schema with `cover: z.string().optional()`), `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`. `settings.ts` re-exports all of it, so existing imports keep working.
- Produces: `profile.shortIntro?: Localized`, a one-line author-box intro.
- Produces: `validateReservedSlugs(entries)` in `posts.ts`, called in `loadAll()`.

- [ ] **Step 1: Write the failing tests**
  - `settings.test.ts`: `parseContact({...valid, email: 'not-an-email'})` throws with `email` in the message, and `'merhaba@klinikterapist.com'` passes. `slugError('kategori','tr')` and `slugError('category','en')` return a message. `slugError('kategori','en')` returns null. `slugError('', 'tr')` returns a message. `parseProfile` accepts `shortIntro` and accepts its absence.
  - `markdown.test.ts`: `renderMarkdown('[x](/\\evil.com)')` contains no `href`. `[x](/hakkimda/)` still links.
  - `posts.test.ts`: `validateReservedSlugs([{ id: 'a/tr', data: { slug: 'kategori' } }])` throws naming folder `a`. The same slug under `a/en` does not throw.
  - `seo-files.test.ts`: sitemap `xhtml:link hreflang` values are `tr` and `en` (not `tr-TR`/`en-US`). `robots.txt` contains `Disallow: /admin/`.
  - `blog.test.ts`: a category page with no posts in the fixture has `<meta name="robots" content="noindex">`, and a category with posts has none. A redirect stub whose `to` starts with `/en/` has `lang="en"`, and every stub has visible text and a link to `to` in both languages. The post author box shows `shortIntro` when the fixture profile sets it.
- [ ] **Step 2: Run** `npm test` and `npm run test:build`. Expected: the new assertions FAIL.
- [ ] **Step 3: Implement.** Move the schemas into `schemas.ts`. Add `.regex(EMAIL_RE, 'geçerli bir e-posta adresi yazın (ör. ad@alanadi.com)')` to `contact.email`. Change `SAFE_HREF` to `/^(https:\/\/|mailto:|\/(?![\/\\]))/i`. `content.config.ts` builds its schema from `postFrontmatterSchema` and overrides `cover` with `image().optional()`. AuthorBox shows `profile.shortIntro?.[lang] ?? profile.intro[lang]` and drops the sentence regex. Add a `shortIntro` to both profile files. BlogListView passes `noindex={posts.length === 0}` for category pages only. The redirect stub uses `lang` = `en` when `to` starts with `/en/`, otherwise `tr`, and its body reads "Bu sayfa taşındı: <a>" / "This page has moved: <a>" in that language. Sitemap i18n locales become `{ tr: 'tr', en: 'en' }`, and the sitemap filter also drops URLs under `/admin/`. `robots.txt` adds `Disallow: /admin/`.
- [ ] **Step 4: Run** `npm test && npm run test:build && npm run check:launch`. Expected: all PASS.
- [ ] **Step 5: Commit** `fix: Phase 2 hardening — reserved slugs, e-mail, safe hrefs, bilingual redirects, noindex empty categories`

### Task 2: Rich post body on the site (figure captions, callout, YouTube)

**Files:**
- Create: `src/lib/rehype-figure.ts`, `tests/fixtures/content/ornek-zengin/{tr,en}.md` (+ a small `gorsel.webp`)
- Modify: `astro.config.mjs` (`markdown.rehypePlugins`), `src/views/PostView.astro`
- Test: `tests/unit/rehype-figure.test.ts`, `tests/build/blog.test.ts`

**Interfaces — the Markdown the panel writes (Task 6 must produce exactly this):**
- Image with caption, alone in a paragraph: `![alt](./name.webp "Caption")`. Without a caption: `![alt](./name.webp)`.
- Callout:
  ```
  <aside class="callout">

  Paragraph markdown…

  </aside>
  ```
- YouTube (11-char id): `<div class="youtube" data-id="ID"><a href="https://www.youtube.com/watch?v=ID">Videoyu YouTube'da izleyin</a></div>`. The EN text is `Watch the video on YouTube`.
- Produces: `rehypeFigure()`, a rehype plugin with no dependencies (a manual tree walk). A `p` whose only element child is an `img` with a non-empty `title` becomes `figure > img + figcaption(title)`, and `title` is removed from the img.

- [ ] **Step 1: Write the failing tests.** In the unit test, a hast tree `p > img[title=Cap]` becomes `figure > img, figcaption "Cap"`. A `p` with text + img is left as is. In the build test, `/blog/ornek-zengin/` contains `figure figcaption` with the caption text, `aside.callout` with its paragraph rendered as `<p>`, and `.youtube a[href^="https://www.youtube.com/watch?v="]`. The page HTML contains no `<iframe` (privacy: YouTube loads only after a click).
- [ ] **Step 2: Run** `npm test && npm run test:build`. Expected: FAIL.
- [ ] **Step 3: Implement** the plugin. In PostView, add CSS for `figure`/`figcaption`, `.callout` (sage surface, rounded) and `.youtube` (16:9 box, play icon, link visible without JS). Add one inline `<script>` that, on click of `.youtube a`, prevents navigation and replaces the box content with `<iframe src="https://www.youtube-nocookie.com/embed/ID?autoplay=1" title=… allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen>`. The script runs only on post pages.
- [ ] **Step 4: Run** the tests. Expected: PASS. Also run the existing a11y build tests, since the fixture post must pass them too.
- [ ] **Step 5: Commit** `feat(blog): figure captions, callout boxes and click-to-load YouTube`

### Task 3: Apps Script backend — router, session auth and the API types

**Files:**
- Create: `apps-script/appsscript.json`, `apps-script/build.mjs`, `apps-script/.clasp.json.example`, `apps-script/src/{main,auth,respond,gas}.ts`, `src/admin/api/types.ts`
- Modify: `package.json` (scripts `gas:build`, `gas:push`, `gas:deploy`; devDeps `esbuild`, `@google/clasp`), `.gitignore` (`apps-script/dist/`, `apps-script/.clasp.json`, `.clasprc.json`)
- Test: `tests/unit/apps-script/auth.test.ts`, `tests/unit/apps-script/main.test.ts`

**Interfaces:**
- `gas.ts`: `interface Gas { fetch(url, opts): { code: number; text: string; headers: Record<string,string> }; props: { get(k): string | null; set(k, v): void }; cache: { get(k): string | null; put(k, v, ttlSec): void }; withLock<T>(fn: () => T): T; drive: DriveLike; now(): number; hmac(key: string, data: string): string; uuid(): string }` and `realGas(): Gas`, the only file that touches `UrlFetchApp`/`PropertiesService`/`CacheService`/`LockService`/`DriveApp`/`Utilities`.
- `auth.ts`: `verifyIdToken(gas, idToken): { email: string }` (throws `ApiError('unauthorized')`). It calls `https://oauth2.googleapis.com/tokeninfo?id_token=…` and applies the Global Constraints checks with `GOOGLE_CLIENT_ID` and `OWNER_EMAIL` from props. Also `issueSession(gas, email): { session, expiresAt }` and `checkSession(gas, session): void`. The session is `base64url(JSON{email,exp,ver}) + '.' + hmacSha256(SESSION_SECRET)`, with a TTL of **12 h**. `ver` must equal prop `SESSION_VERSION`. `SESSION_SECRET` is generated with `uuid()+uuid()` on first use. `logout` increments `SESSION_VERSION`.
- `main.ts`: `handle(gas, body: string): ApiResponse` (pure, tested) and the global `doPost(e)`, which returns `ContentService.createTextOutput(JSON.stringify(handle(realGas(), e.postData.contents))).setMimeType(JSON)`. Every action except `auth.login` calls `checkSession` first. Unknown action → `bad_request`. Thrown non-`ApiError` → `internal` with message "Beklenmeyen bir hata oldu. Biraz sonra tekrar deneyin." The error is logged with `console.error` without the request body (no content logging).
- `types.ts`: `Api` (one method per action in the contract table, returning `Promise<data>` and throwing `ApiFailure { code, message }`), `Draft`, `DraftSummary`, `LangFields`, `RepoFile`, `CommitWrite`, `CommitDelete`, `SiteStatus`.

- [ ] **Step 1: Write the failing tests** with a `fakeGas()` (in-memory props/cache, scripted `fetch`). Cases: a valid token for `MERHABA@klinikterapist.com` (case-insensitive) → session. A wrong `aud`, an expired `exp`, `email_verified: "false"`, another e-mail, or tokeninfo HTTP 400 → `unauthorized`. A session tampered in one char, an expired session, or a session after `auth.logout` → `unauthorized`. An action without a session → `unauthorized`. A malformed JSON body → `bad_request`. An internal throw → `internal` with the Turkish message, and `console.error` is not called with the body.
- [ ] **Step 2: Run** `npm test -- apps-script`. Expected: FAIL.
- [ ] **Step 3: Implement** the modules. `build.mjs` bundles `apps-script/src/main.ts` with esbuild (`format: 'iife'`, `globalName: 'App'`, `target: 'es2020'`) and appends `function doPost(e){return App.doPost(e)}` and `function doGet(){return App.doGet()}`. `doGet` returns a tiny "çalışıyor" JSON for health checks. `appsscript.json`: `timeZone: Europe/Istanbul`, `runtimeVersion: V8`, `webapp: { executeAs: USER_DEPLOYING, access: ANYONE_ANONYMOUS }`, scopes `script.external_request` and `drive`.
- [ ] **Step 4: Run** `npm test && npm run gas:build`. Expected: PASS, and `apps-script/dist/Code.js` exists.
- [ ] **Step 5: Commit** `feat(apps-script): owner-only session auth and request router`

### Task 4: Apps Script — GitHub reads, atomic commits, deploy status

**Files:**
- Create: `apps-script/src/github.ts`
- Modify: `apps-script/src/main.ts`
- Test: `tests/unit/apps-script/github.test.ts`

**Interfaces:**
- Consumes: `Gas`, `ApiError`.
- Produces: `ALLOWED_PATH = /^(src\/content\/posts\/[a-z0-9-]+\/[a-z0-9-]+\.(md|webp)|src\/data\/[a-z0-9-]+\.json|src\/data\/legal\/[a-z]+\.(tr|en)\.md|public\/images\/[a-z0-9-]+(\/[a-z0-9-]+)*\.(webp|jpg))$/`. `tree(gas)`, `read(gas, paths)`, `commit(gas, { message, writes, deletes })`, `status(gas)`. Props: `GITHUB_TOKEN`, `GITHUB_REPO` (`klinikterapist/klinikterapist-site`), `GITHUB_BRANCH` (`main`).
- Commit algorithm, inside `withLock`: get the ref, then the base commit and tree (recursive). Check each `expectSha` against the base tree (null = absent) → `conflict` naming the file in Turkish. Create blobs (utf8 or base64), then a tree with `base_tree` (deletes as `sha: null` entries), then the commit, then `PATCH refs/heads/main` (`force: false`). On a 422 not-fast-forward, retry the whole sequence once. The commit author is the GitHub token owner. The message gets the suffix `\n\n(Yönetim paneli)`.
- Error mapping: GitHub 401 → `github_token` "GitHub bağlantı anahtarının süresi dolmuş ya da geçersiz. Kurulum rehberindeki 'GitHub anahtarı' adımını yenileyin." Other non-2xx → `github` "GitHub şu an yanıt vermiyor. Değişikliğiniz kaydedilmedi; birkaç dakika sonra tekrar deneyin."
- `status`: latest run of workflow `deploy.yml` on `main` → map `status`/`conclusion` to `SiteStatus.state`. `tokenExpiresAt` comes from the `github-authentication-token-expiration` response header when present.

- [ ] **Step 1: Write the failing tests** with a scripted fake GitHub. A path outside the allow-list (`.github/workflows/deploy.yml`, `src/pages/x.astro`, `../x`) → `forbidden_path` and zero fetches. Two writes + one delete produce exactly one commit, with blobs of the right encoding. `expectSha` mismatch → `conflict` and no ref update. `expectSha: null` for an existing file → `conflict`. A 422 on the ref update retries once, then succeeds. GitHub 401 → `github_token`. The status mapping covers in_progress, success, failure and no runs → unknown.
- [ ] **Step 2: Run** `npm test -- github`. Expected: FAIL.
- [ ] **Step 3: Implement** `github.ts` and wire `site.*` actions in `main.ts`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(apps-script): allow-listed atomic GitHub commits and deploy status`

### Task 5: Apps Script — drafts and draft images in Drive

**Files:**
- Create: `apps-script/src/drive.ts`
- Modify: `apps-script/src/main.ts`, `apps-script/src/gas.ts` (`DriveLike`)
- Test: `tests/unit/apps-script/drive.test.ts`

**Interfaces:**
- `DriveLike`: `rootFolder(): FolderLike` (creates `Klinikterapist Panel` with subfolders `taslaklar` and `gorseller` on first use, and remembers the id in prop `DRIVE_FOLDER_ID`), plus the `FolderLike`/`FileLike` methods used below. Only this keeps the tests independent of `DriveApp`.
- Draft file: `taslaklar/<key>.json`, with the `Draft` object as JSON. Images: `gorseller/<key>/<name>`. `key` must match `^[a-z0-9-]{1,80}$` and `name` `^[a-z0-9-]+\.(webp|jpg)$`, else `bad_request`.
- `saveDraft(gas, draft)`, inside `withLock`: if a stored draft exists and `stored.rev !== draft.rev` → `conflict` with `data.current = stored`. Otherwise write with `rev = draft.rev + 1` and `updatedAt = new Date(now).toISOString()`. A new key (no stored file) requires `draft.rev === 0`.
- `listDrafts` returns `DraftSummary { key, rev, updatedAt, published, category, title: { tr, en } }`, newest first. `deleteDraft` trashes the JSON and the image folder (Drive trash, not a permanent delete).

- [ ] **Step 1: Write the failing tests** with an in-memory `DriveLike`. Save → get round trip. Saving with a stale rev → `conflict`, the current draft is returned and nothing is overwritten. Two saves with the same base rev → the second conflicts. Bad key `../x` → `bad_request`. `images.put` then `images.get` returns the same base64. Delete removes the draft from the list.
- [ ] **Step 2: Run** `npm test -- drive`. Expected: FAIL.
- [ ] **Step 3: Implement** `drive.ts` and wire `drafts.*` and `images.*`.
- [ ] **Step 4: Run** `npm test && npm run gas:build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(apps-script): Drive drafts with revision conflicts and draft images`

### Task 6: Post model — Markdown ⇄ editor document, frontmatter, completeness

**Files:**
- Create: `src/admin/lib/markdown.ts`, `src/admin/lib/frontmatter.ts`, `src/admin/lib/draft.ts`, `src/admin/lib/youtube.ts`
- Test: `tests/unit/admin/markdown.test.ts`, `tests/unit/admin/frontmatter.test.ts`, `tests/unit/admin/draft.test.ts`, `tests/unit/admin/youtube.test.ts`

**Interfaces:**
- Editor document = Tiptap `JSONContent` limited to: `paragraph`, `heading{level:2|3}`, `blockquote`, `bulletList`/`orderedList`/`listItem`, `horizontalRule`, `figure{src,alt,caption}` (atom), `youtube{id}` (atom), `callout` (content `paragraph+`), `hardBreak`, `text`. Marks: `bold`, `italic`, `link{href}`.
- `docToMarkdown(doc: JSONContent, lang: Lang): string` emits exactly the Task 2 syntax. It escapes Markdown-significant characters in text (`\ * _ [ ] < > \``, and `#`, `-`, `+`, `1.` at line start), ends with one newline, and uses `**`/`_` for marks and `-` for bullets.
- `markdownToDoc(md: string): JSONContent` uses `marked`'s lexer. It recognises the Task 2 callout/YouTube HTML exactly. Any other HTML becomes a paragraph of its literal text.
- `serializePost(fm: PostFrontmatter, body: string): string`, where frontmatter values are JSON-encoded (valid YAML), in this key order: `title, seoTitle?, description, slug, focusKeyword, category, cover?, coverAlt?, publishedAt (YYYY-MM-DD), updatedAt?`. `parsePost(text): { fm: PostFrontmatter, body: string }` uses the `yaml` package.
- `draft.ts`: `type LangFields = { title, seoTitle, slug, slugTouched: boolean, description, focusKeyword, coverAlt, doc: JSONContent }`, `type Draft = { key, rev, updatedAt, published: boolean, category, cover: string | null /* image name */, publishedAt: string, tr: LangFields, en: LangFields }`. `newDraft(now: Date): Draft` uses key `taslak-<base36 time><4 random>`. `missingFields(f: LangFields, lang): string[]` returns Turkish labels for an empty title, slug, description or focus keyword, a body without text, an invalid slug (`slugError`) or a missing `coverAlt` when there is a cover. `canPublish(d: Draft): { ok: boolean, missing: { tr: string[], en: string[], shared: string[] } }`, where shared = no category. `autoSlug(f, lang)` returns `slugify(title)` unless `slugTouched`. `parseYoutubeId(input): string | null` accepts `youtu.be/ID`, `watch?v=ID`, `shorts/ID`, `embed/ID` and a bare 11-char id.

- [ ] **Step 1: Write the failing tests.** Round trips `markdownToDoc(docToMarkdown(doc)) ≅ doc` for a document using every node and mark (one fixture). The Task 2 fixture Markdown parses into figure/callout/youtube nodes. Text `*yıldız* [köşeli] #etiket` survives a round trip literally. `serializePost` → `parsePost` round trip keeps Turkish characters and a title containing `"` and `:`. `canPublish` is false with an empty EN body and lists `İngilizce: Yazı metni boş`. A TR slug `kategori` is listed as invalid. A Turkish-only title (`"Ğ"` → slug `g`) is fine, and an emoji-only title gives an empty slug, listed as missing. `parseYoutubeId('https://youtu.be/dQw4w9WgXcQ?t=3') === 'dQw4w9WgXcQ'`, and `parseYoutubeId('https://evil.com/watch?v=x')` is null.
- [ ] **Step 2: Run** `npm test -- admin`. Expected: FAIL.
- [ ] **Step 3: Implement** the four modules (add `yaml` to dependencies).
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): post model — markdown conversion, frontmatter, completeness`

### Task 7: Publishing changesets and automatic redirects

**Files:**
- Create: `src/admin/lib/redirects.ts`, `src/admin/lib/publish.ts`, `src/admin/lib/hash.ts`
- Test: `tests/unit/admin/redirects.test.ts`, `tests/unit/admin/publish.test.ts`

**Interfaces:**
- `applyPathChanges(redirects: Redirect[], changes: { from: string; to: string }[], livePaths: Set<string>): { redirects: Redirect[]; notices: string[] }`. For each change it adds `from→to`, retargets every redirect whose `to === from` to `to`, and drops redirects whose `from` equals a new live path (with a Turkish notice when the dropped one pointed somewhere else). The result has no duplicates or chains and is passed through `parseRedirects` (it throws if still invalid).
- `buildPublishChangeset(input: { draft: Draft; live: LivePost | null; allLive: LivePost[]; redirects: { list: Redirect[]; sha: string }; categories: Category[]; images: Map<string, { base64: string; inRepo: boolean }>; today: string }): { key: string; writes: CommitWrite[]; deletes: CommitDelete[]; notices: string[] }`. `LivePost = { key, tr: { fm, sha }, en: { fm, sha }, files: { path, sha }[] }`.
  - The key is `live.key`, or for a new post the TR slug (with `-2`, `-3`… if the folder exists).
  - Writes `src/content/posts/<key>/{tr,en}.md` (with `expectSha` from `live`, or null), plus every referenced image that is not yet in the repo (`cover.webp` for the cover, other names as in the body).
  - Deletes repo images in that folder that are no longer referenced.
  - `updatedAt = today` when `live` exists. `publishedAt` comes from the draft.
  - Throws a Turkish `PublishError` when a slug duplicates another live post in that language, when `canPublish` fails, or when the frontmatter fails `postFrontmatterSchema(categoryIds)`.
  - When a live slug changed, adds a change `postPath(old) → postPath(new)` per language and writes `src/data/redirects.json` (pretty JSON, 2 spaces, trailing newline, `expectSha` = redirects sha) only if it changed.
- `buildUnpublishChangeset(live: LivePost, redirects)`: deletes every file of the post and adds changes `postPath(tr) → /blog/` and `postPath(en) → /en/blog/`.
- `buildCategoryChangeset(before: Category[], after: Category[], usedIds: Set<string>, redirects)`: rejects deleting a used id ("Bu kategoride yazı ya da taslak var; önce onları başka kategoriye taşıyın."). A slug change adds a `categoryPath` change. Writes `categories.json` (+ `redirects.json`).
- `shortHash(bytes: Uint8Array): Promise<string>`: the first 8 hex chars of SHA-256 (Web Crypto). It is used for public image names (`public/images/profil-<hash>.webp`) so GitHub Pages caching never shows an old photo.

- [ ] **Step 1: Write the failing tests.** Rename a→b: adds `/blog/a/→/blog/b/`. Then rename b→c: one redirect `a→c` plus `b→c`, no chain. Rename back c→a: `a→c` is dropped (a is live again), `b→a` and `c→a` exist, and the result passes `parseRedirects`. Unpublish then republish with the same slug: the blog-index redirect for that slug is removed. A new post whose TR slug collides with a live post → `PublishError` with both titles in the message. An unchanged republish writes no `redirects.json`. A removed body image is deleted, while a kept one is neither re-uploaded nor deleted. The new-post key gets `-2` when the folder exists. Deleting a used category is rejected. A category slug change adds `/blog/kategori/old/→/blog/kategori/new/` and the EN equivalent.
- [ ] **Step 2: Run** `npm test -- publish redirects`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): publish/unpublish changesets with automatic redirects`

### Task 8: Live SEO checker (pure)

**Files:**
- Create: `src/admin/lib/seo-check.ts`, `src/admin/lib/text-width.ts`
- Test: `tests/unit/admin/seo-check.test.ts`

**Interfaces:**
- `runSeoChecks(input: { lang: Lang; fields: LangFields; hasCover: boolean; otherKeywords: string[] }): { checks: SeoCheck[]; score: number }`. `SeoCheck = { id: string; level: 'green' | 'yellow' | 'red'; label: string; tip: string }`, with a Turkish label and a one-sentence tip. `score = round(100 × mean(green=1, yellow=0.5, red=0))`.
- `titlePixelWidth(text): number` approximates Arial 20 px (Google desktop title) from a per-character width table (Latin + Turkish letters, digits, punctuation; default 11 px). `truncateToWidth(text, px): string` adds `…`.
- Keyword matching: lowercase both sides with `toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US')`, and also fold `i̇` (i + U+0307) to `i`. Match phrase words in order with a word boundary before the first word. TR allows `\p{L}*` after each word (suffixes). EN allows `(s|es|'s)?`.
- Thresholds (spec §11 leaves them to the builder):

| id | green | yellow | red |
|---|---|---|---|
| `kw-title` / `kw-slug` / `kw-description` / `kw-first-paragraph` | keyword present (slug: `slugify(keyword)` is a substring) | — | absent or no keyword |
| `kw-subheading` | in ≥1 H2/H3 | no H2/H3 at all | H2/H3 exist without it |
| `kw-density` | 0.5–2.5 % | 0.2–0.5 % or 2.5–3.5 % | otherwise |
| `title-length` (seoTitle ?? title) | 400–580 px | 300–399 px or 581–650 px | otherwise / empty |
| `description-length` | 120–158 chars | 70–119 or 159–175 | otherwise / empty |
| `word-count` | ≥ 600 | 300–599 | < 300 |
| `headings` | no H3 before the first H2 | an H3 before any H2 | — |
| `image-alt` | every figure has alt | no images | a figure without alt |
| `internal-link` / `external-link` | ≥1 (internal: href starts with `/` or `https://klinikterapist.com`) | none | — |
| `sentence-length` (long = >16 words TR, >20 EN) | ≤ 25 % long | ≤ 35 % | more |
| `paragraph-length` (>120 words TR, >150 EN) | none | any | — |
| `sentence-starts` | no 3 consecutive sentences starting with the same word | some | — |
| `kw-unique` | keyword not in `otherKeywords` (same normalisation) | used before | — |
| `cover` | cover present | missing | — |

- [ ] **Step 1: Write the failing tests.** For each id, one green and one non-green case. The Review Focus #3 cases: TR keyword `kaygı` with title "Kaygının Bedeni" → `kw-title` green, and `İlişki` vs body "ilişkiler" → hit. EN `habit` matches "habits". A 60-char ASCII title is green, and a 75-char one is red. Score of all-green = 100.
- [ ] **Step 2: Run** `npm test -- seo-check`. Expected: FAIL.
- [ ] **Step 3: Implement.** Extract text, headings, links and figures from the `JSONContent` doc with one walk.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): live SEO checks with Turkish-aware keyword matching`

### Task 9: Image resizing in the browser

**Files:**
- Create: `src/admin/lib/image.ts`
- Test: `tests/unit/admin/image.test.ts`

**Interfaces:**
- `fitWithin(w, h, maxW, maxH): { w, h }` never upscales. `coverCrop(w, h, targetW, targetH): { sx, sy, sw, sh }` is a centered crop.
- `IMAGE_PRESETS = { body: { maxW: 1600, maxH: 1600, type: 'image/webp', q: 0.82 }, cover: { maxW: 1600, maxH: 1600, type: 'image/webp', q: 0.82 }, profile: { crop: [800, 880], type: 'image/webp', q: 0.85 }, resource: { maxW: 400, maxH: 600, type: 'image/webp', q: 0.82 }, og: { crop: [1200, 630], type: 'image/jpeg', q: 0.85 } }`. The profile crop matches the Portrait frame's 1 : 1.1.
- `resizeImage(file: File, preset): Promise<{ blob: Blob; base64: string; width: number; height: number }>` uses `createImageBitmap(file, { imageOrientation: 'from-image' })`, then an `OffscreenCanvas` (or a `<canvas>` fallback) and `convertToBlob`. If the result is > 1 MB, it retries with quality −0.1 down to 0.5. Accepted input: `image/jpeg|png|webp|gif|heic|heif`. A decode failure throws `ImageError` with "Bu görsel açılamadı. Lütfen JPEG ya da PNG olarak deneyin." A file over 25 MB → "Görsel çok büyük (en fazla 25 MB)."
- `fileNameFor(alt: string, used: Set<string>): string` → `slugify(alt, 'tr') || 'gorsel'` + `-2`… + `.webp`.

- [ ] **Step 1: Write the failing tests.** `fitWithin(4032, 3024, 1600, 1600)` → `{1600, 1200}`, and `fitWithin(800, 600, 1600, 1600)` → unchanged. `coverCrop(4000, 3000, 1200, 630)` keeps the 1200:630 ratio and is centered. `resizeImage` with a stubbed `createImageBitmap` that rejects → `ImageError` with the Turkish message. A 30 MB file is rejected before decoding. `fileNameFor('Yaprak çizimi', new Set(['yaprak-cizimi.webp']))` → `yaprak-cizimi-2.webp`.
- [ ] **Step 2: Run** `npm test -- image`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): browser-side image resizing to WebP/JPEG`

### Task 10: Panel shell — /admin page, sign-in, API clients, deploy status

**Files:**
- Create: `src/pages/admin/index.astro`, `src/admin/config.ts`, `src/admin/api/http.ts`, `src/admin/api/mock.ts`, `src/admin/ui/{App,Login,Shell,DeployStatus}.tsx`, `src/admin/ui/kit/*` (Button, Field, TextArea, Toggle, Tabs, Dialog, Toast, Lights), `src/admin/ui/admin.css`
- Modify: `astro.config.mjs` (`react()`), `package.json`, `tests/build/load.ts` (`allPages()` skips `/admin/`)
- Test: `tests/unit/admin/http.test.ts`, `tests/unit/admin/app.test.tsx`, `tests/build/admin.test.ts`

**Interfaces:**
- `config.ts`: `ADMIN_CONFIG = { apiUrl: string, googleClientId: string, ownerEmail: 'merhaba@klinikterapist.com' }`. These are public values, filled in Task 14. Empty strings make the login screen say "Panel henüz kurulmadı."
- `createHttpApi(apiUrl, session: SessionStore): Api`. `SessionStore = { get(): string | null; set(s, expiresAt): void; clear(): void }` is backed by `localStorage` key `kt-admin-session`. On `unauthorized` it clears the session and emits `onSignedOut`. Network failure → `ApiFailure('network', 'İnternet bağlantısı yok gibi görünüyor. Değişiklikleriniz bu cihazda saklandı.')`.
- `createMockApi(seed)` implements `Api` in memory from the fixture content. It is used only when `import.meta.env.DEV && location.search.includes('mock')`, so production bundles tree-shake it away.
- `App` routes with the hash: `#/` (Yazılar), `#/yazi/<key>`, `#/ayarlar/<screen>`. `Shell` has a side menu on desktop, a bottom bar and drawer on mobile, and `DeployStatus`. After any commit, `DeployStatus` polls `site.status` every 15 s until the run for that commit finishes: "Site güncelleniyor (1–3 dk)…" → "Yayında ✓" or "Yayın başarısız oldu. Sitede eski sürüm duruyor; bana (geliştiriciye) haber verin." with a link. When `tokenExpiresAt` is < 30 days away, it shows a yellow banner telling the owner to renew the GitHub key.
- Login uses the GIS script (`google.accounts.id.initialize({ client_id, callback, auto_select: true, ux_mode: 'popup' })` and `renderButton`) → `auth.login`.

- [ ] **Step 1: Write the failing tests.** http: a request body is `text/plain` JSON with `action` and `session`. An `unauthorized` reply clears the store and fires `onSignedOut`. A `fetch` rejection maps to `network`. App (with the mock API): no session → login screen. With a session → "Yazılar" heading. Unknown hash → Yazılar. Build: `/admin/index.html` has `meta[name=robots][content=noindex]` and an `h1` (the login fallback is visible without JS: "Yönetim paneli JavaScript gerektirir"), and is not in `sitemap-0.xml`. Other pages contain no `/_astro/` script that imports React.
- [ ] **Step 2: Run** `npm test && npm run test:build`. Expected: FAIL.
- [ ] **Step 3: Implement.** The admin page uses its own minimal layout, not `BaseLayout`: no site header, `lang="tr"`, the tokens and fonts.
- [ ] **Step 4: Run** `npm test && npm run test:build`, then `npm run dev` and open `http://localhost:4321/admin/?mock` in the browser pane. Check the shell at 360 px and desktop widths.
- [ ] **Step 5: Commit** `feat(admin): panel shell, Google sign-in, API client and deploy status`

### Task 11: Posts list and the editor (Tiptap, TR/EN tabs, autosave, publish)

**Files:**
- Create: `src/admin/ui/PostsList.tsx`, `src/admin/ui/editor/{EditorPage,PostEditor,BubbleBar,PlusMenu,PostSettings,PublishBar,ConflictDialog}.tsx`, `src/admin/ui/editor/nodes/{Figure,Youtube,Callout}.ts`, `src/admin/ui/editor/useAutosave.ts`, `src/admin/lib/posts-repo.ts`
- Test: `tests/unit/admin/autosave.test.ts`, `tests/unit/admin/editor.test.tsx`, `tests/unit/admin/posts-repo.test.ts`

**Interfaces:**
- `posts-repo.ts`: `loadLivePosts(api): Promise<LivePost[]>` (`site.tree` + `site.read` of every `tr.md`/`en.md`, parsed with `parsePost`). `liveToDraft(live, images): Draft`. `mergeList(live, drafts): PostRow[]`, where `PostRow = { key, title, category, status: 'taslak' | 'yayında' | 'yayında-değişiklik-var', updatedAt }`.
- List: search (title, both languages, Turkish-aware lowercase), category filter, status badge, "Yeni yazı" button.
- Editor: big title field (the H1), then the body. TR/EN tabs share one Draft. Each tab shows a dot when that language is complete. The Tiptap extensions are StarterKit (headings limited to `[2,3]`, code disabled), Link (`openOnClick: false`, https/mailto/`/` only), Placeholder, and the three custom nodes. The figure node view shows the image from an object-URL map (draft images loaded via `images.get`, live ones via `site.read`) and editable caption/alt inputs. A BubbleMenu has Kalın, İtalik, H2, H3, Link, Alıntı. A FloatingMenu "+" on empty lines has Görsel, Ayraç, YouTube, Vurgu kutusu. The settings drawer has, shared: category, cover (upload, preset `cover`), publish date. Per language: URL kısa adı (auto from the title until edited, shows `klinikterapist.com/blog/<slug>/`), SEO başlığı, meta açıklama, odak kelime, kapak alt metni.
- `useAutosave(draft, api, { debounceMs: 2000, maxWaitMs: 10000 })` writes the draft to `localStorage` key `kt-draft-<key>` on every change and to `drafts.save` after the debounce. Status: `'kaydedildi' | 'kaydediliyor' | 'cihazda' | 'çakışma'`. A network or session failure keeps `cihazda`, retries every 15 s and after sign-in, and never drops the local copy until a server save succeeds. On `conflict` it opens `ConflictDialog`: "Bu taslak başka bir cihazda daha yeni kaydedilmiş." with "Diğer cihazdakini aç" and "Bu cihazdakini kaydet (diğerinin üzerine yaz)". On opening a draft whose local copy is newer than the server rev, it offers to restore it.
- Image upload inside the editor: `resizeImage(preset body)` → `images.put` → insert figure. The Drive upload completes before the node is inserted.
- PublishBar: "Yayınla" (or "Değişiklikleri yayınla" for live posts) is disabled while `canPublish(draft).ok` is false. A tooltip/list shows the missing items per language. Publishing saves the draft, builds the changeset (Task 7), shows its notices, `site.commit`s, then deletes the Drive draft and the local copy, starts DeployStatus and shows the live URLs. On failure the draft stays and the error message is shown. "Yayından kaldır" (live posts only) opens a confirm dialog, saves the post as a Drive draft, then commits `buildUnpublishChangeset`. "Taslağı sil" (drafts only) asks for confirmation and moves the draft to Drive trash.
- A reminder under the publish button on success: "Medium'a aktarmak için: Medium › Import a story › bu yazının adresi (canonical otomatik eklenir)." (§9).

- [ ] **Step 1: Write the failing tests.** autosave (fake timers, mock api): edits within 2 s send one save. Continuous typing saves by 10 s. A rejected save keeps the status `cihazda`, the localStorage copy remains, and the retry succeeds. A `conflict` sets `çakışma` and does not retry. editor (jsdom, mock api): with only TR filled the Yayınla button is disabled and the list names the missing EN fields. After filling EN it is enabled. The slug follows the title until edited by hand. posts-repo: a live post with a Drive draft shows `yayında-değişiklik-var`.
- [ ] **Step 2: Run** `npm test -- admin`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, then in the browser pane with `?mock`: write a post in both languages, add an image with a caption, a callout and a YouTube link, publish, rename the slug and republish (the mock shows the redirect written), unpublish. Test at 360 px.
- [ ] **Step 5: Commit** `feat(admin): Medium-style bilingual editor with autosave and publishing`

### Task 12: SEO panel in the editor

**Files:**
- Create: `src/admin/ui/editor/{SeoPanel,SerpPreview,SocialPreview}.tsx`
- Modify: `src/admin/ui/editor/EditorPage.tsx`
- Test: `tests/unit/admin/seo-panel.test.tsx`

**Interfaces:**
- Consumes: `runSeoChecks`, `titlePixelWidth`, `truncateToWidth`.
- `SeoPanel({ lang, draft, otherKeywords })`. It sits right of the editor at ≥ 1024 px and below it on smaller screens, and runs on the active tab's language with a 300 ms debounce. It shows the score (a ring), a list of lights with tips, and the SERP preview with a desktop/mobile toggle: the title truncated at 580 px desktop / 500 px mobile, the URL line `klinikterapist.com › blog › <slug>` (EN: `› en › blog ›`) and the description cut at 158 / 120 chars. The social preview uses the cover image (or `seo.ogImage`), the title and the description. `otherKeywords` are the focus keywords of all other live posts in that language. Lights use colour **and** an icon/text (for colour-blind users).

- [ ] **Step 1: Write the failing test.** Rendering with a draft whose TR keyword is absent from the title shows a red "Odak kelime başlıkta" item. Switching to the EN tab re-runs the checks for EN. A 90-char description is cut with `…` in the preview.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: PASS. Check the layout in the browser pane at 360 px and 1280 px.
- [ ] **Step 5: Commit** `feat(admin): live SEO panel with search and social previews`

### Task 13: Site settings screens

**Files:**
- Create: `src/admin/ui/settings/{SettingsPage,useSettingsFile,LocalizedField,ListEditor,ImageField,MarkdownField}.tsx` and one screen each: `{Profil,AnaSayfa,Linkler,Hakkimda,Kaynaklar,Iletisim,Kategoriler,SeoGenel,YasalMetinler}.tsx`
- Test: `tests/unit/admin/settings.test.tsx`

**Interfaces:**
- `useSettingsFile<T>(api, path, parse: (raw: unknown) => T)` loads via `site.read`, keeps `sha` and a `dirty` flag, and has `save(value, message)`: `parse(value)` (the zod error is shown under the matching field by its issue path), then `JSON.stringify(value, null, 2) + '\n'`, then `site.commit` with `expectSha`. A `conflict` → "Bu ayar başka bir yerde değişmiş. Sayfayı yenileyip tekrar deneyin." A `beforeunload` warning appears while dirty.
- `LocalizedField` shows TR and EN inputs side by side (stacked on mobile). `ListEditor` handles add, delete (with confirm) and reorder with up/down buttons (no drag-only interactions, which are hard on phones). `ImageField(preset)` runs `resizeImage` → a `public/images/<name>-<shortHash>.webp` (or `.jpg` for og) write in the same commit as the JSON, deletes the old file, and stores the public path. `MarkdownField` is a textarea with a live preview through `renderMarkdown` (the site's own renderer).
- Screens and the files they write (§8.3):
  - Profil → `profile.json`: name, title, tagline, intro, shortIntro, photo (preset `profile`), photoAlt.
  - Ana sayfa → `home.json`: card order, visible, title, subtitle, icon (select from `src/lib/icons.ts` names), target (page select or https URL).
  - Linkler → `links.json`: add, delete, reorder. The icon is a select. A `mailto:` URL is required for icon `email`. Toggles for inHero/inFooter.
  - Hakkımda → `about.json`: heading, lead, areas list, whoAmI/whyThisWork (`MarkdownField`), quote, timeline list with `period` as "Tek metin" (string) or "TR/EN ayrı" (localized).
  - Kaynaklar → `resources.json` `{ myNote, items }`: type select, title, author, note, url, cover (preset `resource`), a featured radio (only one item).
  - İletişim → `contact.json`: intro, workStyle, responseTime, emergencyNote, email (validated).
  - Kategoriler → `categories.json` via `buildCategoryChangeset`. The slug is auto from the label until edited. "Kullanımda" disables delete.
  - SEO genel → `seo.json`: siteName, defaultDescription, ogImage (preset `og`), gscVerification.
  - Yasal metinler → `src/data/legal/{aydinlatma,gizlilik}.{tr,en}.md`, 4 `MarkdownField`s, one commit per save.

- [ ] **Step 1: Write the failing tests** (jsdom, mock api). Saving contact with `email: 'yok'` shows the e-mail error and makes no commit. Saving a valid profile commits exactly `src/data/profile.json` with `expectSha`, and the content passes `parseProfile`. Resources keep the `{ myNote, items }` shape. Setting a second featured resource unsets the first. A timeline period switched to "TR/EN ayrı" saves `{ tr, en }`. Deleting a used category is blocked with the Turkish message.
- [ ] **Step 2: Run** `npm test -- settings`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, then use every screen in the browser pane with `?mock`, at 360 px and desktop widths.
- [ ] **Step 5: Commit** `feat(admin): all site-settings screens`

### Task 14: Setup guide, deployment and live verification

**Files:**
- Create: `docs/kurulum/yonetim-paneli.md`
- Modify: `src/admin/config.ts` (real `apiUrl`, `googleClientId`), `apps-script/.clasp.json` (local, gitignored)

The owner does every step that needs their sign-in or a secret. I guide them and never type a password or token.

- [ ] **Step 1: Write the Turkish guide**, one short numbered section per step, each with "ne göreceksiniz" notes:
  1. Google Cloud: create project `klinikterapist-panel`, set the OAuth consent screen to **Internal**, and create a **Web** OAuth client with JavaScript origins `https://klinikterapist.com` and `http://localhost:4321`. Copy the client ID (it is public; paste it to me).
  2. Apps Script: turn on "Google Apps Script API" at `script.google.com/home/usersettings`. Then I run `npx clasp login` and the owner signs in in the browser window. Then I run `npm run gas:push` and `npm run gas:deploy`, and I put the web app URL in `config.ts`.
  3. GitHub: create a fine-grained token for **only** `klinikterapist/klinikterapist-site`, with Contents read/write, Actions read and Metadata read, expiring in 1 year. The owner pastes it themselves in Apps Script › Proje ayarları › Komut dosyası özellikleri as `GITHUB_TOKEN`, next to `GOOGLE_CLIENT_ID`, `OWNER_EMAIL`, `GITHUB_REPO` and `GITHUB_BRANCH`.
  4. First authorisation: open the web app URL once and approve the Drive/external-request permissions.
  5. Daily use: sign in at `klinikterapist.com/admin/`, the meaning of the autosave status, what "Site güncelleniyor" means, and renewing the GitHub key yearly (the panel warns 30 days ahead).
- [ ] **Step 2: Run** `npm test && npm run test:build && npm run check:launch && npm run build`. Expected: all PASS.
- [ ] **Step 3: Live check against the real backend from `npm run dev`** (origin `localhost:4321`). Sign in as the owner. A second Google account is refused with "Bu panel yalnızca site sahibine açıktır." Create a test draft, edit it on the phone and check that it continues on the desktop, then delete the test draft. No test post is committed to the live repo.
- [ ] **Step 4: Commit** `docs: admin panel setup guide; config: live API URL and client ID`
- [ ] **Step 5: Ask the owner for the go-ahead to push.** After the push: CI is green, `https://klinikterapist.com/admin/` shows the sign-in, the owner signs in on the live site, and changing the contact "dönüş süresi" text and saving shows "Yayında ✓" and the new text on `/iletisim/`. Revert it if the owner wishes.
