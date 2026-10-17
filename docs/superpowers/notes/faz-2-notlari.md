# Notes carried from Phase 1 into Phase 2 (admin panel)

Things the Phase 1 reviews deferred. The admin panel that writes these files must handle them.

## Data contracts the panel writes
- `src/data/resources.json` has the shape `{ myNote: Localized, items: Resource[] }`, not a bare array.
- `about.json` `whoAmI` / `whyThisWork` are Markdown. Raw HTML is escaped, and links are allowed only for https:, mailto: and site paths.
- Timeline `period` is `string | { tr, en }`.
- `redirects.json`: `from` and `to` are site-relative lowercase paths with a trailing slash. `from` is not `/`, there are no duplicates and no chains, and a `from` that collides with a live page fails the build. When the panel renames a published post it should add `{ from: old, to: new }`.
- Post `slug` must match `^[a-z0-9]+(-[a-z0-9]+)*$` and be unique per language. `slugify()` can return `''` for all-non-Latin input, so guard against it.

## Parked hardening (do in Phase 2)
- A post slug equal to `kategori` (TR) or `category` (EN) collides with the category base path. Reject it in slug validation.
- `contact.json` `email` is not validated. Validate it as an e-mail address.
- Markdown `SAFE_HREF` accepts `/\host` (browsers treat it as protocol-relative). Tighten it.
- The redirect page is `lang="tr"` only and has no visible fallback text.
- The AuthorBox first-sentence regex breaks on abbreviations ("Uzm. Psk."). Consider an explicit short-intro field.
- Sitemap hreflang codes (`tr-TR`/`en-US`) differ from the HTML codes (`tr`/`en`). Both are valid, but aligning them is cleaner.
- Empty category pages are indexable. Consider `noindex` while a category is empty.
- The profile photo is served from `public/` without resizing. The panel's upload should resize it and convert it to WebP.

## Launch gate
`npm run check:launch` runs in CI before the production build and blocks the deploy while placeholders remain.
