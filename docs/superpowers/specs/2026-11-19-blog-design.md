# Blog — Design Spec

**Date:** 2026-11-19 (rev. 2, after senior review)
**Status:** Draft, awaiting owner review

## Goal

Add an SEO-focused blog to lidr.io that anyone on the team can publish to,
regardless of technical experience, without touching Git. **One person can
take a post from start to live with no review or approval step.** Team members
using Claude (chat or Claude Code) must be able to produce and publish posts in
the same format.

## Constraints

- Site is Next.js 16 with `output: "export"` and `trailingSlash: true`,
  deployed by Cloudflare Pages from the public GitHub repo
  `lidradmin/lidr.io`, production branch **`main`** (renamed from
  `rebuild`; see §13). No runtime server, so every blog page is generated at
  build time.
- Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/`
  before writing any Next.js code.
- Everything runs on free tiers.
- Must not break the existing visual, a11y and Lighthouse gates.

## Decisions (owner-approved)

| Topic | Decision |
|---|---|
| Authoring | Browser CMS at `lidr.io/admin/`: **Decap CMS** (Git-backed). |
| Content location | **Separate public repo `lidradmin/lidr-blog`.** Authors have Write access to that repo only, never to the site code. |
| Publishing | No review. Publish commits to `lidr-blog` `main` → deploy hook → Cloudflare builds the site → live in about 2–3 min. |
| Accounts | One free GitHub account per author; the shared `lidradmin` account is not used by authors. |
| Scope v1 | Core SEO, tags, auto OG images. No author pages. |
| Navigation | "Blog" link in the footer only. |
| Claude | Claude Code skill in the content repo (write → check → publish end to end) + Claude.ai Project instructions. |
| Safety | Automated guards (§8) replace human review: a bad post can never break the site or remove an already-live page, and the author is always told about problems. |

## Architecture

```
             lidradmin/lidr-blog (content repo, public)
Author ──► lidr.io/admin (Decap CMS)
             │ login: Cloudflare Worker + GitHub App installed ONLY on lidr-blog
             ▼ Publish
        commit to lidr-blog main  (posts/*.md, images/<slug>/*, tags.yml)
             │
             ├─► Action "publish": POST Cloudflare deploy hook
             └─► Action "check": runs site validator against content
                   problem → Issue assigned to author (+ owner), email sent
                                   │
             lidradmin/lidr.io (site repo, public; authors have no access)
Cloudflare Pages build (main):
  prebuild: fetch lidr-blog tarball → validate → optimise images
            → generate admin config, _redirects
  next build → static out/ → lidr.io
```

Separating the repos means:
- A compromised or confused author account can only affect blog content.
- The site repo has no outside writers, so branch protection on `main` is
  available again (optional for the owner).
- Generated images never enter the site repo's history.

## 1. Content repo layout (`lidradmin/lidr-blog`)

```
posts/<slug>.md
images/<slug>/<file>.(jpg|png|webp)
tags.yml
.github/workflows/publish.yml   # deploy hook
.github/workflows/check.yml     # validation + notify
.claude/skills/new-blog-post/   # Claude Code skill (§10)
scripts/check.sh                # local check (used by the skill)
README.md                       # links to the authoring guide
```

## 2. Content model and validation

**One source of truth:** `lib/blog/rules.ts` in the site repo defines every
field and its limits once. From it:
- the zod schema used by the build and `blog:check`;
- `public/admin/config.yml`, generated at prebuild (gitignored, never
  hand-edited);
- a unit test asserting both agree.

| Field | Type | Rules | Level |
|---|---|---|---|
| `title` | string | required; 10–70 chars | hard if missing / soft if length off |
| `description` | string | required; 50–160 chars | soft (falls back to the first 155 chars of body) |
| `date` | date `YYYY-MM-DD` (no time) | required | hard |
| `updated` | date `YYYY-MM-DD` | optional; ≥ `date` | soft |
| `tags` | string[] | 1–3; must exist in `tags.yml` | soft (unknown tags dropped) |
| `cover` | image path | optional | soft (missing file → no cover) |
| `coverAlt` | string | required when `cover` set | soft (falls back to title) |
| `draft` | boolean | default `false` | draft = not built |
| `redirectTo` | path | optional; post is unpublished and 301s here | n/a |
| `canonical` | URL | optional; **not exposed in the CMS** (Claude Code/devs only) | soft |

The slug is the filename: lowercase, hyphenated, ASCII, generated from the
title at creation. **Slugs are permanent.** The CMS never renames files.

**Two levels of problem.** With no review, a live, ranking page must never
disappear because of a mistake:
- **Hard** (unparseable front-matter, missing title or body, invalid date):
  the post is skipped. If the post was previously live, the build keeps the
  URL alive by rendering the last good version from the content repo's
  history (`git show` of the last commit whose version passed; the prebuild
  does a full clone, see §3). If none exists, the post is not built.
- **Soft** (everything else): the post publishes with the fallback shown,
  and a warning is reported to the author (§8).
- `BLOG_STRICT=1` (tests, the Claude Code skill) turns all problems into
  errors.

**Unpublishing:** set `draft: true` (URL returns 404), or set `redirectTo`
(URL 301s to the target via generated `_redirects`). Authors are told not to
delete posts. A deleted file behaves like `draft: true`.

**Tags:** `tags.yml` lists `slug`, `name` and `description` (intro for the
tag page), editable in the CMS as a file collection. Deleting a tag never
removes posts: the tag is dropped from those posts with a soft warning, and
the tag page 404s.

## 3. Build pipeline (site repo)

`npm run prebuild` (`scripts/blog/prepare.mjs`), run automatically before
`next build`:

1. **Fetch content.** `git clone --filter=blob:none https://github.com/lidradmin/lidr-blog`
   into `.blog-content/` (gitignored). The full history is needed for the
   last-good fallback. `BLOG_CONTENT_DIR` overrides the location (local
   checkout, or `tests/fixtures/blog` for tests). **If the fetch fails, the
   build fails**, so Cloudflare keeps the last good deployment. Never deploy
   an empty blog.
2. **Validate** all posts (§2). Write `.blog-content/report.json`.
3. **Optimise images** with `sharp` (already a dependency): accept
   jpg/png/webp/**heic**, auto-rotate, strip EXIF and GPS (site photos can
   leak locations), output WebP at 480/960/1600w plus a 1600w JPEG fallback
   into `public/images/blog/<slug>/` (gitignored). Record intrinsic
   width/height. Cache by content hash in `node_modules/.cache/blog-images`
   (persisted by Cloudflare's build cache) to keep builds fast.
4. **Generate** `public/admin/config.yml` from `rules.ts`, and
   `public/_redirects` = the committed base file + `redirectTo` entries.
5. **OG images** (§6).

`lib/blog/posts.ts` (server-only, reads the prepared content):
- `getAllPosts()`: valid, non-draft, sorted newest first.
- `getPost(slug)`: unified pipeline `remark-parse` → `remark-gfm` →
  `remark-rehype` → **`rehype-sanitize`** (default schema; blocks raw HTML
  and `javascript:`/`data:` URLs) → `rehype-slug` →
  `rehype-autolink-headings` → `rehype-stringify`.
- Images → `<img srcset sizes width height loading="lazy" decoding="async">`
  (the first body image is not lazy). External links get
  `rel="noopener noreferrer"`.
- Reading time: words / 200 wpm, rounded up. Related posts: up to 3, by shared
  tags, then date.

## 4. Routes

| Route | File | Notes |
|---|---|---|
| `/blog/` | `app/blog/page.tsx` | 1 featured + 9 posts |
| `/blog/page/<n>/` | `app/blog/page/[n]/page.tsx` | n ≥ 2, 9 per page |
| `/blog/<slug>/` | `app/blog/[slug]/page.tsx` | Post |
| `/blog/tag/<tag>/` | `app/blog/tag/[tag]/page.tsx` | Unpaginated in v1 |
| `/blog/rss.xml` | `app/blog/rss.xml/route.ts` | `dynamic = "force-static"` |
| `/admin/` | `public/admin/index.html` + generated `config.yml` | Decap CMS |

All dynamic routes: `generateStaticParams()` + `dynamicParams = false`.

**Empty params:** if a route has no params (zero posts, one page, no
tags), `generateStaticParams` returns a single reserved placeholder
(`__empty`) whose page calls `notFound()`, and the prebuild deletes the
emitted `__empty` output. This avoids the static-export "missing
generateStaticParams" error. Verify-first (§12): if Next 16.2 accepts `[]`
under export, drop the placeholder.

## 5. SEO

- `generateMetadata`: title (root `%s | Lidr.io` template), description,
  `alternates.canonical`, OpenGraph `article` (`publishedTime`,
  `modifiedTime`, `tags`, image), Twitter `summary_large_image`.
- JSON-LD: `BlogPosting` (headline, description, image, datePublished,
  dateModified, **author → the existing Organization**, publisher →
  Organization, mainEntityOfPage) + `BreadcrumbList`.
- Sitemap: `/blog/`, posts (`lastModified = updated ?? date`), tag pages with
  posts. Pagination pages excluded. Existing entries unchanged.
- RSS `<link rel="alternate">` on blog pages. Pagination pages self-canonical.
- `updated` reminder: the check warns when a live post's body changed but
  `updated` didn't.

## 6. Auto OG images

1200×630 PNG per post: `--color-brand` background, title in Amenti white
(auto-sized, max 3 lines), yellow bar, Lidr logo bottom-left, first tag
bottom-right. The cover is used instead when present.

Generated in prebuild with `satori` + `sharp` into
`public/images/blog/og/<slug>.png` (gitignored, cached by title hash). This is
deterministic under static export, and it avoids the unverified
`opengraph-image` + dynamic-segment + `trailingSlash` combination entirely.

## 7. UI

(Unchanged from rev. 1.) Existing tokens only: Amenti/Montserrat,
`--color-heading`, `--shadow-card`, `--radius-lg/xl`, `Button`,
`AppStoreBadges`, `DownloadCta`. Single accent: hi-vis `--color-accent`
(#f2e32b) used only for a 4×64px bar under post H1s and the active tag chip.
No added motion. Blog pages don't mount `RevealManager`. Visible focus rings.

### `/blog/` and `/blog/page/<n>/`
```
 Blog (h1)
 Guides for site teams on photo records and reporting.   ← --text-lg, muted
 [All] [Site photos] [Reporting] [Safety]                ← tag chips
 ┌───────────────────┬────────────────────────┐
 │ cover 16:10       │ Title (h2)             │          ← featured, page 1 only
 │                   │ description            │            stacks on mobile
 │                   │ 12 Nov 2026 · 5 min    │
 └───────────────────┴────────────────────────┘
 ┌────────┐ ┌────────┐ ┌────────┐                       ← 3 / 2 / 1 cols
 │ cover  │ │ cover  │ │ cover  │                         (≥1024 / ≥640 / <640)
 │ title  │ │ title  │ │ title  │
 │ date   │ │ date   │ │ date   │
 └────────┘ └────────┘ └────────┘
        ‹ Newer posts    Page 2 of 4    Older posts ›
 <DownloadCta />
```
- Cards: white, `--radius-xl`, `--shadow-card`, title underline on hover.
  No cover → brand-green block with the title in Amenti (matches OG).
- Empty state: "No posts yet. Check back soon." + `<DownloadCta />`. The
  footer link is hidden when there are zero posts.

### `/blog/<slug>/`
```
 Blog / Site photos                    ← breadcrumb
 Title (h1)
 ▔▔▔▔ yellow bar
 12 Nov 2026 · Updated 18 Nov · 6 min read · [tags]
 [cover 16:9, --radius-xl]             ← omitted if none
 Body at 728px measure
 [App CTA card: --color-slate, "Try Lidr on your next site", badges]
 More on <first tag>: 3 related cards
```
- Prose: extract `.content` rules from `LegalLayout.module.css` into
  `components/Prose/Prose.module.css` (used by legal + blog) and add `img`,
  `figcaption`, `blockquote`, `table` (scroll wrapper), `code`/`pre`, `hr`.
  Legal pages must stay pixel-identical (visual gate).
- Dates `12 Nov 2026` (en-GB), formatted from the date-only string (no
  timezone conversion).

### `/blog/tag/<tag>/`
Index layout without the featured post. H1 is the tag name, with the tag
description as the intro.

### Footer
"Blog" added to the footer Quick Links only, via a footer-specific list so
`NAV_ITEMS` and the header are unchanged. The link has `data-blog-link`
(§9).

## 8. Automated guards (replace human review)

1. **Editor:** generated field rules (§2) and a media library config of
   `max_file_size: 15MB` with the hint "Photos straight from your phone are
   fine". Problems are shown before Publish.
2. **Build:** soft problems publish with fallbacks. Hard problems keep the
   last good version live. A fetch or other failure leaves the previous
   deployment live.
3. **Author is told.** `lidr-blog/.github/workflows/check.yml`, on push to
   `main` and on PRs:
   - GitHub-hosted runner (`ubuntu-latest`); free on public repos. Never
     self-hosted.
   - Checks out `lidradmin/lidr.io` (public, read-only), `npm ci` (cached),
     runs `BLOG_CONTENT_DIR=$GITHUB_WORKSPACE/content npm run blog:check`
     over **all** posts.
   - Report includes: hard/soft problems, duplicate titles, broken internal
     links, `updated` reminder.
   - Any problem → open (or update) one GitHub Issue per post, **assigned to
     the commit author and @-mentioning the owner**, written in plain
     English with the fix ("Your post 'Site photo tips' is live, but its
     description is 182 characters. Google will cut it off. Open it in
     lidr.io/admin, shorten it to 160 and Publish."). The Issue closes
     automatically when a later check passes.
4. **Deploy:** `lidr-blog/.github/workflows/publish.yml` on push to `main`
   → `curl -X POST $CF_DEPLOY_HOOK`. It runs independently of the check, so a
   flaky check never blocks publishing. Secret `CF_DEPLOY_HOOK` is stored in
   the content repo. Fork PRs never receive secrets. Worst case if leaked:
   extra builds, revocable in Cloudflare.
5. **Site repo CI** (`lidr.io/.github/workflows/blog-content.yml`, hosted
   runner): on site PRs touching `lib/blog/**` or `scripts/blog/**`, runs
   `blog:check` against live content, so a schema change can't silently
   downgrade existing posts.

**Accepted trade-off:** no human reads content before it goes live.

## 9. Security

- **Blast radius:** authors are collaborators on `lidr-blog` only.
- **CMS auth:** Cloudflare Worker based on `sveltia-cms-auth`, using a
  **GitHub App installed only on `lidr-blog`** (Contents RW, Metadata R).
  App user tokens can only touch repos the app is installed on. A classic
  OAuth App would need `public_repo` scope, which grants write to *every*
  public repo the user can access, so it is rejected. Worker
  `ALLOWED_DOMAINS=lidr.io`. Tokens expire after 8h; the author logs in
  again and Decap's local backup keeps unsaved work.
- **`/admin/` hardening** (`public/_headers`): strict CSP for `/admin/*`
  (`script-src` self + pinned jsDelivr; `connect-src` api.github.com,
  the Worker origin; `img-src` self, data, blob,
  raw.githubusercontent.com), `X-Robots-Tag: noindex`,
  `X-Frame-Options: DENY`. Decap script pinned to an exact version with an
  SRI `integrity` hash. `robots.ts` disallows `/admin/`.
- **Rendering:** `rehype-sanitize` on all Markdown, both in the build and in
  the CMS preview template.
- **Images:** EXIF/GPS is stripped from the *published* images (§3), but
  originals uploaded through Decap sit in the public `lidr-blog` history with
  their GPS data. Mitigation: the check flags any image with GPS EXIF as a
  soft problem ("this photo contains its location"), and the author guide
  says to remove location before uploading. Preferred fix if verified:
  Sveltia CMS (config-compatible with Decap) re-encodes images in the browser
  before upload via its media-library `transformations` option, which drops
  EXIF at the source. See §12.
- **Site repo:** no self-hosted runners attached. Actions → fork PR
  workflows require approval.

## 10. Claude support

- **Claude Code skill** in `lidr-blog/.claude/skills/new-blog-post/`. Authors
  clone only the content repo. Steps:
  1. Fresh state: `git fetch` → work in a new worktree from `origin/main`.
     Refuse if anything outside `posts/`, `images/`, `tags.yml` would be
     staged.
  2. Read existing posts and tags; pick a topic and target keyword not
     already covered.
  3. Draft to the schema, with 2+ internal links (`/features/`, `/pricing/`,
     related posts) and alt text on every image.
  4. Self-review: no invented statistics, quotes or customer names; claims
     about Lidr match the live `/features/` and `/pricing/` pages.
  5. `scripts/check.sh` (sparse-clones the site repo into `~/.cache/lidr-site`,
     `npm ci`, runs `blog:check` with `BLOG_STRICT=1`). Must pass.
  6. Commit `Publish blog post “<title>”` → push. If the push is rejected,
     `git pull --rebase` and retry once, then report.
  7. Report the live URL and say it's live in about 3 minutes.
- **Claude.ai Project instructions:** `lidr-blog/docs/claude-instructions.md`
  (voice, audience of construction site teams, structure, SEO rules; output =
  body Markdown + a block of title/description/tags to paste into the CMS).
- Both include the author checklist: facts checked, real Lidr specifics, no
  invented stats or quotes.

## 11. Tests (site repo)

All test builds use `BLOG_CONTENT_DIR=tests/fixtures/blog`, never live
content.
- **Visual gate:** blog pages not added to `tests/visual/enabled-pages.ts`.
  `tests/visual/visual.spec.ts` adds `[data-blog-link] { display: none !important; }`
  to its existing `addStyleTag` injection, with a comment explaining that the
  link is post-WordPress and hidden so references stay valid. Existing pages
  must stay under 1%.
- **a11y:** `/blog/`, a post, a tag page.
- **Functional:** one h1, canonical, valid BlogPosting JSON-LD, og:image
  exists, in sitemap. Drafts and `redirectTo` posts absent, and the redirect
  is present in `_redirects`. RSS parses. No `__empty` output.
- **Unit:** rules ↔ zod ↔ generated CMS config parity; hard vs soft
  classification; tag deletion drops tags without removing posts;
  last-good fallback; sanitizer strips `javascript:` links; related posts;
  reading time; HEIC → WebP with EXIF stripped.
- **Lighthouse CI:** `/blog/` and a fixture post at existing thresholds.

## 12. Risks and verify-first items

1. Whether `generateStaticParams` may return `[]` under export in 16.2
   (§4). The placeholder fallback is ready.
2. `rss.xml` route output path with `trailingSlash: true`.
3. `sveltia-cms-auth` works with Decap's GitHub backend. If not, write a
   minimal Worker in `workers/cms-auth/`.
4. What Decap does on a duplicate slug (error vs overwrite). If overwrite,
   add `{{year}}-{{slug}}` collision handling in the CMS slug template.
5. `sharp` HEIC decoding on Cloudflare's build image (libheif). Fallback:
   reject HEIC in the CMS with a hint to export as JPEG.
6. Cloudflare build cache persists `node_modules/.cache`.
7. The prose extraction must not move legal-page pixels.
8. Whether Sveltia's upload `transformations` strip EXIF reliably. If yes,
   switch from Decap to Sveltia (same config file) for this reason alone.
9. No human review: a wrong or off-brand post can go live. Accepted.

## 13. One-time setup (owner)

1. **Rename `rebuild` → `main`** (as `lidradmin`: GitHub → repo → Settings →
   General → Default branch → rename). Then immediately set the Cloudflare
   Pages production branch to `main`. The live site keeps serving the last
   deployment in between.
2. Create public repo `lidradmin/lidr-blog` (the implementation provides
   its initial contents).
3. Create the GitHub App (Contents RW, Metadata R) and install it **only**
   on `lidr-blog`. Deploy the auth Worker with its secrets.
4. Cloudflare Pages → create a deploy hook for `main` → add it as
   `CF_DEPLOY_HOOK` secret in `lidr-blog`.
5. Invite authors to `lidr-blog` (Write). Turn on fork-PR workflow approval
   in both repos.
6. Google Search Console: verify lidr.io and submit `/sitemap.xml`.
7. Optional: Cloudflare "Pages deployment failed" email notification;
   branch protection on `lidr.io` `main`.

## Costs

All free: Decap (OSS), GitHub (free accounts, Actions unlimited on public
repos), Cloudflare Workers free tier, Cloudflare Pages (1 build per Publish,
well under 500/month).

## Out of scope (v1)

Author pages, comments, search, scheduled publishing, newsletter, i18n,
editorial review, deploy previews, tag-page pagination, email-based login.
