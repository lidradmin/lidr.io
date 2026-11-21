# Lidr Blog connector (`mcp.lidr.io`)

A remote MCP server that lets a teammate's Claude.ai write, check and publish
lidr.io blog posts (with photos) as themselves. Design:
`docs/superpowers/specs/2026-11-20-blog-claude-connector-design.md`.

- `/mcp` — MCP endpoint (OAuth-protected). Tools: `get_blog_context`,
  `check_post`, `start_photo_upload`, `publish_post`, `hide_post`.
- `/authorize`, `/callback` — sign-in: consent page, then GitHub (the
  "Lidr Blog Editor" GitHub App). Only people with write access to
  `lidradmin/lidr-blog` can finish signing in.
- `/oauth/token`, `/oauth/register`, `/.well-known/*` — handled by
  `@cloudflare/workers-oauth-provider`.
- `/upload/<token>` — one-time photo upload from Claude's code sandbox.

## Deploy

```bash
cd workers/blog-mcp
npx wrangler@4 deploy
```

Checks before deploying: `npx vitest run workers/blog-mcp` and
`npm run typecheck:blog-mcp` from the repo root.

## Configuration

`wrangler.toml` holds the KV namespace (`OAUTH_KV`: OAuth grants, pending
photos, rate limits) and plain settings. Secrets (never committed):

| Secret | What |
|---|---|
| `GITHUB_CLIENT_ID` | Client ID of the "Lidr Blog Editor" GitHub App |
| `GITHUB_CLIENT_SECRET` | A client secret of that App (Settings → Developer settings → GitHub Apps → Lidr Blog Editor → Credentials). The editor's login worker uses a different secret of the same App. |
| `UPLOAD_SIGNING_KEY` | Random value that signs photo upload links: `openssl rand -base64 48 \| tr -d '\n' \| npx wrangler@4 secret put UPLOAD_SIGNING_KEY` |

The GitHub App must list `https://mcp.lidr.io/callback` as a redirect URI, and must be **public** (App settings → Advanced). A private GitHub App shows a 404 to everyone except its owner (lidradmin) when they sign in, which breaks both this connector and the lidr.io/admin editor for teammates.

## Operations

- **Remove someone's access:** remove them as a collaborator on
  `lidradmin/lidr-blog`. Their next sign-in is refused; existing sessions fail
  on the next save (GitHub refuses the commit).
- **Revoke everyone's sessions:** rotate `GITHUB_CLIENT_SECRET` (new secret in
  the App, `wrangler secret put`, delete the old one) — or "Revoke all user
  tokens" in the App settings.
- **Logs:** `npx wrangler@4 tail lidr-blog-mcp`.
- **Cost:** Workers and KV free tiers (KV free: 1,000 writes/day; each
  publish uses a handful).
