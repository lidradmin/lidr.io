# Lidr Blog connector for Claude.ai — design

Status: approved by owner · 2026-11-20

## Goal

A teammate types one request into Claude.ai ("write and publish a post about
snagging photos, here's a photo") and Claude researches, writes, checks,
uploads the photo and publishes — no editor, no copy and paste. Posts are
published under the teammate's own GitHub account. The existing editor
(lidr.io/admin) keeps working unchanged.

Owner decisions this design follows:
- Photos travel through Claude's code sandbox (not an in-chat upload card).
- No extra human approval step beyond Claude.ai's own tool-permission prompt
  (which a teammate may set to "Always allow"). The blog is mainly for SEO.
  Server-side checks still refuse anything that breaks a blocking rule.

## Proven before design

In the owner's Claude.ai (2026-11-20): an attached photo appears in the
sandbox at `/mnt/user-data/uploads/<name>` byte-for-byte (279,563 bytes), and
the sandbox can reach `https://lidr.io` and `https://cms-auth.lidr.io`.
Unknown for personal accounts: whether network egress to our domain is
allowed by default (see Setup).

## Architecture

```
Claude.ai ──MCP (OAuth)──► mcp.lidr.io  (new Cloudflare Worker "lidr-blog-mcp")
   │                           │  tools: context · check · photo upload · publish · hide
   │  sandbox: strip GPS +     │
   └─ curl photo ─────────────►│  /upload/<one-time token>   (photo held in KV ≤ 24 h)
                               │
                               └─ GitHub API, as the teammate ─► lidradmin/lidr-blog
                                    one commit: posts/<slug>.md + images/<slug>/*
                                          └─► existing Blog check + Publish → Cloudflare build → live
```

- **Worker** `lidr-blog-mcp` on `mcp.lidr.io`, separate from `cms-auth` so a
  bug in one can't affect the other. Remote MCP over Streamable HTTP.
- **Login**: MCP OAuth 2.1 with dynamic client registration, as Claude.ai
  requires, via `@cloudflare/workers-oauth-provider`. Upstream sign-in is the
  existing GitHub App ("Lidr Blog Editor"), so the GitHub token is a
  user-to-server token limited to repos the App is installed on (lidr-blog
  only). On sign-in the worker confirms the user has write access to
  lidr-blog, otherwise it refuses with a plain explanation. The GitHub token is
  stored encrypted inside the OAuth grant (provider-managed), never sent to
  Claude.
- **Storage**: one KV namespace for OAuth state and pending photos (TTL 24 h).
- **Shared rules**: the worker imports the site's own validator
  (`lib/blog/rules.ts`, `lib/blog/validate.ts`, and the Markdown checks), so
  the connector and the site build can never disagree.

## Tools

| Tool | What it does |
|---|---|
| `get_blog_context` | Topics, existing posts (title, address, topics, hidden?), the length/format rules, and pointers to lidr.io/features/ and /pricing/ for facts. |
| `check_post` | Runs the site's rules on a draft (title, description, topics, body, photo descriptions). Returns blocking problems and warnings in plain English, and the post's web address. |
| `start_photo_upload` | For a cover or in-text photo: returns a one-time upload address (15-minute expiry, tied to this user and post) and the exact sandbox command, which strips location/EXIF with Pillow and then uploads. Returns the path to use in the post. |
| `publish_post` | Re-checks, refuses on any blocking problem, then makes **one** commit as the teammate: the post file (same format the editor writes) plus any uploaded photos. New post or update of an existing one (sets "Last updated"). Returns the live URL ("live in about 3 minutes"). |
| `hide_post` | Turns on "Hide this post" for a post. Never deletes. |

The server's MCP `instructions` carry the writing rules (British English,
audience, no invented facts, ≥2 internal links, features only from
/features/). Teammates don't need a Claude Project, though one still works.

Upload endpoint: the sandbox command converts any photo (including iPhone
HEIC, via pillow-heif) to an EXIF-free JPEG of at most 2400 px, so the
endpoint accepts JPEG only (≤ 15 MB, sniffed by content) and strips
metadata again server-side (APP1 EXIF/XMP, APP13 IPTC, comments) as a
second line of defence.

## Safety limits

- Writes only `posts/<slug>.md` and `images/<slug>/…` in lidradmin/lidr-blog;
  slugs and file names are validated; no other repo, path or setting.
- Every commit is authored by the signed-in teammate (accountability).
- Per-user rate limit (e.g. 20 publishes/hour) and body size cap.
- Upload tokens are single-use, short-lived, signed (HMAC), and bound to
  user + post; they are the only credential the sandbox ever sees.
- Hidden posts remain public in the repo (unchanged from today).

## Setup

Owner, once: add `https://mcp.lidr.io/callback` to the GitHub App's callback
URLs and create a client secret for the worker (GitHub "sudo" password typed by
the owner); deploy the worker (wrangler, already logged in).

Teammate, once:
1. GitHub account + lidr-blog invite (as today).
2. Claude.ai → Settings → Connectors → Add custom connector →
   `https://mcp.lidr.io/mcp` → Connect → sign in with GitHub.
3. Settings → Capabilities → Code execution: on, with network access allowed
   for `mcp.lidr.io` (only needed for photos).
   On Team/Enterprise plans an Owner adds the connector for the organisation.

If the photo upload can't get out of the sandbox, Claude says so and
publishes without the photo (the post gets the automatic share image).

## Testing

- Unit (vitest): each tool's validation and error messages; metadata
  stripping on real JPEG/PNG/WebP samples with GPS; upload-token expiry,
  reuse and tampering; path/slug injection; the post file round-trips through
  the site's own parser (`parsePostFile`) to the same values.
- Local: `wrangler dev` + MCP Inspector against a scratch copy of the repo.
- Live: from the owner's Claude.ai, publish a post with an attached photo,
  confirm the commit author, GPS removed, the Blog check passes, the page is
  live; then hide the test post.

## Out of scope

In-chat upload card (MCP Apps), fully scheduled posting, embeds, Claude Code
changes (its existing skill keeps working).
