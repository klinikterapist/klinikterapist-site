# Panel v3 — C: Scheduled Publishing, Own Counter, Statistics Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship spec phases 6–7:
- **Scheduled publishing.** A post waits in Drive until its time. An hourly Apps Script trigger then publishes it through the same publish path the panel uses.
- **A cookieless, anonymous page counter** stored in the owner's Google account. It ships together with the updated legal texts.
- **The redesigned Ana sayfa** with charts.

**Architecture:**
- **One publish flow.** The publish steps in `EditorPage.publish` move into a pure async `publishDraft(api, draft, …)`. The panel calls it with the HTTP `Api`. Apps Script calls it with an in-process `Api` adapter over `github.ts` and `drive.ts`. One code path means the scheduled and manual publishes cannot drift apart.
- **One hourly trigger** (`hourly()`). It runs two jobs: (1) publish the drafts that are due, (2) flush the counter buckets.
- **Counting.** Hits land in hour buckets in Script Properties under a lock. The flush rolls them into monthly JSON files in the panel's Drive folder. `stats.summary` reads those files plus the buckets not yet flushed.

**Tech Stack:** Google Apps Script (V8, esbuild IIFE bundle), TypeScript, React 19, Vitest with the existing `fake-gas` / `fake-github`, hand-written SVG charts (no chart dependency).

**Spec:** `docs/superpowers/specs/2026-10-18-panel-v3-design.md` (§5.5, §5.9, §5.10). Plans A and B must be merged first. This plan extends Plan A's `SettingsPanel`, checklist and top-bar Yayınla button.

## Global Constraints

- Everything in Plan A's Global Constraints applies.
- A scheduled post's text must not reach GitHub before its time (owner's decision; the repo `klinikterapist/klinikterapist-site` is public).
- The time zone is `Europe/Istanbul` (already set in `apps-script/appsscript.json`). The post is published within one hour after its scheduled time. The panel says so verbatim: "Planlanan saatten sonraki bir saat içinde yayınlanır".
- **Counter privacy:** none of the following, ever:
  - cookies;
  - `localStorage` / `sessionStorage` identifiers;
  - fingerprinting;
  - storing the IP address;
  - the full referrer URL (only its host).
- Requests per page visit: at most one view, one read and one per counted click. Each is a `navigator.sendBeacon` sent after `load`; a failure is silent.
- **The counter's inline script stays small.** It may not add more than 1 KB to any page.
- **Release gate:** the counter must not be live before the updated gizlilik and aydınlatma texts (TR + EN) that the owner approved. Until the owner approves, the counter stays off behind a flag and the dashboard shows its empty state.
- **Apps Script runtime:** no `atob`, `btoa` or `TextEncoder` (use `Utilities` via `Gas`). Deploy with `npm run gas:push` and then `npm run gas:deploy`; the URL stays the same.
- **New OAuth scope:** `https://www.googleapis.com/auth/script.scriptapp`, needed for the trigger. The owner re-authorizes once. Document the steps in plain Turkish in `docs/kurulum/yonetim-paneli.md`.

## Review Focus

- **The owner edits a scheduled draft in the panel while the hourly trigger publishes it.** Expect: the panel shows the existing "Bu taslak başka bir cihazda yayınlanmış ya da silinmiş" dialog and offers to keep the text as a new draft. Tested in Task C3 (trigger deletes the draft, then the panel's next save gets `not_found`).
- **The publish fails at its scheduled time** (GitHub down, slug clash, a missing image). Expect: the draft stays scheduled and is retried the next hour. The error shows on the post and on Ana sayfa. Nothing is half-committed. Tested in Task C3.
- **Someone posts junk to `stats.hit`** (huge path, unknown type, 10,000 distinct paths). Expect: invalid hits are dropped. An hour bucket holds at most 300 distinct keys, and later new keys in that hour are dropped. The endpoint never reads data or returns error details. Tested in Task C5.
- **Daylight-saving or month boundary in the stats** (a hit at 23:30 on 31 October Istanbul time). Expect: it is counted on the Istanbul day, in the October file. Tested in Task C5.
- **The panel owner's own browser.** Expect: no hits while the "beni sayma" flag is set. The flag is set on sign-in and can be switched off in the panel. Tested in Task C6.

---

### Task C1: Extract the publish flow into `publishDraft`

**Files:**
- Create: `src/admin/lib/publish-flow.ts`
- Modify: `src/admin/ui/editor/EditorPage.tsx` (`publish()`, and its `figureNames` moves into the flow)
- Test: `tests/unit/admin/publish-flow.test.ts` (new), `tests/unit/admin/editor.test.tsx` must stay green

**Interfaces:**
- Consumes: `loadSiteState` (`posts-repo.ts`), `buildPublishChangeset` and `PublishError` (`publish.ts`), `ImageStore` (`ui/editor/images.ts`), `isoDay` (`draft.ts`).
- Produces:
  ```ts
  export type PublishApi = Pick<Api, 'tree' | 'read' | 'commit' | 'getImage' | 'putImage' | 'deleteDraft'>;
  export async function publishDraft(
    api: PublishApi,
    draft: Draft,
    opts: { now: Date; force?: boolean; images?: ImageStore },
  ): Promise<{ commitSha: string; key: string; notices: string[]; wasLive: boolean }>;
  ```
  - It loads the site state, resolves `live`, collects the image names (figures, figure `orig`, `cover`, `coverOriginal`) and builds the changeset.
  - It commits with the message `Yazı yayınlandı: <tr title>` or `Yazı güncellendi: <tr title>`.
  - It deletes the Drive draft (`deleteDraft`; an error here is ignored, as today).
  - When `opts.images` is absent it builds `new ImageStore(api, draft.key, repoImagesOf(live))`.
  - It throws `PublishError` exactly as today (the `stale` case included).

- [ ] **Step 1: Write `publish-flow.test.ts`** against `createMockApi`:
  - `'publishes a new post and deletes the draft'`: one commit, `state.drafts` no longer has the key.
  - `'force replaces a changed live version'`.
  - `'a stale live version throws PublishError stale and commits nothing'`.
  - `'a missing image throws and commits nothing'`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/admin/publish-flow.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `publishDraft`.** Then make `EditorPage.publish` call it: the call happens after `auto.saveNow()`, and `auto.stop()`, `clearBackup` and `deploy.track` stay in the page.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, with no change to the editor tests.
- [ ] **Step 5: Commit** with `refactor(editor): publish flow as a reusable publishDraft`.

### Task C2: Run `publishDraft` inside Apps Script

**Files:**
- Create: `apps-script/src/server-api.ts`
- Modify: `apps-script/build.mjs` (add the shim `function hourly(e) { return App.hourly(e); }`), `apps-script/src/main.ts` (export `hourly`, a no-op for now)
- Test: `tests/unit/apps-script/server-api.test.ts` (new), `tests/unit/apps-script/main.test.ts`

**Interfaces:**
- Consumes: `tree`, `read`, `commit` (`github.ts`); `getImage`, `putImage`, `deleteDraft` (`drive.ts`); `publishDraft` (Task C1).
- Produces: `serverApi(gas: Gas): PublishApi`. Each method wraps the matching sync function in `Promise.resolve`, and an `ApiError` thrown inside becomes an `ApiFailure` with the same code and message.

- [ ] **Step 1: Write `server-api.test.ts`** with `fake-gas` and `fake-github`. `'publishDraft runs end to end inside the backend'`:
  1. save a complete draft with one figure image through `saveDraft` and `putImage`;
  2. `await publishDraft(serverApi(gas), draft, { now })`;
  3. assert the fake GitHub received one commit with `tr.md`, `en.md` and the image, and that the Drive draft is gone.
- [ ] **Step 2: Add a bundle smoke test** to `main.test.ts`: run `node apps-script/build.mjs` (or import the built `dist/Code.js` text) and assert that it contains `function hourly(` and that the bundle parses. This catches `astro/zod` or Node-only imports leaking into the bundle. If `astro/zod` fails to bundle on the `neutral` platform, add an esbuild `alias` from `astro/zod` to `zod`, which is the package it re-exports.
- [ ] **Step 3: Run** `npx vitest run tests/unit/apps-script`. Expected: FAIL.
- [ ] **Step 4: Implement `serverApi`, the `hourly` export and the shim.**
- [ ] **Step 5: Run** `npx vitest run tests/unit/apps-script` and `npm run gas:build`. Expected: PASS. The build prints the bundle size; note it in the commit message.
- [ ] **Step 6: Commit** with `feat(apps-script): run the publish flow in the backend`.

### Task C3: Scheduling backend — due drafts published by the hourly trigger

**Files:**
- Modify:
  - `src/admin/api/types.ts`: `Draft.scheduledAt`, `DraftSummary.scheduledAt` and `DraftSummary.scheduleError`, new `Api.ensureTriggers`, `ACTIONS`
  - `src/admin/lib/draft.ts`: `normalizeDraft` fills `scheduledAt: null`
  - `apps-script/src/drive.ts`: `listDrafts` adds the two summary fields
  - `apps-script/src/main.ts`: `hourly`; the `admin.triggers` action
  - `apps-script/src/gas.ts`: `Gas.triggers`
  - `apps-script/appsscript.json`: the new scope
  - `src/admin/api/http.ts`, `src/admin/api/mock.ts`
  - `docs/kurulum/yonetim-paneli.md`
- Create: `apps-script/src/schedule.ts`
- Test:
  - `tests/unit/apps-script/schedule.test.ts` (new)
  - `tests/unit/apps-script/drive.test.ts`
  - `tests/unit/apps-script/fake-gas.ts` (add `triggers`)

**Interfaces:**
- Produces:
  - `Draft.scheduledAt: string | null`: an ISO instant with offset (e.g. `2026-10-24T09:00:00+03:00`). Non-null means planned.
  - `DraftSummary` gains `scheduledAt: string | null` and `scheduleError: string | null`.
  - `Gas.triggers: { ensureHourly(handler: 'hourly'): void }`. The real implementation uses `ScriptApp.getProjectTriggers()` and creates `ScriptApp.newTrigger('hourly').timeBased().everyHours(1).create()` only when it is missing.
  - `runScheduled(gas: Gas, now: Date): Promise<{ published: string[]; failed: { key: string; message: string }[] }>`, in `schedule.ts`:
    1. It lists the drafts and picks those with `scheduledAt <= now`, oldest first.
    2. For each, it reads the full draft and calls `publishDraft(serverApi(gas), { ...draft, publishedAt: isoDay(new Date(draft.scheduledAt)) }, { now })`.
    3. On success it clears the property `sched:err:<key>`. On failure it stores the Turkish message there. The draft stays as it is.
    4. When nothing is due it returns quickly: one `listDrafts` call and no GitHub calls.
  - `listDrafts` reads `sched:err:<key>` into `scheduleError`.
  - Action `admin.triggers` (session required) → `ensureHourly('hourly')`; `Api.ensureTriggers(): Promise<void>`. The panel calls it once per session, from the first `Planla` and from the Ana sayfa load.
  - `hourly()` = `runScheduled(gas, new Date(gas.now()))`. Task C5 adds the flush after it. Each job has its own try/catch, and errors go to `gas.log` without draft text.

- [ ] **Step 1: Write `schedule.test.ts`:**
  - `'publishes only due drafts'`: a draft due an hour ago is published; one due tomorrow is untouched.
  - `'a failing publish keeps the draft and records the error; the next run retries'`: make fake-github fail once, then succeed.
  - `'nothing due: no GitHub call'`: the fake-github request count is 0.
  - `'publishedAt becomes the Istanbul day of scheduledAt'`: `2026-10-31T23:30:00+03:00` → `publishedAt: 2026-10-31` in the committed frontmatter.
  - `drive.test.ts`: `listDrafts` returns `scheduledAt` and `scheduleError`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/apps-script`. Expected: FAIL.
- [ ] **Step 3: Implement** the types, `runScheduled`, the triggers in `Gas` (real and fake), `admin.triggers`, `hourly`, the scope, and the mock and HTTP `ensureTriggers`.
- [ ] **Step 4: Write the setup doc section** "Planlı yayın için tek seferlik izin" in plain Turkish: after `gas:push` and `gas:deploy`, open the panel and plan any post. If Google asks for permission, approve it.
- [ ] **Step 5: Run** `npm test`. Expected: PASS.
- [ ] **Step 6: Commit** with `feat(apps-script): hourly trigger publishes scheduled drafts`.

### Task C4: Scheduling in the panel

**Files:**
- Modify:
  - `src/admin/ui/editor/SettingsPanel.tsx`: date + time
  - `src/admin/ui/editor/EditorPage.tsx`: Yayınla / Planla button, confirm dialog, badge, cancel
  - `src/admin/lib/checklist.ts`: unchanged rules; also gates Planla
  - `src/admin/lib/posts-repo.ts`: `PostStatus` gains `'planlandı'`; `mergeList`
  - `src/admin/ui/context.tsx`: route `#/yazilar/planlanan`
  - `src/admin/ui/PostsList.tsx`: the third tab
  - `src/admin/lib/dashboard.ts`: `scheduled` list, `scheduleErrors`
- Test:
  - `tests/unit/admin/editor.test.tsx`
  - `tests/unit/admin/posts-list.test.tsx`
  - `tests/unit/admin/posts-repo.test.ts`
  - `tests/unit/admin/dashboard.test.ts`
  - `tests/unit/admin/routes-admin.test.ts`

**Interfaces:**
- Consumes: `Draft.scheduledAt`, `DraftSummary.scheduleError`, `Api.ensureTriggers` (Task C3).
- Produces:
  - `istanbulIso(day: string, time: string): string` in `draft.ts`. For example `('2026-10-24', '09:00')` → `'2026-10-24T09:00:00+03:00'`. Turkey has used a fixed +03:00 since 2016.
  - `isFuture(iso: string, now: Date): boolean`.

- [ ] **Step 1: Write the failing tests.**
  - `editor.test.tsx`:
    - `'a future time turns Yayınla into Planla'`: set the date to tomorrow and the time to `09:00`. The top button reads "Planla", and the Ayarlar panel shows "Planlanan saatten sonraki bir saat içinde yayınlanır".
    - `'Planla saves the schedule and commits nothing'`: confirm in the dialog "Yazı 24 Ekim 2026, 09.00'da yayına girecek". Then `api.state.commits.length === 0`, the saved draft has `scheduledAt === '2026-10-24T09:00:00+03:00'`, and the badge reads "Planlandı".
    - `'Planlamayı iptal et returns it to a draft'`: `scheduledAt` becomes null and the badge reads "Taslak".
    - `'a schedule error shows on the post'`: with `scheduleError` set in the mock, a warning banner reads "Planlanan yayın yapılamadı, tekrar denenecek." followed by the message.
  - `posts-repo.test.ts`: a draft with `scheduledAt` gets status `'planlandı'` with label "Planlandı".
  - `posts-list.test.tsx`: the tab "Planlanan (1)" lists it, and `#/yazilar/planlanan` opens that tab.
  - `dashboard.test.ts`: `scheduled` is sorted by time, and `scheduleErrors` lists the failing ones.
- [ ] **Step 2: Run** the listed test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Planning:** the Planla path calls `api.ensureTriggers()` (errors ignored), sets `scheduledAt` and `publishedAt`, and calls `auto.saveNow()`. It must not call `publishDraft`.
  - **Editing a planned draft:** the edit saves normally; the trigger always publishes the last saved copy.
  - **Past times:** a time in the past means "Yayınla" (immediate) as today.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Check in the browser** (mock backend): plan, cancel, plan again; check the Planlanan tab; check the top bar at 375px.
- [ ] **Step 6: Commit** with `feat(editor): schedule a post for a date and time`.

### Task C5: Counter backend — `stats.hit`, hour buckets, monthly files, `stats.summary`

**Files:**
- Create: `apps-script/src/stats.ts`, `src/lib/stats-wire.ts` (shared validation and types)
- Modify:
  - `apps-script/src/main.ts`: `stats.hit` is handled before `checkSession`; `stats.summary` is a session action; `hourly` also flushes
  - `src/admin/api/types.ts`: `Api.statsSummary`, `ACTIONS`
  - `src/admin/api/http.ts`, `src/admin/api/mock.ts`: the mock returns seeded demo days
- Test:
  - `tests/unit/apps-script/stats.test.ts` (new)
  - `tests/unit/stats-wire.test.ts` (new)
  - `tests/unit/apps-script/main.test.ts`

**Interfaces:**
- Produces, in `src/lib/stats-wire.ts`:
  - `type HitType = 'view' | 'read' | 'click'`
  - `type Hit = { t: HitType; p: string; r?: string; d?: 'm' | 't' | 'd'; l?: 'tr' | 'en'; k?: string }`
  - `parseHit(body: unknown): Hit | null`:
    - `p` must match `/^\/[a-z0-9\-/]{0,120}$/` and end with `/`;
    - `r` (host only) must match `/^[a-z0-9.-]{1,80}$/`;
    - `k` (link id) must match `/^[a-z0-9-]{1,40}$/` and is required for `click`;
    - unknown fields are dropped;
    - anything invalid → null.
  - `hitKeys(h: Hit): string[]`: the counter keys one hit increments.
    - `view` → `v|<p>`, plus `ref|<r or 'direct'>`, `dev|<d>`, `lang|<l>` when present.
    - `read` → `rd|<p>`.
    - `click` → `c|<k>`.
  - `type DayCounts = Record<string, number>`
  - `type StatsSummary = { days: Record<string /* YYYY-MM-DD Istanbul */, DayCounts>; since: string | null }`
- Produces, in `apps-script/src/stats.ts`:
  - `recordHit(gas, body)`. It works under `gas.withLock`. It increments the keys in the property `st:<YYYYMMDDHH Istanbul>`, a JSON `DayCounts`. A bucket holds at most 300 keys; later new keys are dropped and existing keys keep counting. On first use it sets the property `st:since` to today.
  - `flushStats(gas, now)`. It moves every bucket older than the current hour into the Drive file `istatistik/<YYYY-MM>.json`, which looks like `{ days: { 'YYYY-MM-DD': DayCounts } }`, summing into what is there, and then deletes those properties.
  - `statsSummary(gas, { from, to })` returns `StatsSummary`, merging the files with the buckets not yet flushed.
  - `Api.statsSummary(range: { from: string; to: string }): Promise<StatsSummary>`.
- `stats.hit` always returns `ok({})`, also for invalid input, and never reads data. Being public and outside the session check, it is the only such action. The test enumerates `ACTIONS` to keep it that way.

- [ ] **Step 1: Write `stats-wire.test.ts`:**
  - a valid view is parsed;
  - a path with `?q=` → null;
  - a path longer than 121 characters → null;
  - `click` without `k` → null;
  - `r: 'https://instagram.com/x'` → null (hosts only);
  - an extra field `ip` is dropped.
- [ ] **Step 2: Write `stats.test.ts`:**
  - `'hits add up in the Istanbul hour bucket'`;
  - `'the 301st distinct key in an hour is dropped'`;
  - `'flush moves old buckets into the month file and deletes them'`;
  - `'23:30 on 31 October Istanbul lands in 2026-10'`;
  - `'summary merges files and unflushed buckets for the range'`;
  - `main.test.ts`: `handle(gas, '{"action":"stats.hit","t":"view","p":"/"}')` → ok without a session, and `stats.summary` without a session → `unauthorized`.
- [ ] **Step 3: Run** `npx vitest run tests/unit/stats-wire.test.ts tests/unit/apps-script`. Expected: FAIL.
- [ ] **Step 4: Implement.** `hourly()` now runs `runScheduled` and then `flushStats`, each in its own try/catch.
- [ ] **Step 5: Run** `npm test` and `npm run gas:build`. Expected: PASS.
- [ ] **Step 6: Commit** with `feat(apps-script): anonymous page counter with hourly roll-up`.

### Task C6: Site counter script, tracked links, legal texts, owner flag

**Release gate.** This task starts by asking the owner to approve the new legal wording. Do not merge it to `main` until the owner has approved it in chat.

**Files:**
- Create: `src/components/Counter.astro` (inline `<script is:inline>`; the endpoint is `ADMIN_CONFIG.apiUrl`, imported at build time)
- Modify:
  - `src/layouts/BaseLayout.astro`: include `<Counter />` only when `COUNTER_ENABLED` is true
  - `src/lib/site.ts`: `export const COUNTER_ENABLED = false`; switched on in this task's last step after approval
  - `src/views/PostView.astro`: `<div data-read-end aria-hidden="true"></div>` after `<AuthorBox>`
  - `src/components/Hero.astro`, `src/components/Footer.astro`, `src/components/LinkCard.astro`, `src/views/ContactView.astro`: `data-track="<link id>"` on social, e-mail and Randevu links. Randevu uses `data-track="randevu"`, e-mail uses `data-track="email"`.
  - `src/data/legal/gizlilik.tr.md`, `gizlilik.en.md`, `aydinlatma.tr.md`, `aydinlatma.en.md`
  - `src/admin/ui/Login.tsx` / `src/admin/api/session.ts`: set `localStorage['kt.noTrack'] = '1'` on sign-in
  - `src/admin/ui/Shell.tsx`: a toggle in the menu, "Bu cihazda kendi ziyaretlerimi sayma"
- Test:
  - `tests/build/pages.test.ts` (fixture build with the flag forced on via env `COUNTER=1`)
  - `tests/unit/admin/app.test.tsx`

**Interfaces:**
- Consumes: the `stats.hit` wire format (Task C5).
- Script behaviour:
  - Skip everything if `navigator.webdriver`, if `/bot|crawl|spider|preview/i` matches the user agent, or if `localStorage.getItem('kt.noTrack') === '1'` (wrapped in try/catch).
  - **View:** on `load`, send a view with `p: location.pathname`, `r` = `document.referrer`'s host (none if it is the same site), `d` from `innerWidth` (<768 → `m`, <1100 → `t`, else `d`) and `l` from `<html lang>`.
  - **Read:** an `IntersectionObserver` on `[data-read-end]` sends one read.
  - **Click:** a delegated click handler on `[data-track]` sends a click with `k`.
  - Body: `new Blob([JSON.stringify({ action: 'stats.hit', ... })], { type: 'text/plain' })`.

- [ ] **Step 1: Write the new legal wording** in TR and EN, following spec §5.9. It replaces "Takip yok" (gizlilik) and "analiz aracı kullanılmaz" (aydınlatma) with "Ziyaret edilen sayfaların anonim, toplam sayıları tutulur. Çerez kullanılmaz, IP adresi ve kişiyi tanımlayan hiçbir bilgi kaydedilmez." Show the four diffs to the owner in chat and wait for approval. Keep the flag off until then.
- [ ] **Step 2: Write the failing tests.**
  - `pages.test.ts`, with `COUNTER=1`:
    - every page has exactly one inline script containing `stats.hit`, and its length is ≤ 1024 bytes;
    - the post page has `[data-read-end]`;
    - the contact page cards carry `data-track`;
    - without `COUNTER=1`, no page contains `stats.hit`.
  - `pages.test.ts`: the built gizlilik page no longer contains "Takip yok" and does contain "anonim".
  - `app.test.tsx`: after the mock sign-in, `localStorage.getItem('kt.noTrack') === '1'`. Switching the menu toggle off removes it.
- [ ] **Step 3: Run** `npm run test:build` and `npx vitest run tests/unit/admin/app.test.tsx`. Expected: FAIL.
- [ ] **Step 4: Implement** `Counter.astro`, the markers, the attributes, the flag, the owner toggle and the approved legal texts.
- [ ] **Step 5: Run** `npm test` and `npm run test:build`. Expected: PASS.
- [ ] **Step 6: Check in the browser** with the built site and the flag on. The network panel should show one `sendBeacon` POST per page view, one after scrolling to the end of a post, and one per tracked click. The request body must hold no cookie or identifier. With `kt.noTrack` set, there should be no requests.
- [ ] **Step 7: Once the owner has approved the texts,** set `COUNTER_ENABLED = true`. Then commit with `feat(site): anonymous counter with updated privacy texts`.

### Task C7: Ana sayfa dashboard with charts

**Files:**
- Create:
  - `src/admin/lib/stats.ts` (pure aggregation)
  - `src/admin/ui/charts/LineChart.tsx`, `src/admin/ui/charts/BarList.tsx`, `src/admin/ui/charts/Donut.tsx`
  - `src/admin/ui/home/StatCards.tsx`
- Modify: `src/admin/ui/Home.tsx`, `src/admin/lib/dashboard.ts`, `src/admin/ui/admin.css`
- Test:
  - `tests/unit/admin/stats.test.ts` (new)
  - `tests/unit/admin/home.test.tsx`
  - `tests/unit/admin/charts.test.tsx` (new)

**Interfaces:**
- Consumes: `Api.statsSummary`, `StatsSummary` (Task C5); `dashboard()` with `scheduled` and `scheduleErrors` (Task C4); live posts from `loadSiteState` to map paths to titles.
- Produces, in `src/admin/lib/stats.ts`:
  - `type Period = 7 | 30 | 90 | 'all'`
  - `rangeFor(p: Period, now: Date, since: string | null): { from: string; to: string; prevFrom: string; prevTo: string }`
  - `aggregate(s: StatsSummary, r: ReturnType<typeof rangeFor>, posts: LivePost[]): DashboardStats`:
    ```ts
    type DashboardStats = {
      totals: { views: number; reads: number; prevViews: number; prevReads: number };
      daily: { day: string; views: number; reads: number }[]; // every day in range, zeros filled
      topPosts: { key: string; title: string; views: number; reads: number; readRate: number }[]; // top 5 by reads
      topPages: { path: string; label: string; views: number }[]; // top 5 non-post pages
      referrers: { label: string; views: number }[]; // instagram.com→Instagram, google.*→Google, direct→Doğrudan, rest→Diğer
      devices: { label: 'Telefon' | 'Tablet' | 'Bilgisayar'; views: number }[];
      langs: { label: 'Türkçe' | 'İngilizce'; views: number }[];
      clicks: { id: string; label: string; count: number }[];
    };
    ```
    - A post path is matched to a post through `postPath(slug, lang)` for both languages, and both language paths add up into one post.
    - Page labels come from `pathFor` reverse lookup, e.g. Ana sayfa, Hakkımda, İletişim, Randevu, Blog, Kaynaklar.
    - The change percentage is `prev === 0 ? null : Math.round((cur - prev) / prev * 100)`.

- [ ] **Step 1: Write `stats.test.ts`:**
  - TR and EN paths of one post add up;
  - missing days are filled with zero;
  - read rate = reads ÷ views, rounded to a whole percent;
  - referrer grouping;
  - the previous-period change is null when prev is 0;
  - `'all'` starts at `since`.
- [ ] **Step 2: Write `charts.test.tsx`:**
  - `LineChart` with 30 points renders one `path` per series and an accessible `<title>`/`aria-label` naming the totals;
  - hovering a point shows the day and its counts;
  - `BarList` renders rows in the given order with their numbers.
- [ ] **Step 3: Update `home.test.tsx`:**
  - `'shows the stat cards, the chart and the top lists'`, with mock summary data: "Görüntüleme", "Okuma", "Yayındaki yazılar" and "Bu ay yayınlanan" are visible, and "En çok okunan yazılar" lists the seeded post with a link `#/yazi/<key>`;
  - `'period buttons change the range'`: clicking "7 gün" calls `statsSummary` with a 7-day range;
  - `'empty stats show the collecting notice'`: with `since: '2026-10-25'` and no days, the text "İstatistikler 25 Ekim 2026 itibarıyla toplanıyor" appears, and no chart error is shown;
  - `'planned posts and schedule errors appear in the workspace'`.
- [ ] **Step 4: Run** the three test files. Expected: FAIL.
- [ ] **Step 5: Implement the aggregation, the charts and the new Home layout** in spec §5.10 order:
  1. header with the site status;
  2. period selector (7 gün / 30 gün / 90 gün / Tümü, default 30);
  3. four stat cards (2×2 under 768px);
  4. line chart;
  5. top posts and top pages;
  6. referrers, devices and languages;
  7. link clicks;
  8. workspace (drafts, planned posts, missing items, schedule errors).

  Chart colours come from the palette tokens in both themes. No chart library.
- [ ] **Step 6: Run** `npm test`. Expected: PASS.
- [ ] **Step 7: Check in the browser** (mock backend with demo data, and with empty data), in both themes at desktop width and at 375px. Take screenshots.
- [ ] **Step 8: Commit** with `feat(panel): statistics dashboard on Ana sayfa`.

---

## Self-review notes

- Spec coverage of this plan:
  - §5.5 → Tasks C1–C4
  - §5.9 → Tasks C5 and C6
  - §5.10 → Task C7
  - §4 "planlanmış yazının vaktinden önce görünmesi" → nothing reaches GitHub before the trigger (C3)
  - §4 "takip yok sözünün sessizce bozulması" → privacy constraints and the release gate (C6)
- Decisions the spec left to the builder, made here:
  - the shared `publishDraft`, run in Apps Script through `serverApi` (no pre-built changeset to go stale);
  - Script Properties hour buckets rolled up into monthly Drive JSON (no Sheets scope needed);
  - hand-written SVG charts.
- Risk to watch in C2: the Apps Script V8 runtime must finish the awaited promise chain inside `hourly()`. All I/O there is synchronous, so the chain resolves before the function returns. The smoke test plus one manual run in the Apps Script editor ("Çalıştır › hourly", with a test draft scheduled in the past) confirms it. The manual run needs the owner, because it uses their Google account.
