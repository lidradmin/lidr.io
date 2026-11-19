# Blog setup runbook (owner only)

Do these steps once, in order. Each needs the `lidradmin` GitHub account or Cloudflare dashboard access.
Where a GitHub or Cloudflare screen may be worded differently from this runbook, look for the setting named in quotes.

## 0. Before you start

- [ ] Merge the site branch first (the owner or Claude does this), so `lidradmin/lidr.io` `main` has the blog code, the Worker and the Claude Code skill.
- [ ] `lidradmin/lidr.io` must stay **public**: the content repo's CI checks it out without a token, the Claude Code skill clones it, and the skill's install URL is a raw GitHub link.
- [ ] You can sign in to GitHub as `lidradmin`.
- [ ] You have Cloudflare access to the `lidr.io` zone and to the Pages project `lidr-io`.
- [ ] The content repo scaffold is already prepared locally at `/Users/conor.mullan/Documents/lidr-blog` (posts, images, `tags.yml`, workflows, authoring guide). You only need to create the GitHub repo and push it.

## 1. Create the content repo

- [ ] As `lidradmin`: GitHub, New repository, name `lidr-blog`, **Public**, no README, no .gitignore, no license.
- [ ] Push the prepared scaffold from `/Users/conor.mullan/Documents/lidr-blog`:
  ```sh
  cd /Users/conor.mullan/Documents/lidr-blog && git remote add origin https://github.com/lidradmin/lidr-blog.git && git push -u origin main
  ```
- [ ] If the `lidradmin` account or org restricts which Actions may run, allow `actions/checkout`, `actions/setup-node`, `actions/upload-artifact` and `actions/download-artifact`.
- [ ] Settings, Actions, General:
  - "Fork pull request workflows from outside collaborators": choose "Require approval for all outside collaborators".
  - "Workflow permissions": choose "Read repository contents".
- [ ] Settings, Secrets and variables, Actions, Variables tab: add a repository variable `BLOG_OWNER` set to the GitHub username that should be mentioned on problems.
- [ ] Settings, Environments, New environment: name it `production`, then under "Deployment branches and tags" choose "Selected branches" and add `main`. The `CF_DEPLOY_HOOK` secret goes in this environment (step 4), not in the repository secrets: only workflow runs on `main` can read it, so a workflow pushed on another branch can't.
- [ ] Extra (recommended): protect the workflows with a free ruleset, so a Write collaborator can't edit `.github/**` on `main` either.
  - Settings, Rules, Rulesets, New ruleset, New branch ruleset. Name it e.g. `protect workflows`, set Enforcement status to Active.
  - Bypass list: add the Repository admin role.
  - Target branches: Add target, Include default branch (`main`).
  - Branch rules: tick "Restrict file paths" and add the pattern `.github/**`.
  - Save with "Create".
  - If you can't find "Restrict file paths" (it can depend on the plan or on whether the repo is public), look for "Restrict file path" or similar under the branch rules. If it isn't offered at all, accept the risk: the deploy hook only triggers a site rebuild, and you can regenerate it any time in Cloudflare (step 4).

## 2. Create the GitHub App (editor login)

- [ ] As `lidradmin`: Settings, Developer settings, GitHub Apps, New GitHub App.
  - GitHub App name: `Lidr Blog Editor`.
  - Homepage URL: `https://lidr.io/admin/`.
  - Callback URL: `https://cms-auth.lidr.io/callback`.
  - "Expire user authorization tokens": leave it ticked (more secure). Untick only if 8-hour logins annoy authors.
  - Webhook: untick "Active".
  - Repository permissions: Contents **Read and write**, Metadata **Read-only**. Nothing else.
  - "Where can this GitHub App be installed?": Only on this account.
- [ ] Click "Create GitHub App" and note the **Client ID**.
- [ ] Under "Client secrets", click "Generate a new client secret" and copy it now (it is shown once).
- [ ] Install App (left sidebar), Install on `lidradmin`, choose "Only select repositories", and pick **only** `lidradmin/lidr-blog`.

## 3. Deploy the login Worker

- [ ] From the site repo (`lidradmin/lidr.io`):
  ```sh
  cd workers/cms-auth && npx wrangler@4 login && npx wrangler@4 deploy
  ```
  Deploy first: it creates the Worker and its custom domain `cms-auth.lidr.io` from `wrangler.toml`. There's no dashboard step.
- [ ] Then set both secrets (still in `workers/cms-auth`):
  ```sh
  npx wrangler@4 secret put GITHUB_CLIENT_ID && npx wrangler@4 secret put GITHUB_CLIENT_SECRET
  ```
  Paste the Client ID and client secret from step 2 when prompted. Until both are set, every request returns 500 `cms-auth is misconfigured`.
- [ ] Check:
  ```sh
  curl -sI "https://cms-auth.lidr.io/auth?provider=github" | grep -i location
  ```
  It should show a `github.com/login/oauth/authorize` URL.

## 4. Connect the site to the content

- [ ] Cloudflare, Pages, `lidr-io`, Settings, Variables and secrets: add `BLOG_CONTENT_REPO` = `https://github.com/lidradmin/lidr-blog.git`, for Production **and** Preview.
- [ ] Settings, Builds (look for "Deploy hooks"): add a hook named `blog-content` on branch `main` and copy its URL.
- [ ] In `lidradmin/lidr-blog`: Settings, Environments, `production` (created in step 1), "Environment secrets", Add environment secret: `CF_DEPLOY_HOOK` = that URL. Don't add it as a repository secret: environment secrets are only readable by runs on `main`, so workflows on other branches can't read it.
- [ ] Trigger a deploy (Deployments, Retry latest). The build log must show `blog: N post(s)...`, not `disabled`.
- [ ] Check the editor's security header:
  ```sh
  curl -sI https://lidr.io/admin/ | grep -i content-security-policy
  ```
  It should print the `Content-Security-Policy` header.

## 5. Invite authors

- [ ] `lidr-blog`: Settings, Collaborators, Add people: add each author's GitHub username with the **Write** role. Authors are never added to `lidr.io`.

## 6. Google Search Console

- [ ] Add the property `https://lidr.io` (DNS verification via Cloudflare), then Sitemaps: submit `https://lidr.io/sitemap.xml`.

## 7. Upgrading Decap later

- [ ] Change the version in `public/admin/index.html`.
- [ ] Recompute the SRI hash:
  ```sh
  curl -fsSL https://cdn.jsdelivr.net/npm/decap-cms@X.Y.Z/dist/decap-cms.js | openssl dgst -sha384 -binary | openssl base64 -A
  ```
- [ ] Update the versioned path in the `/admin/*` CSP in `public/_headers`.
- [ ] Build, then open the built `/admin/` once locally **without** the CSP (e.g. `npx serve out`) and check the browser console for "Config Errors". Decap skips config validation under our CSP, so this is the only place config mistakes show up.

## 8. If something goes wrong

- **A failed site build** leaves the previous version live. Check the Cloudflare build log; `blog:` lines name the problem.
- **"Could not fetch blog content"** means the content repo URL or GitHub was unreachable. Retry the deploy.
- **Authors can't log in:** allow pop-ups for `lidr.io` in the browser. Then check the Worker's custom domain, the GitHub App callback URL, and that the App is installed on `lidr-blog`.
- **The editor suddenly asks to log in again or saves fail:** GitHub App sign-ins expire after 8 hours. Sign in again.
