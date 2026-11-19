# Blog — Design Spec

**Date:** 2026-11-19
**Branch:** `rebuild`
**Status:** Draft, awaiting owner review

## Goal

Add an SEO-focused blog to lidr.io that anyone on the team can publish to,
regardless of technical experience, without touching Git. **One person can
take a post from start to live with no review or approval step.** Team members
using Claude (chat or Claude Code) must be able to produce and publish posts in
the same format.

## Constraints

- Site is Next.js 16 with `output: "export"` (static), deployed by Cloudflare
  Pages from GitHub `lidradmin/lidr.io` (public repo, owner's choice). No runtime server, so
  every blog page is generated at build time. All routes need
  `generateStaticParams()` with `dynamicParams = false`.
- Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/`
  before writing any Next.js code.
- Everything must run on free tiers (see Costs).
- Must not break the existing visual, a11y and Lighthouse gates.

## Decisions (owner-approved)

| Topic | Decision |
|---|---|
| Authoring | Git-backed browser CMS at `/admin/`: **Decap CMS** (multi-maintainer, mature). Sveltia CMS is config-compatible and can be swapped in later. |
| Publishing | **No review.** Decap "simple" publish mode: Publish commits straight to `main` → Cloudflare builds → live in about 2 min. Authors check the post in the CMS live preview pane before publishing. |
| Accounts | Each author gets their own free GitHub account, added as a repo collaborator with **Write** access. The shared `lidradmin` account is **not** used by authors. |
| Scope v1 | Core SEO, tags, auto OG images. No author pages. |
| Navigation | "Blog" link in the **footer only**. The header is unchanged. |
| Claude | Repo skill for Claude Code (writes, self-checks and publishes end to end) + versioned instructions file for a Claude.ai Project. |
| Safety | No human gate, so the automated guards (§8) must ensure a bad post can never break the site, and that the author is told when their post didn't go live. |

## Architecture

```
Author ──► lidr.io/admin (Decap CMS, static)
             │ GitHub login via Cloudflare Worker (OAuth proxy)
             │ writes with live preview pane (site styles), field validation
             ▼ clicks Publish
        GitHub API: commit to main (content/blog/<slug>.md + images)
             │
             ├─► Cloudflare Pages production build ──► lidr.io/blog/<slug>/
             │     invalid post → skipped with warning; rest of site deploys
             └─► GitHub Action "blog-check" (hosted runner, free)
                   problem found → comments on the commit (@author notified
                   by email) with a plain-English fix
```

Claude Code users skip the CMS. The skill writes the same Markdown file,
runs the checks locally, commits to `main` and pushes. Same pipeline from
there.

## 1. Content model

**Post file:** `content/blog/<slug>.md`
**Images:** `public/images/blog/<slug>/…` (Decap `media_folder` /
`public_folder` set per entry), served as `/images/blog/<slug>/…`.

Front-matter, validated at build time with zod (`lib/blog/schema.ts`):

| Field | Type | Rules |
|---|---|---|
| `title` | string | required, 10–70 chars |
| `description` | string | required, 50–160 chars (meta description) |
| `date` | ISO date | required |
| `updated` | ISO date | optional, ≥ `date` |
| `tags` | string[] | required, 1–3, must exist in `content/blog/tags.yml` |
| `cover` | string | optional, image path |
| `coverAlt` | string | required if `cover` is set |
| `draft` | boolean | default `false`; drafts are committed but excluded from build output (each draft save costs one Cloudflare build) |
| `canonical` | URL | optional override |

The slug is the filename. Lowercase, hyphenated, ASCII; the CMS generates it
from the title.

**Tags:** `content/blog/tags.yml` lists `slug`, `name` and `description` (the
intro for each tag page). It is editable in the CMS as a "Tags" file
collection, so authors pick from a fixed list. This prevents duplicates such as
"site photos" and "site-photos".

**Validation failure never fails the production build.** With no review
step, one bad post must not block other posts or site changes. An invalid post
is **skipped** (not rendered, not in sitemap or RSS) and a readable warning is
logged naming the file and field (e.g. `content/blog/foo.md: description must
be ≤160 chars (is 182)`). With `BLOG_STRICT=1` (used by the blog-check Action,
the Claude Code skill and tests), the same problems are errors and the build
fails.

## 2. Rendering pipeline

`lib/blog/posts.ts` (server-only, build-time):
- `getAllPosts()`: reads `content/blog/*.md` with `gray-matter`, validates,
  filters drafts, sorts newest first.
- `getPost(slug)`: renders Markdown → HTML with unified: `remark-parse`,
  `remark-gfm`, `remark-rehype`, `rehype-slug`, `rehype-autolink-headings`,
  `rehype-stringify`. Raw HTML in Markdown is **not** allowed (no
  `allowDangerousHtml`).
- Reading time is word count / 200 wpm, rounded up.
- Related posts: up to 3, ranked by number of shared tags, then by date.
- External links get `rel="noopener"`. Images get `loading="lazy"` and their
  width/height when known (computed with `sharp` at build).

## 3. Routes

| Route | File | Notes |
|---|---|---|
| `/blog/` | `app/blog/page.tsx` | Page 1 of index |
| `/blog/page/<n>/` | `app/blog/page/[n]/page.tsx` | Pagination, 9 posts per page; page 1 not duplicated here |
| `/blog/<slug>/` | `app/blog/[slug]/page.tsx` | Post |
| `/blog/tag/<tag>/` | `app/blog/tag/[tag]/page.tsx` | Tag listing (unpaginated in v1) |
| `/blog/rss.xml` | `app/blog/rss.xml/route.ts` | Static route handler (`dynamic = "force-static"`) |
| OG images | `app/blog/[slug]/opengraph-image.tsx` | See §6 |
| `/admin/` | `public/admin/index.html` + `public/admin/config.yml` | Decap CMS |

`trailingSlash: true` stays. `/admin/` gets `noindex` via `public/_headers`
(`X-Robots-Tag: noindex`) and a `Disallow: /admin/` line in `app/robots.ts`.

## 4. SEO

- **Metadata** (`generateMetadata`): title (uses the root `%s | Lidr.io`
  template), description, `alternates.canonical`, OpenGraph
  (`type: "article"`, `publishedTime`, `modifiedTime`, `tags`), Twitter
  `summary_large_image`.
- **JSON-LD** on posts: `BlogPosting` (headline, description, image,
  datePublished, dateModified, publisher → existing Organization,
  mainEntityOfPage), plus `BreadcrumbList` (Blog → Tag → Post).
- **Sitemap**: `app/sitemap.ts` appends `/blog/`, each post (`lastModified` =
  `updated ?? date`), and each tag page that has posts. Existing entries are
  unchanged.
- **RSS**: `<link rel="alternate" type="application/rss+xml">` added on blog
  pages.
- Tag pages with zero published posts are not generated.
- Pagination pages have self-canonicals.

## 5. UI

Reuses existing tokens only (`styles/tokens.css`): Amenti headings in
`--color-heading` (#192c27), Montserrat body, `--shadow-card`,
`--radius-lg/xl`, existing `Button`, `AppStoreBadges`, `DownloadCta`. **No new
colours or fonts.**

**Single accent:** hi-vis yellow `--color-accent` (#f2e32b), a nod to
construction. It is used only for (a) a 4px × 64px bar under each post H1
and (b) the active tag chip background. Nowhere else.

**Motion:** none added. Blog pages do not mount `RevealManager`, so text is
visible on first paint. The only hover feedback is a title underline on cards.
Visible focus rings everywhere. `prefers-reduced-motion` is unaffected
because there is no motion.

### `/blog/` and `/blog/page/<n>/`
```
 Blog (h1)
 Guides for site teams on photo records and reporting.   ← --text-lg, --color-text-muted
 [All] [Site photos] [Reporting] [Safety]                ← tag chips, pill radius
 ┌───────────────────┬────────────────────────┐
 │ cover 16:10       │ Title (h2)             │          ← latest post, page 1 only
 │                   │ description            │            stacks on mobile
 │                   │ 12 Nov 2026 · 5 min    │
 └───────────────────┴────────────────────────┘
 ┌────────┐ ┌────────┐ ┌────────┐                       ← 3 / 2 / 1 columns
 │ cover  │ │ cover  │ │ cover  │                         (≥1024 / ≥640 / <640)
 │ title  │ │ title  │ │ title  │
 │ date   │ │ date   │ │ date   │
 └────────┘ └────────┘ └────────┘
        ‹ Newer posts    Page 2 of 4    Older posts ›
 <DownloadCta />
```
- Container: existing `--container-width` / `--container-max`.
- Cards: white, `--radius-xl`, `--shadow-card`. No cover → brand-green block
  showing the title in Amenti (same look as the OG image).
- **Empty state** (zero posts): "No posts yet. Check back soon." plus
  `<DownloadCta />`. The footer link is hidden when there are zero posts.

### `/blog/<slug>/`
```
 Blog / Site photos                    ← breadcrumb, --text-md
 Title (h1, Amenti, --text-h1)
 ▔▔▔▔ yellow bar
 12 Nov 2026 · Updated 18 Nov · 6 min read · [tag chips]
 ┌────────────────────────────┐
 │ cover 16:9, --radius-xl    │        ← omitted if no cover
 └────────────────────────────┘
 Body at 728px measure
 ┌────────────────────────────┐
 │ App CTA card               │        ← --color-slate bg, white text,
 │ "Try Lidr on your next     │          <AppStoreBadges />; after body
 │  site" + badges            │
 └────────────────────────────┘
 More on <first tag>: 3 related cards
```
- Body typography: extract the `.content` rules from
  `LegalLayout.module.css` into a shared `components/Prose/Prose.module.css`
  used by both legal and blog. Add styles for `img` (radius-lg, full
  measure), `figcaption`, `blockquote` (4px brand-green left rule),
  `table` (gray-200 borders, horizontal scroll wrapper on mobile), inline
  `code`/`pre` (gray-100 bg), `hr`. The legal pages must render identically
  after the extraction (verified by the visual gate).
- Date format: `12 Nov 2026` (en-GB).

### `/blog/tag/<tag>/`
Same as the index, minus the featured post. H1 is the tag name, with the tag
`description` as the intro paragraph.

### Footer
Add a "Blog" item to the footer Quick Links only, rendered from a new
`FOOTER_EXTRA_ITEMS` (or equivalent) so `NAV_ITEMS`, and therefore the header,
are unchanged. The link has `data-blog-link` for the visual test (see §9).

## 6. Auto OG images

1200×630 PNG per post: `--color-brand` background, title in Amenti white
(auto-sized, max 3 lines), yellow bar under the title, Lidr logo
bottom-left, first tag name bottom-right. A post with a `cover` uses the cover
as `og:image` instead.

**Verify first:** whether `opengraph-image.tsx` plus `generateStaticParams`
emits static PNGs under `output: "export"` in Next 16.2. If not, fall back to a
`prebuild` script that renders the same layout with `satori` + `sharp` into
`public/images/blog/og/<slug>.png`. In both cases the Amenti font file is
loaded from `app/fonts/`.

## 7. CMS (`/admin/`)

- `public/admin/index.html` loads Decap CMS 3.x from jsDelivr, pinned to an
  exact version (no `^`), with `<meta name="robots" content="noindex">`.
- `public/admin/config.yml`:
  - `backend: { name: github, repo: lidradmin/lidr.io, branch: main, base_url: <worker URL> }`
  - **No `publish_mode`** (simple mode): Publish commits directly to
    `main`. Unpublished work is kept in the browser by Decap's local backup
    until published.
  - `site_url: https://lidr.io`, `logo_url` set to the Lidr logo.
  - Collection `blog`: folder `content/blog`, `create: true`,
    `slug: "{{slug}}"`, fields mirroring §1 with `required`, `pattern` and
    `hint` so the editor blocks Publish until the post is valid
    ("Shown in Google results. 50–160 characters."). `tags` is a `relation`
    widget to the tags file. `coverAlt` is required in the editor whenever a
    cover is set. Image widgets require alt text.
  - `media_folder: /public/images/blog/{{slug}}`, `public_folder: /images/blog/{{slug}}`.
  - File collection `tags` → `content/blog/tags.yml`.
  - `preview_path: blog/{{slug}}` gives a "View live" link after publishing.
- **Preview pane:** `CMS.registerPreviewStyle` with a small CSS file
  (fonts + prose styles + post header) and a custom preview template showing
  the title, yellow bar, meta line and cover, so what the author sees closely
  matches the live page. This is the author's only pre-publish check, so it
  must be accurate.
- **Commit messages:** `Publish blog post “{{title}}”` /
  `Update blog post “{{title}}”` (Decap `commit_messages`), so history reads
  cleanly.

### Build budget
Cloudflare Pages Free allows 500 builds/month. In simple mode only Publish
(and saving a `draft: true` post) writes to the repo, and each write costs
one build. Editing in the CMS before Publish costs nothing. Expected use is
well under 100 builds/month.

### OAuth Worker
A Cloudflare Worker at e.g. `cms-auth.lidr.io`, based on `sveltia-cms-auth`
(GitHub App; Contents RW, Metadata R).
**Verify first** that it works with Decap's GitHub backend. If not, write a
minimal Decap-compatible OAuth proxy Worker (`/auth`, `/callback`,
`postMessage` handshake) in `workers/cms-auth/`. Secrets
(`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) live only in Worker env vars.

## 8. Automated guards (replace human review)

**Layer 1: the editor.** Decap field validation (§7) stops most mistakes
before Publish is possible: missing description, too-long title, no tags,
missing alt text.

**Layer 2: the build never breaks.** Invalid posts are skipped, not fatal
(§1). Cloudflare keeps serving the last good deployment if a build fails for
any other reason.

**Layer 3: the author is told.** `.github/workflows/blog-check.yml`:
- Runner: **GitHub-hosted** (`runs-on: ubuntu-latest`). Never the owner's
  self-hosted runners. Free and unlimited on public repos.
- Trigger: `push` to `main` with paths `content/blog/**`,
  `public/images/blog/**`. Also `pull_request` on the same paths for anyone
  who prefers PRs.
- Steps: `npm ci` → `BLOG_STRICT=1` validation of changed posts (a fast
  script `npm run blog:check`, no full build) → content lint: every image
  has alt text, no broken internal links, cover images under 500 KB (warn
  above 300 KB), no duplicate title or slug.
- On failure: comment on the commit with a plain-English explanation and
  fix, @-mentioning the commit author, which GitHub emails them. Example:
  "Your post 'Site photo tips' isn't live yet: the description is 182
  characters; the limit is 160. Open it in lidr.io/admin, shorten it, and
  Publish again."
- No secrets are used, and fork PRs run with read-only tokens.

**Optional:** Cloudflare Notifications (free), "Pages deployment failed", sent
by email to the owner.

**Repo settings (public repo):** confirm no self-hosted runner is
registered to this repo. Set Actions → "Fork pull request workflows" →
"Require approval for all external contributors". No branch protection on
`main`, because the CMS must be able to commit to it directly.

**Accepted trade-off:** no human reviews content before it goes live.
Quality depends on the authors, the Claude skill's self-check (§10) and the
guards above.

## 9. Tests

- **Visual gate (pixel diff vs WordPress references):** blog pages are
  **not** added to `tests/visual/enabled-pages.ts` (no WordPress reference
  exists). The footer "Blog" link would change every page's footer, so
  `tests/visual/visual.spec.ts` adds a rule to its existing `addStyleTag`
  injection: `[data-blog-link] { display: none !important; }`. It also gets
  a comment explaining that the blog link is post-WordPress and is hidden so
  the reference screenshots stay valid. All existing pages must still pass
  under 1%.
- **a11y** (`tests/a11y.spec.ts`): add `/blog/`, one post, one tag page,
  using a committed fixture post (`content/blog/_fixtures/` is excluded from
  production unless `BLOG_FIXTURES=1`; tests build with it set).
- **Functional:** post page has exactly one h1, a canonical, BlogPosting
  JSON-LD that parses, an og:image, and is in the sitemap. Drafts are absent
  from the sitemap and output. RSS validates as XML.
- **Unit:** schema accepts and rejects the expected cases; related-posts
  ranking; reading time.
- **Resilience:** a fixture with an invalid post builds successfully without
  `BLOG_STRICT` (post skipped, warning logged) and fails with
  `BLOG_STRICT=1`; `npm run blog:check` reports the same error.
- **Lighthouse CI:** add `/blog/` and the fixture post to `lighthouserc.js`
  at the existing thresholds.

## 10. Claude support

- **Claude Code skill:** `.claude/skills/new-blog-post/SKILL.md`. Steps:
  check existing posts and tags to avoid duplicate topics or keywords →
  draft to the §1 schema → include 2+ internal links (`/features/`,
  `/pricing/`, related posts) → alt text on every image → run `npm run build`
  → **self-review pass** (no invented statistics, quotes or customer names;
  claims about Lidr match `/features/` and `/pricing/`; no duplicate
  of an existing post's target keyword) → `npm run blog:check` with
  `BLOG_STRICT=1` and `npm run build` → commit to `main` with the standard
  message → push → report the live URL (after ~2 min).
- **Claude.ai Project instructions:** `docs/blog-claude-instructions.md`
  (voice, audience of construction site teams, structure, SEO rules, output
  format = body Markdown plus a separate block listing title, description and
  tags to paste into CMS fields).
- Both include a short **author checklist** shown before publishing: facts
  checked, real Lidr specifics added (screenshots, examples), no invented
  stats or quotes.

## 11. Team docs

`docs/blog-authoring.md`: one page with screenshots. Covers the one-time
GitHub signup and invite, writing a post, adding images, using the preview
pane, publishing, editing or unpublishing a live post, and what to do if you
get a "your post isn't live yet" email.

## 12. One-time setup (owner)

1. Create the GitHub App for CMS login and note the client ID and secret.
2. Deploy the auth Worker and set its secrets. Optional custom domain
   `cms-auth.lidr.io`.
3. Add authors as collaborators (Write).
4. Actions settings: require approval for fork PR workflows. Confirm no
   self-hosted runner is attached to this repo (§8).
5. Optional: Cloudflare "Pages deployment failed" email notification.

## Costs

All free:
- **Decap CMS:** open source.
- **GitHub:** free accounts. Hosted Actions are free and unlimited on public
  repos.
- **Cloudflare Workers:** free tier (100k requests/day); login traffic is
  tiny.
- **Cloudflare Pages:** 1 build per Publish. Well under the 500/month free
  limit.

## Out of scope (v1)

Author pages and bylines, comments, search, scheduled publishing,
newsletter signup, i18n, editorial review workflow, deploy previews, tag-page pagination, Cloudflare Access email login
(possible future alternative to GitHub accounts).

## Risks and verify-first items

1. Static OG image generation under `output: "export"` (§6) has a fallback
   ready.
2. `sveltia-cms-auth` compatibility with Decap (§7) has a fallback ready.
3. Decap simple mode with GitHub backend commits directly to `main` with
   the configured commit messages. Confirm on the first test post.
4. Extracting the shared prose styles must not move legal-page pixels
   (visual gate).
5. No human review: a factually wrong or off-brand post can go live.
   Accepted by the owner. Mitigated by the author checklist and Claude
   self-review.
