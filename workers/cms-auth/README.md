# cms-auth: GitHub OAuth for the blog editor

## What this is

A small Cloudflare Worker that signs editors in to the Decap CMS editor at
`https://lidr.io/admin/` with GitHub (spec `docs/superpowers/specs/2026-11-19-blog-design.md` §9).
It uses a GitHub App installed only on `lidradmin/lidr-blog`, so the tokens it hands out can only touch that repo.

How the handshake works (Decap's popup protocol, from `decap-cms-lib-auth`):

1. The editor opens a popup at `https://cms-auth.lidr.io/auth?provider=github`. The Worker sets a one-time
   `__Host-cms_oauth_state` cookie and redirects to GitHub.
2. GitHub redirects back to `/callback`. The Worker checks `state` against the cookie (a duplicated cookie is
   rejected) and exchanges the code for a token.
3. The callback page posts `authorizing:github` to the editor window. The editor echoes it back only if the popup's
   origin matches `backend.base_url`.
4. The popup accepts the echo only from `ALLOWED_ORIGIN` (`https://lidr.io`) and only from its own opener window,
   then posts `authorization:github:success:{token,provider}` to that origin only.

Things to know:

- **Tokens expire after 8 hours** (the GitHub App default for user tokens). Decap doesn't refresh them, so authors
  just sign in again when the editor asks.
- **`scope=repo` is ignored.** Decap sends it, but GitHub Apps don't use OAuth scopes; access comes from the App's
  permissions and where it's installed.
- **App permissions:** Repository → Contents: Read and write, Metadata: Read-only. Nothing else.
- **Callback URL:** register exactly `https://cms-auth.lidr.io/callback` on the GitHub App. It must match the
  `CALLBACK_URL` var in `wrangler.toml` character for character.
- If `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` or `ALLOWED_ORIGIN` is missing or invalid, every request returns
  500 `cms-auth is misconfigured`.

## Deploy

```sh
cd workers/cms-auth
npx wrangler@4 login
npx wrangler@4 secret put GITHUB_CLIENT_ID
npx wrangler@4 secret put GITHUB_CLIENT_SECRET
npx wrangler@4 deploy
```

Then add the custom domain `cms-auth.lidr.io` under the Worker's **Settings → Domains & Routes**.

## Test

From the repo root:

```sh
npx vitest run workers
```
