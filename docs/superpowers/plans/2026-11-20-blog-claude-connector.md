# Lidr Blog connector (Claude.ai) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A remote MCP connector at `mcp.lidr.io` that lets a signed-in teammate's Claude.ai check, upload photos for, publish and hide lidr.io blog posts, committing to `lidradmin/lidr-blog` as that teammate.

**Architecture:** One Cloudflare Worker (`workers/blog-mcp`). `@cloudflare/workers-oauth-provider` makes it the OAuth 2.1 authorization server Claude.ai expects (DCR + CIMD), with the existing GitHub App ("Lidr Blog Editor") as the upstream sign-in; the GitHub user token lives encrypted in the grant's props. A small hand-written, stateless MCP (Streamable HTTP, JSON responses) layer exposes five tools. Photos come from Claude's sandbox to `/upload/<signed one-time token>`, are metadata-stripped and parked in KV, then committed with the post in a single Git Data API commit. Content rules are the site's own `lib/blog/*` modules, bundled in.

**Tech Stack:** Cloudflare Workers + KV, `@cloudflare/workers-oauth-provider@1.2.4`, TypeScript, `yaml`, unified/remark (already deps), vitest (node env, existing config picks up `workers/**/*.test.ts`), wrangler 4.

**Why hand-written MCP:** `agents`/MCP SDK are mid-migration (SDK v1 → v2, handler APIs deprecated in 0.33). We only need `initialize`, `ping`, `tools/list`, `tools/call` over stateless JSON; ~120 lines we own and test, no churn.

---

## File structure (`workers/blog-mcp/`)

| File | Responsibility |
|---|---|
| `wrangler.toml` | name `lidr-blog-mcp`, route `mcp.lidr.io` custom domain, KV `OAUTH_KV`, vars, compat flag `global_fetch_strictly_public` |
| `src/env.ts` | `Env` type, constants (`REPO = "lidradmin/lidr-blog"`, `SITE = "https://lidr.io"`) |
| `src/mcp.ts` | JSON-RPC/MCP protocol: `handleMcp(req, tools, ctx)`; version negotiation; errors |
| `src/content.ts` | `slugify`, `buildPostFile`, `checkDraft` (wraps `validatePost`, `findPlaceholder`, `renderMarkdown`), path rules |
| `src/github.ts` | `GitHub` class over `fetch`: `whoAmI`, `canWrite`, `readFile`, `listDir`, `commit(files, message)` (Git Data API, one retry on ref race) |
| `src/jpeg.ts` | `stripJpegMetadata(bytes)`: drop APP1 (EXIF/XMP), APP13 (IPTC), COM; reject non-JPEG |
| `src/upload.ts` | `signUploadToken` / `verifyUploadToken` (HMAC-SHA256, 15 min, single use via KV), `handleUpload(req, env)` → KV `photo:<user>:<slug>:<file>` (TTL 24 h) |
| `src/tools.ts` | Tool definitions (JSON Schema) + handlers: `get_blog_context`, `check_post`, `start_photo_upload`, `publish_post`, `hide_post`; per-user rate limit |
| `src/instructions.ts` | Server `instructions` text (writing rules + workflow incl. sandbox photo step) |
| `src/auth.ts` | `/authorize` consent page (GET/POST), `/callback` GitHub exchange + write-access check, token refresh callback |
| `src/index.ts` | `new OAuthProvider({...})`: `/mcp` → MCP api handler; default handler routes `/authorize`, `/callback`, `/upload/*`, `/` |
| `src/*.test.ts` | vitest per module |
| `README.md` | deploy + secrets runbook |

Root: add `@cloudflare/workers-oauth-provider` to devDependencies (Pages build must stay ERESOLVE-clean: verify with `NPM_CONFIG_USERCONFIG=/dev/null npm ci`).

---

### Task 1: Scaffold + dependency
- [ ] `npm i -D @cloudflare/workers-oauth-provider@1.2.4`; verify `NPM_CONFIG_USERCONFIG=/dev/null npm ci` succeeds (no ERESOLVE).
- [ ] Create `wrangler.toml`, `src/env.ts`, `README.md`.
- [ ] Commit `chore(blog-mcp): scaffold worker`.

### Task 2: MCP protocol (`src/mcp.ts`) — TDD
Interface:
```ts
export type ToolDef = { name: string; title: string; description: string; inputSchema: object; annotations?: object };
export type ToolResult = { text: string; isError?: boolean; structured?: unknown };
export type Tools = { defs: ToolDef[]; call(name: string, args: Record<string, unknown>): Promise<ToolResult> };
export async function handleMcp(req: Request, tools: Tools, info: { instructions: string }): Promise<Response>;
export const SUPPORTED_VERSIONS = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"];
```
Tests (`mcp.test.ts`):
- `initialize` echoes a supported requested version, else latest; returns `capabilities.tools`, `serverInfo`, `instructions`.
- `notifications/initialized` (no id) → 202 empty body.
- `ping` → `{}`; `tools/list` → defs; `tools/call` unknown tool → result `isError: true`; handler throw → `isError` with message (no stack).
- unknown method → JSON-RPC error -32601; invalid JSON → -32700; JSON array (batch) → -32600.
- `GET` → 405 `Allow: POST`.
- [ ] Write tests → fail → implement → pass → commit `feat(blog-mcp): stateless MCP protocol layer`.

### Task 3: Content helpers (`src/content.ts`) — TDD
```ts
export function slugify(title: string): string;            // ascii, lowercase, hyphens, ≤ 80 chars at a word boundary; matches RULES.slugPattern
export type Draft = { title: string; description: string; tags: string[]; body: string; date?: string; updated?: string; cover?: string; coverAlt?: string; draft?: boolean };
export function buildPostFile(d: Draft): string;           // "---\n" + YAML (title, description, date, updated?, tags, cover?, coverAlt?, draft) + "---\n" + body + "\n"
export async function checkDraft(d: Draft, ctx: { slug: string; tags: Map<string, TagDef>; knownImages: Set<string> }): Promise<{ hard: Problem[]; soft: Problem[] }>;
export const imagePublicPath = (slug: string, file: string) => `/images/blog/${slug}/${file}`;
export const imageRepoPath = (slug: string, file: string) => `images/${slug}/${file}`;
```
`checkDraft` = `parsePostFile(buildPostFile(d))` round-trip (proves the file the site will read) → `validatePost` → `renderMarkdown(body, { images: manifest of knownImages })` warnings → cover must be a known image.
Tests: slugify on the snagging title, accents, punctuation, very long titles; `buildPostFile` round-trips through `parsePostFile` with colons/quotes in title; placeholder → hard; `# H1` → soft; external image → soft; unknown topic → soft; cover not uploaded → soft.
- [ ] Tests → implement → pass → commit.

### Task 4: GitHub client (`src/github.ts`) — TDD with fake fetch
```ts
export class GitHub {
  constructor(token: string, fetcher?: typeof fetch);
  whoAmI(): Promise<{ id: number; login: string }>;
  canWrite(repo: string): Promise<boolean>;                   // GET /repos/{repo} → permissions.push
  readFile(repo: string, path: string): Promise<string | null>; // contents API, base64 decode, 404 → null
  listDir(repo: string, path: string): Promise<string[]>;     // names; 404 → []
  commit(repo: string, files: { path: string; content: string | Uint8Array }[], message: string): Promise<{ sha: string }>;
}
export class GitHubAuthError extends Error {}                 // 401 → "reconnect" message upstream
```
`commit`: GET ref `heads/main` → GET commit → POST blobs (utf-8 or base64) → POST tree (`base_tree`) → POST commit → PATCH ref (`force: false`); on 422 from PATCH, retry whole sequence once.
Tests assert request sequence/bodies and the retry; 401 → `GitHubAuthError`.
- [ ] Tests → implement → pass → commit.

### Task 5: Photo upload (`src/jpeg.ts`, `src/upload.ts`) — TDD
- `stripJpegMetadata`: walk segments from SOI; drop `FFE1`, `FFED`, `FFFE`; stop copying markers at SOS (copy rest verbatim); throw `NotJpegError` if no SOI. Test with a real JPEG generated by sharp with EXIF+GPS (`withMetadata({ exif: { IFD3: { GPSLatitude: ... } } })`): output has no `Exif\0\0`, still decodes with sharp, same dimensions.
- Tokens: payload `{u, s, f, k: "cover"|"inline", exp}` base64url + `.` + HMAC; verify checks signature (constant-time), expiry, and KV `used:<sig>` (then sets it, TTL 1 h).
- `handleUpload`: POST only; ≤ 15 MB; strip; KV put `photo:<u>:<s>:<f>` with metadata `{ kind, alt? }`, TTL 86400; JSON `{ ok, path }`. Errors are plain sentences (expired, already used, too big, not a JPEG).
- [ ] Tests → implement → pass → commit.

### Task 6: Tools (`src/tools.ts`, `src/instructions.ts`) — TDD with fake GitHub + in-memory KV
- `get_blog_context()` → topics (from `tags.yml`), posts (`posts/*.md` front matter: slug, title, tags, hidden), rules (RULES limits), links to /features/ and /pricing/.
- `check_post(draft + slug?)` → `{ slug, url, exists, hard[], soft[] }` (knownImages = KV photos for slug ∪ repo `images/<slug>/*`).
- `start_photo_upload({ slug, filename, kind, alt })` → `{ upload_url, path, sandbox_command }`; filename sanitised to `[a-z0-9-]+\.jpg`; the command converts any input (incl. HEIC via `pip install pillow-heif` fallback) to EXIF-free JPEG ≤ 2400 px with Pillow, then `curl --fail-with-body --data-binary`.
- `publish_post(draft + slug? + update?: boolean)` → re-check; any hard → `isError` listing problems; existing slug without `update: true` → error; with update sets `updated` = today; commit message `Publish blog post "<slug>"` / `Update blog post "<slug>"`; includes referenced KV photos; deletes them after commit; returns URL + "live in about 3 minutes".
- `hide_post({ slug })` → sets `draft: true`, commit `Hide blog post "<slug>"`.
- Rate limit: 20 publishes/hour/user (KV counter `rl:<u>:<hour>`).
- Tests: happy path commit contents; hard problem blocks; overwrite guard; photo inclusion; hide; rate limit; path traversal in slug/filename rejected.
- [ ] Tests → implement → pass → commit.

### Task 7: OAuth + entry (`src/auth.ts`, `src/index.ts`) — TDD for pure parts
- `index.ts`: `OAuthProvider` with `apiRoute: "/mcp"`, `apiHandler` → `handleMcp` with tools bound to `ctx.props` (GitHub token, user id/login), `authorizeEndpoint: "/authorize"`, `tokenEndpoint: "/oauth/token"`, `clientRegistrationEndpoint: "/oauth/register"`, `clientIdMetadataDocumentEnabled: true`, `scopesSupported: ["blog"]`, `resourceMetadata`, `accessTokenTTL: 3600`, `tokenExchangeCallback` refreshing the GitHub token when it has < 10 min left.
- `auth.ts`: consent page (names the client, says what it can do: publish/hide posts as you on lidr.io), Allow/Deny via `beginConsent/approveConsent/denyConsent`; `beginUpstream` → GitHub authorize with PKCE; `/callback` → `finishUpstream`, exchange code, `whoAmI`, `canWrite` (false → friendly page "Ask Conor to invite you to lidr-blog"), `completeAuthorization({ props: { token, refresh, expiresAt, login, id } })`.
- Tests: consent HTML escapes client name; callback refuses non-writers; refresh callback updates props / throws `invalid_grant` on bad refresh.
- [ ] Tests → implement → pass → `wrangler deploy --dry-run` bundles under 3 MB → commit.

### Task 8: Owner setup + deploy (browser + wrangler)
- [ ] GitHub App settings: add callback `https://mcp.lidr.io/callback`; generate a client secret (owner types sudo password). Pipe secret straight into `wrangler secret put GITHUB_CLIENT_SECRET` (never written to disk).
- [ ] `wrangler kv namespace create OAUTH_KV` → id into wrangler.toml; `openssl rand -base64 48 | wrangler secret put UPLOAD_SIGNING_KEY`.
- [ ] `wrangler deploy`; check `https://mcp.lidr.io/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/mcp` respond; unauthenticated POST `/mcp` → 401 with `WWW-Authenticate`.

### Task 9: Live end-to-end from Claude.ai
- [ ] Add custom connector `https://mcp.lidr.io/mcp` in the owner's Claude.ai, sign in as lidradmin? No — as the owner's GitHub user ConorPMullan (a collaborator), proving teammate attribution.
- [ ] New chat with a photo attached: "write and publish a short test post…". Verify: commit author, photo committed without GPS, Blog check passes, page live, photo on page.
- [ ] Hide the test post via the connector (`hide_post`), verify hidden.

### Task 10: Docs + teammate message
- [ ] `lidr-blog/docs/claude-connector.md` (teammate setup incl. code-execution network setting), link from authoring guide; owner runbook in `workers/blog-mcp/README.md` and `docs/blog-setup.md`.
- [ ] Updated WhatsApp message.
