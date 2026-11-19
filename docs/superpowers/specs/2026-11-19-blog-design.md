# Blog — Design Spec

**Date:** 2026-11-19
**Branch:** `rebuild`
**Status:** Draft, awaiting owner review

## Goal

Add an SEO-focused blog to lidr.io that anyone on the team can publish to,
regardless of technical experience, without touching Git, and with a review
step before anything goes live. Team members using Claude (chat or Claude Code)
must be able to produce posts in the same format.

## Constraints

- Site is Next.js 16 with `output: "export"` (static), deployed by Cloudflare
  Pages from GitHub `lidradmin/lidr.io` (public repo). No runtime server, so
  every blog page is generated at build time. All routes need
  `generateStaticParams()` with `dynamicParams = false`.
- Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/`
  before writing any Next.js code.
- Everything must run on free tiers (see Costs).
- Must not break the existing visual, a11y and Lighthouse gates.

## Decisions (owner-approved)

| Topic | Decision |
|---|---|
| Authoring | Git-backed browser CMS at `/admin/`. **Decap CMS**, chosen over Sveltia because its review board and preview links are documented. |
| Publishing | Editorial workflow. Publish opens a PR → Cloudflare preview → approver publishes from the CMS (merge). |
| Accounts | Each author gets their own free GitHub account, added as a repo collaborator with **Write** access. The shared `lidradmin` account is **not** used by authors. |
| Scope v1 | Core SEO, tags, auto OG images. No author pages. |
| Navigation | "Blog" link in the **footer only**. The header is unchanged. |
| Claude | Repo skill for Claude Code + versioned instructions file for a Claude.ai Project. |

## Architecture

```
Author ──► lidr.io/admin (Decap CMS, static)
             │ GitHub login via Cloudflare Worker (OAuth proxy)
             ▼
        GitHub API: branch cms/blog/<slug> + PR
             │
             ├─► GitHub Action: validate + build (every push, free)
             ├─► On "In review": Action builds + direct-uploads to the
             │   preview project ──► preview URL shown in the CMS
             ▼
        Approver clicks Publish in CMS (merge to main)
             ▼
        Cloudflare Pages production build ──► lidr.io/blog/<slug>/
```

Claude Code users skip the CMS. They create the same Markdown file on a branch
and open a PR. Review and preview work the same way.

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
| `draft` | boolean | default `false`; drafts excluded from build output |
| `canonical` | URL | optional override |

The slug is the filename. Lowercase, hyphenated, ASCII; the CMS generates it
from the title.

**Tags:** `content/blog/tags.yml` lists `slug`, `name` and `description` (the
intro for each tag page). It is editable in the CMS as a "Tags" file
collection, so authors pick from a fixed list. This prevents duplicates such as
"site photos" and "site-photos".

**Validation failure** fails `next build` with a readable message naming the
file and field (e.g. `content/blog/foo.md: description must be ≤160 chars (is 182)`).

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
  - `backend: { name: github, repo: lidradmin/lidr.io, branch: main, base_url: <worker URL>, squash_merges: true }`
  - `publish_mode: editorial_workflow`
  - `site_url: https://lidr.io`, `logo_url` set to the Lidr logo.
  - Collection `blog`: folder `content/blog`, `create: true`,
    `slug: "{{slug}}"`, fields mirroring §1 with `pattern` and `hint` to
    enforce lengths in the editor ("Shown in Google results. 50–160
    characters."). `tags` is a `relation` widget to the tags file.
  - `media_folder: /public/images/blog/{{slug}}`, `public_folder: /images/blog/{{slug}}`.
  - File collection `tags` → `content/blog/tags.yml`.
  - `preview_path: blog/{{slug}}`.
- Preview pane: `CMS.registerPreviewStyle` with a small built CSS file
  (fonts + prose styles) so the preview looks like the live site.
- **Deploy-preview links:** Decap reads GitHub commit statuses whose context
  contains "deploy". Set `preview_context: deploy/preview`. The status is
  posted by the review-preview Action (§8), not by Cloudflare Pages.

### Build budget: only publishing uses a Cloudflare build
Cloudflare Pages Free allows 500 builds/month. To keep CMS saves from
consuming builds:
- **Cloudflare Pages → Settings → Builds → Branch control:** keep
  production = `main` and automatic preview deployments on, but **exclude**
  `cms/*` and `blog/*`. A CMS save is then just a commit with no Cloudflare
  build. Other branches keep their previews.
- **While writing:** authors use Decap's built-in live preview pane
  (instant, free).
- **For review:** the review-preview Action (§8) builds in GitHub Actions
  and uploads with `wrangler pages deploy out --branch=<slug>` to a
  **separate Direct Upload Pages project** (`lidr-blog-preview`), then
  posts the URL as a commit status. Production is untouched.
- Result: **one Cloudflare build per publish** (merge to `main`).

### OAuth Worker
A Cloudflare Worker at e.g. `cms-auth.lidr.io`, based on `sveltia-cms-auth`
(GitHub App; Contents RW, Pull requests RW, Metadata R).
**Verify first** that it works with Decap's GitHub backend. If not, write a
minimal Decap-compatible OAuth proxy Worker (`/auth`, `/callback`,
`postMessage` handshake) in `workers/cms-auth/`. Secrets
(`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) live only in Worker env vars.

## 8. CI (GitHub Actions; free for public repos)

`.github/workflows/blog-pr.yml` on PRs touching `content/blog/**`,
`public/images/blog/**`, `app/blog/**`, `lib/blog/**`:
1. `npm ci` → `next build`. Schema validation runs inside the build.
2. Lint posts: every image has alt text, no broken internal `/blog/` links,
   cover images under 500 KB (warn above 300 KB).

`.github/workflows/blog-review-preview.yml`: the review preview.
- Trigger: `pull_request` events `labeled` and `synchronize`. Runs only
  when the PR has the Decap label `decap-cms/pending_review` or
  `decap-cms/pending_publish`, or when the head branch matches `blog/*`
  (Claude Code PRs). Drafts get no preview build.
- Same-repo branches only (`github.event.pull_request.head.repo.full_name == github.repository`),
  so secrets never reach fork code. Never uses `pull_request_target`.
- Steps: `npm ci` → `next build` → `wrangler pages deploy out
  --project-name=lidr-blog-preview --branch=<sanitised slug>` → post commit
  status `deploy/preview` with the deployment URL.
- Secrets: `CLOUDFLARE_API_TOKEN` (scoped to Pages: Edit on the account) and
  `CLOUDFLARE_ACCOUNT_ID`.
- Preview project responses carry `X-Robots-Tag: noindex` via its own
  `_headers` (an Action step appends it to `out/_headers` before upload).

Branch protection on `main`: require this check to pass and one approval.
Owner/admins may bypass.

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
- **Lighthouse CI:** add `/blog/` and the fixture post to `lighthouserc.js`
  at the existing thresholds.

## 10. Claude support

- **Claude Code skill:** `.claude/skills/new-blog-post/SKILL.md`. Steps:
  check existing posts and tags to avoid duplicate topics or keywords →
  draft to the §1 schema → include 2+ internal links (`/features/`,
  `/pricing/`, related posts) → alt text on every image → run `npm run build`
  → create branch `blog/<slug>` → open a PR using the template.
- **Claude.ai Project instructions:** `docs/blog-claude-instructions.md`
  (voice, audience of construction site teams, structure, SEO rules, output
  format = body Markdown plus a separate block listing title, description and
  tags to paste into CMS fields).
- **PR template:** `.github/pull_request_template.md` with a human-edit
  checklist: facts checked, real Lidr specifics added (screenshots, examples),
  no invented stats or quotes, links work.

## 11. Team docs

`docs/blog-authoring.md`: one page with screenshots. Covers the one-time
GitHub signup and invite, writing a post, adding images, sending for review,
finding the preview link, and how an approver publishes. Plus a short
troubleshooting section ("my post failed checks" → what the error means).

## 12. One-time setup (owner)

1. Create the GitHub App for CMS login and note the client ID and secret.
2. Deploy the auth Worker and set its secrets. Optional custom domain
   `cms-auth.lidr.io`.
3. Add authors as collaborators (Write). Designate approvers.
4. Enable branch protection on `main` (§8).
5. Cloudflare Pages branch control: exclude `cms/*` and `blog/*` from
   preview builds (§7).
6. Create the Direct Upload Pages project `lidr-blog-preview` and a
   Cloudflare API token (Pages: Edit). Add `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID` as GitHub repo secrets.

## Costs

All on free tiers:
- **Decap CMS:** open source.
- **GitHub:** free accounts. Unlimited collaborators. Actions minutes are free
  on public repos.
- **Cloudflare Workers:** free tier (100k requests/day); login traffic is
  tiny.
- **Cloudflare Pages:** free plan allows **500 builds/month**. With the
  §7 build budget, CMS saves cost 0 builds, review previews are built in
  GitHub Actions and direct-uploaded, and each publish costs 1 build.

## Out of scope (v1)

Author pages and bylines, comments, search, scheduled publishing,
newsletter signup, i18n, tag-page pagination, Cloudflare Access email login
(possible future alternative to GitHub accounts).

## Risks and verify-first items

1. Static OG image generation under `output: "export"` (§6) has a fallback
   ready.
2. Decap shows the `deploy/preview` status posted by our Action (§7, §8).
   Confirm on a test PR.
3. `sveltia-cms-auth` compatibility with Decap (§7) has a fallback ready.
4. Confirm in Cloudflare docs that Direct Upload deployments do not count
   toward the 500 builds/month limit. If they do, the cost is still one
   build per review round, not per save.
5. Extracting the shared prose styles must not move legal-page pixels
   (visual gate).
