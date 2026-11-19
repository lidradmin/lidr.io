# Blog Publishing Implementation Plan — Plan 2 of 2

> **Superseded during execution:** the content repo is data-only (no `scripts/` or `.claude/`); the Claude Code skill lives at `docs/claude-code/new-blog-post/SKILL.md` and the checker at `scripts/blog/check-content.sh <content-dir> [slug]` in the site repo; `CF_DEPLOY_HOOK` is an Environment secret (`production`, `main` only).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone on the team publish blog posts with no Git knowledge and no review step. Covers:
- the browser editor at `lidr.io/admin`, with GitHub login via a Cloudflare Worker;
- the separate `lidradmin/lidr-blog` content repo;
- automatic deploys;
- plain-English problem notifications as GitHub Issues;
- the Claude Code skill and Claude.ai instructions;
- the team guide.

**Architecture:**
- **Site repo (`lidradmin/lidr.io`):**
  - generates the Decap CMS config from `lib/blog/rules.ts`, the single source of truth;
  - serves `/admin` under a strict CSP;
  - holds the OAuth Worker source (`workers/cms-auth`);
  - holds the notifier script that the content repo's CI runs.
- **Content repo (`lidradmin/lidr-blog`):**
  - holds posts, images and `tags.yml`;
  - a GitHub Action checks every push using the site repo's own validator, then opens, updates or closes one Issue per post;
  - a second Action fires the Cloudflare deploy hook, so the site rebuilds with the new content.

**Tech stack:** Decap CMS 3.18.0 (pinned, SRI), Cloudflare Workers (wrangler), GitHub App OAuth, GitHub Actions (GitHub-hosted runners only), tsx, vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-blog-design.md` (rev 2) §1, §2, §7–§13. **Plan 1** (`2026-11-19-blog-site.md`) is merged and live, with the blog disabled.

**Facts verified while planning (2026-11-19):**
- **Decap 3.18.0 is the latest version.** `dist/decap-cms.js` is about 5 MB and loads ~94 lazy chunks from the same CDN folder.
- **The OAuth popup handshake** comes from the `decap-cms-lib-auth@3.4.0` source:
  1. The popup posts `"authorizing:github"` to the opener.
  2. The opener echoes it back, but only if `e.origin` equals the origin of `base_url`.
  3. The popup posts `"authorization:github:success:" + JSON.stringify({ token, provider: "github" })`, or `…:error:{…}`.
  - The opener opens `${base_url}/${auth_endpoint}?provider=github&site_id=…&scope=…`.
- **Collection-level `media_folder` is template-expanded** (`folderFormatter` → `compileStringTemplate`), so `/images/{{slug}}` works.
  - Even if a folder ever mismatches (say, after a title change), images still resolve: the pipeline keys images by the exact path written into Markdown.
- **Decap slugs are lower-cased** (`prepareSlug` calls `toLocaleLowerCase`), so they pass our validator.
- **The markdown widget supports `sanitize_preview`.**
- **The Decap bundle contains `eval`/`new Function`.** The CSP starts without `'unsafe-eval'`; Task 10 checks for CSP violations in a real browser and adds it only if needed.

**Branches:**
- Site repo work goes on `feat/blog-publishing`.
- Content-repo files are built in a new local repo at `/Users/conor.mullan/Documents/lidr-blog`.
- The owner creates the GitHub repo and pushes it (Task 9).

**Owner-only steps** need the `lidradmin` GitHub account or Cloudflare dashboard access, which agents don't have. They are collected in `docs/blog-setup.md` (Task 8) and executed in Task 9.

---

## File map

**Site repo — create:**
- `scripts/blog/cms-config.ts` (+ test): builds the Decap config object from `RULES`
- `scripts/blog/changes.ts` (+ test): the "you changed the text but not *Last updated*" check
- `scripts/blog/notify.ts` (+ test): turns a report into GitHub Issue actions and executes them
- `public/admin/index.html`, `public/admin/preview.js`, `public/admin/preview.css`
- `workers/cms-auth/src/index.ts` (+ test), `workers/cms-auth/wrangler.toml`, `workers/cms-auth/README.md`
- `.github/workflows/blog-content.yml`
- `docs/blog-setup.md`: the owner runbook

**Site repo — modify:**
- `lib/blog/validate.ts`: export `REDIRECT_PATTERN`
- `scripts/blog/pipeline.ts` (+ test): duplicate titles, broken internal links
- `scripts/blog/prepare.ts`: write the admin config and fonts; add `--since` and `BLOG_FAIL_ON=hard`
- `public/_headers`: `/admin/*` security headers
- `.gitignore`: generated admin files
- `vitest.config.mts`: include `workers/**`

**Content repo (`/Users/conor.mullan/Documents/lidr-blog`) — create:**
- `README.md`, `tags.yml`, `posts/.gitkeep`, `images/.gitkeep`
- `.github/workflows/check.yml`, `.github/workflows/publish.yml`
- `scripts/check.sh`
- `.claude/skills/new-blog-post/SKILL.md`
- `docs/authoring-guide.md`, `docs/claude-instructions.md`

---

### Task 1: Export the redirect rule and generate the CMS config from RULES

**Files:**
- Modify: `lib/blog/validate.ts:11`
- Create: `scripts/blog/cms-config.ts`, `scripts/blog/cms-config.test.ts`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull --ff-only && git checkout -b feat/blog-publishing
```

- [ ] **Step 2: Export `REDIRECT_PATTERN`** — in `lib/blog/validate.ts`, change line 11 from `const REDIRECT_PATTERN =` to `export const REDIRECT_PATTERN =`.

- [ ] **Step 3: Write the failing test** — `scripts/blog/cms-config.test.ts`

```ts
import { describe, expect, test } from "vitest";
import { RULES } from "../../lib/blog/rules";
import { REDIRECT_PATTERN } from "../../lib/blog/validate";
import { buildCmsConfig } from "./cms-config";

type Field = { name: string; widget: string; pattern?: [string, string]; min?: number; max?: number; required?: boolean; [k: string]: unknown };
const cfg = buildCmsConfig();
const blog = cfg.collections.find((c) => c.name === "blog")! as { fields: Field[]; [k: string]: unknown };
const field = (n: string) => blog.fields.find((f) => f.name === n)!;
const matches = (f: Field, s: string) => new RegExp(f.pattern![0]).test(s);

describe("CMS config mirrors RULES (single source of truth)", () => {
  test("title length", () => {
    const t = field("title");
    expect(matches(t, "x".repeat(RULES.title.min))).toBe(true);
    expect(matches(t, "x".repeat(RULES.title.max))).toBe(true);
    expect(matches(t, "x".repeat(RULES.title.min - 1))).toBe(false);
    expect(matches(t, "x".repeat(RULES.title.max + 1))).toBe(false);
  });
  test("description length (multi-line allowed)", () => {
    const d = field("description");
    expect(matches(d, "a\n".repeat(RULES.description.min / 2))).toBe(true);
    expect(matches(d, "x".repeat(RULES.description.max + 1))).toBe(false);
  });
  test("tags min/max", () => {
    expect(field("tags")).toMatchObject({ min: RULES.tags.min, max: RULES.tags.max, multiple: true });
  });
  test("image size limit", () => {
    expect(cfg.media_library.config.max_file_size).toBe(RULES.maxImageBytes);
  });
  test("redirect pattern is the validator's", () => {
    expect(field("redirectTo").pattern![0]).toBe(REDIRECT_PATTERN.source);
  });
  test("tag slug pattern is RULES.slugPattern", () => {
    const settings = cfg.collections.find((c) => c.name === "settings") as unknown as { files: { fields: { fields: Field[] }[] }[] };
    const slug = settings.files[0].fields[0].fields.find((f) => f.name === "slug")!;
    expect(slug.pattern![0]).toBe(RULES.slugPattern.source);
  });
  test("no canonical field is exposed to authors (spec §2)", () => {
    expect(blog.fields.some((f) => f.name === "canonical")).toBe(false);
  });
  test("backend + media layout", () => {
    expect(cfg.backend).toMatchObject({ name: "github", repo: "lidradmin/lidr-blog", branch: "main", base_url: "https://cms-auth.lidr.io" });
    expect(cfg).not.toHaveProperty("publish_mode");
    expect(blog).toMatchObject({ folder: "posts", media_folder: "/images/{{slug}}", public_folder: "/images/blog/{{slug}}", delete: false });
    expect(field("body")).toMatchObject({ widget: "markdown", sanitize_preview: true });
  });
  test("options override repo and auth URL", () => {
    const c = buildCmsConfig({ repo: "me/test", branch: "main", authBaseUrl: "https://auth.example", siteUrl: "https://example.com" });
    expect(c.backend).toMatchObject({ repo: "me/test", base_url: "https://auth.example" });
  });
});
```

- [ ] **Step 4: Run to verify failure** — `npx vitest run scripts/blog/cms-config.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 5: Implement `scripts/blog/cms-config.ts`**

```ts
import { RULES } from "../../lib/blog/rules";
import { REDIRECT_PATTERN } from "../../lib/blog/validate";

/**
 * Builds the Decap CMS config (written to public/admin/config.yml by
 * prepare.ts). Every limit comes from lib/blog/rules.ts so the editor and the
 * build-time validator can never disagree. Never hand-edit config.yml.
 */
export type CmsOptions = { repo: string; branch: string; authBaseUrl: string; siteUrl: string };

export const DEFAULT_CMS_OPTIONS: CmsOptions = {
  repo: "lidradmin/lidr-blog",
  branch: "main",
  authBaseUrl: "https://cms-auth.lidr.io",
  siteUrl: "https://lidr.io",
};

const lengthPattern = (min: number, max: number, what: string): [string, string] => [
  `^[\\s\\S]{${min},${max}}$`,
  `${what} must be ${min}–${max} characters.`,
];

const dateField = (name: string, label: string, required: boolean, hint?: string) => ({
  name,
  label,
  widget: "datetime",
  format: "YYYY-MM-DD",
  date_format: "D MMM YYYY",
  time_format: false,
  picker_utc: true,
  required,
  ...(required ? { default: "{{now}}" } : {}),
  ...(hint ? { hint } : {}),
});

export function buildCmsConfig(o: CmsOptions = DEFAULT_CMS_OPTIONS) {
  const maxMb = Math.round(RULES.maxImageBytes / 1024 / 1024);
  return {
    backend: {
      name: "github",
      repo: o.repo,
      branch: o.branch,
      base_url: o.authBaseUrl,
      auth_endpoint: "auth",
      commit_messages: {
        create: 'Publish blog post "{{slug}}"',
        update: 'Update blog post "{{slug}}"',
        delete: 'Delete blog post "{{slug}}"',
        uploadMedia: 'Upload "{{path}}"',
        deleteMedia: 'Delete "{{path}}"',
      },
    },
    site_url: o.siteUrl,
    display_url: o.siteUrl,
    logo_url: `${o.siteUrl}/favicon-270x270.png`,
    locale: "en",
    media_folder: "images",
    public_folder: "/images/blog",
    media_library: { name: "default", config: { max_file_size: RULES.maxImageBytes } },
    slug: { encoding: "ascii", clean_accents: true, sanitize_replacement: "-" },
    collections: [
      {
        name: "blog",
        label: "Blog posts",
        label_singular: "Blog post",
        description: "Write a post, check the preview on the right, then click Publish. It's live on lidr.io in about 3 minutes.",
        folder: "posts",
        create: true,
        delete: false, // retire posts with "Hide this post" or a redirect, never delete (spec §2)
        slug: "{{slug}}",
        extension: "md",
        format: "frontmatter",
        preview_path: "blog/{{slug}}",
        media_folder: "/images/{{slug}}",
        public_folder: "/images/blog/{{slug}}",
        summary: "{{title}} ({{date}})",
        sortable_fields: ["date", "title"],
        fields: [
          {
            name: "title",
            label: "Title",
            widget: "string",
            pattern: lengthPattern(RULES.title.min, RULES.title.max, "The title"),
            hint: `The page heading and the blue link in Google. ${RULES.title.min}–${RULES.title.max} characters.`,
          },
          {
            name: "description",
            label: "Description for Google",
            widget: "text",
            pattern: lengthPattern(RULES.description.min, RULES.description.max, "The description"),
            hint: `One or two sentences shown under the title in Google results. ${RULES.description.min}–${RULES.description.max} characters.`,
          },
          dateField("date", "Publish date", true),
          dateField("updated", "Last updated", false, "Set this to today when you make a real change to a live post."),
          {
            name: "tags",
            label: "Topics",
            widget: "relation",
            collection: "settings",
            file: "tags",
            value_field: "tags.*.slug",
            search_fields: ["tags.*.name"],
            display_fields: ["tags.*.name"],
            multiple: true,
            min: RULES.tags.min,
            max: RULES.tags.max,
            hint: `Pick ${RULES.tags.min}–${RULES.tags.max} topics.`,
          },
          {
            name: "cover",
            label: "Cover photo",
            widget: "image",
            required: false,
            choose_url: false,
            hint: `Optional. JPEG, PNG or WebP up to ${maxMb} MB. Turn off location on your phone's camera before taking site photos.`,
            media_library: { config: { max_file_size: RULES.maxImageBytes } },
          },
          {
            name: "coverAlt",
            label: "Describe the cover photo",
            widget: "string",
            required: false,
            hint: "What the photo shows, for people using screen readers. Needed if you add a cover photo.",
          },
          { name: "draft", label: "Hide this post (draft)", widget: "boolean", default: false, required: false },
          {
            name: "redirectTo",
            label: "Retire this post and send visitors to",
            widget: "string",
            required: false,
            pattern: [REDIRECT_PATTERN.source, "Use a lidr.io path like /blog/another-post/"],
            hint: "Only to retire a post. Leave empty otherwise.",
          },
          {
            name: "body",
            label: "Post",
            widget: "markdown",
            sanitize_preview: true,
            modes: ["rich_text", "raw"],
            buttons: ["bold", "italic", "link", "heading-two", "heading-three", "quote", "bulleted-list", "numbered-list"],
            editor_components: ["image"],
          },
        ],
      },
      {
        name: "settings",
        label: "Settings",
        delete: false,
        editor: { preview: false },
        files: [
          {
            name: "tags",
            label: "Topics",
            file: "tags.yml",
            fields: [
              {
                name: "tags",
                label: "Topics",
                widget: "list",
                summary: "{{fields.name}}",
                fields: [
                  { name: "name", label: "Name", widget: "string" },
                  {
                    name: "slug",
                    label: "Web address part",
                    widget: "string",
                    pattern: [RULES.slugPattern.source, "Lowercase letters, numbers and hyphens only, e.g. site-photos"],
                    hint: "Used in the topic page's address. Never change it once posts use the topic.",
                  },
                  { name: "description", label: "Intro text on the topic page", widget: "text", required: false },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
```

- [ ] **Step 6: Run tests** — `npx vitest run scripts/blog/cms-config.test.ts lib/blog/validate.test.ts` → PASS. `npx tsc --noEmit -p .` → clean.

- [ ] **Step 7: Commit**

```bash
git add lib/blog/validate.ts scripts/blog/cms-config.ts scripts/blog/cms-config.test.ts
git commit -m "feat(blog): generate Decap CMS config from content rules"
```

---

### Task 2: Pipeline — duplicate titles and broken internal links

**Files:** Modify `scripts/blog/pipeline.ts`, `scripts/blog/pipeline.test.ts`

- [ ] **Step 1: Failing tests** — add to `scripts/blog/pipeline.test.ts`. Reuse the file's existing helper for temp content dirs; if there isn't one, write the files with `mkdtempSync`/`writeFileSync` exactly as its other temp-dir tests do.

```ts
describe("content lint", () => {
  test("duplicate titles get a soft problem on each post", async () => {
    const dir = tempContent({
      "a.md": post({ title: "Same title for two posts" }),
      "b.md": post({ title: "Same title for two posts" }),
    });
    const { report } = await buildBlogData({ contentDir: dir, publicDir: tmp() });
    for (const s of ["a", "b"]) {
      expect(report.problems[s].some((p) => p.field === "title" && /another post has the same title/i.test(p.message))).toBe(true);
    }
  });
  test("links to blog posts that don't exist get a soft problem", async () => {
    const dir = tempContent({
      "a.md": post({ body: "See [b](/blog/b/), [gone](/blog/missing-post/), [tag](/blog/tag/safety/) and [abs](https://lidr.io/blog/also-missing)." }),
      "b.md": post({}),
    });
    const { report } = await buildBlogData({ contentDir: dir, publicDir: tmp() });
    const msgs = report.problems["a"].filter((p) => p.field === "links").map((p) => p.message);
    expect(msgs).toHaveLength(2);
    expect(msgs.join(" ")).toMatch(/missing-post/);
    expect(msgs.join(" ")).toMatch(/also-missing/);
  });
});
```

`post({...})` and `tempContent({...})` are small helpers. Add them at the top of the describe block if the file doesn't already have equivalents. `post` returns valid front-matter (title ≥10 characters, a 50–160 character description, a date and one known tag) plus a body. `tempContent` writes `tags.yml` (copied from `tests/fixtures/blog/tags.yml`) and the given posts, and returns the dir.

- [ ] **Step 2: Run to verify failure** — `npx vitest run scripts/blog/pipeline.test.ts -t "content lint"`. Expected: FAIL.

- [ ] **Step 3: Implement** — in `scripts/blog/pipeline.ts`, after the related-posts computation and before the final return, add:

```ts
  // --- content lint (spec §8): duplicate titles, links to missing posts ---
  const byTitle = new Map<string, string[]>();
  for (const p of posts) {
    const k = p.title.trim().toLowerCase();
    byTitle.set(k, [...(byTitle.get(k) ?? []), p.slug]);
  }
  for (const slugs of byTitle.values()) {
    if (slugs.length < 2) continue;
    for (const s of slugs) {
      add(s, [{ level: "soft", field: "title", message: `Another post has the same title (${slugs.filter((x) => x !== s).join(", ")}). Give each post its own title so Google doesn't treat them as duplicates.` }]);
    }
  }
  const liveTargets = new Set([...posts.map((p) => p.slug), ...redirects.map((r) => r.from.replace(/^\/blog\/|\/$/g, ""))]);
  const RESERVED = new Set(["tag", "page", "rss.xml"]);
  const LINK = /href="(?:https:\/\/(?:www\.)?lidr\.io)?\/blog\/([a-z0-9-]+)\/?(?:[#?][^"]*)?"/g;
  for (const p of posts) {
    const missing = new Set<string>();
    for (const m of p.html.matchAll(LINK)) if (!RESERVED.has(m[1]) && !liveTargets.has(m[1])) missing.add(m[1]);
    for (const s of missing) {
      add(p.slug, [{ level: "soft", field: "links", message: `This post links to /blog/${s}/, which doesn't exist. Fix or remove the link.` }]);
    }
  }
```

Use the same `add` helper and `redirects` array the pipeline already has. If the variable names differ, use the existing ones and don't introduce duplicates.

- [ ] **Step 4: Run** — `npx vitest run scripts/blog/pipeline.test.ts` → all PASS. Run the full `npx vitest run` → PASS.

- [ ] **Step 5: Commit** — `git add scripts/blog/pipeline.ts scripts/blog/pipeline.test.ts && git commit -m "feat(blog): warn on duplicate titles and links to missing posts"`

---

### Task 3: "Last updated" reminder (`--since`) and `BLOG_FAIL_ON=hard`

**Files:** Create `scripts/blog/changes.ts`, `scripts/blog/changes.test.ts`. Modify `scripts/blog/prepare.ts`.

- [ ] **Step 1: Failing test** — `scripts/blog/changes.test.ts`

```ts
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { staleUpdatedProblems } from "./changes";

const git = (cwd: string, ...a: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd }).toString().trim();
const fm = (body: string, updated?: string) =>
  `---\ntitle: A post title here\ndescription: ${"d".repeat(60)}\ndate: 2026-11-01\n${updated ? `updated: ${updated}\n` : ""}tags: [safety]\n---\n${body}\n`;

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "chg-"));
  git(dir, "init", "-q");
  mkdirSync(join(dir, "posts"));
  return dir;
}
function commit(dir: string, file: string, text: string) {
  writeFileSync(join(dir, "posts", file), text);
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "x");
  return git(dir, "rev-parse", "HEAD");
}

test("body changed without updated → soft reminder", () => {
  const d = repo();
  const before = commit(d, "p.md", fm("Old text"));
  commit(d, "p.md", fm("New text"));
  const r = staleUpdatedProblems(d, before);
  expect(r.p?.[0]).toMatchObject({ level: "soft", field: "updated" });
});

test("body changed and updated changed → no reminder", () => {
  const d = repo();
  const before = commit(d, "p.md", fm("Old text"));
  commit(d, "p.md", fm("New text", "2026-11-19"));
  expect(staleUpdatedProblems(d, before)).toEqual({});
});

test("only front-matter changed → no reminder; new posts → no reminder", () => {
  const d = repo();
  const before = commit(d, "p.md", fm("Same"));
  commit(d, "p.md", fm("Same").replace("A post title here", "A better post title"));
  commit(d, "new.md", fm("Brand new"));
  expect(staleUpdatedProblems(d, before)).toEqual({});
});

test("bad or unknown sha → no reminder, no throw", () => {
  const d = repo();
  commit(d, "p.md", fm("x"));
  expect(staleUpdatedProblems(d, "0000000000000000000000000000000000000000")).toEqual({});
  expect(staleUpdatedProblems(d, "not-a-sha")).toEqual({});
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run scripts/blog/changes.test.ts` → FAIL.

- [ ] **Step 3: Implement `scripts/blog/changes.ts`**

```ts
import { execFileSync } from "node:child_process";
import { parsePostFile } from "../../lib/blog/validate";
import type { Problem } from "../../lib/blog/types";

const SHA = /^[0-9a-f]{40}$/;
const git = (cwd: string, args: string[]) =>
  execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"], timeout: 30_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).toString();

/**
 * For posts whose TEXT changed since `sinceSha` but whose `updated` date
 * didn't, returns a soft reminder (spec §5). Best effort: any git failure or
 * unknown sha returns {} — a reminder must never break a check run.
 */
export function staleUpdatedProblems(contentDir: string, sinceSha: string): Record<string, Problem[]> {
  if (!SHA.test(sinceSha) || /^0+$/.test(sinceSha)) return {};
  let files: string[];
  try {
    files = git(contentDir, ["diff", "--name-only", "--diff-filter=M", sinceSha, "HEAD", "--", "posts/"])
      .split("\n")
      .filter((f) => /^posts\/[a-z0-9-]+\.md$/.test(f));
  } catch {
    return {};
  }
  const out: Record<string, Problem[]> = {};
  for (const f of files) {
    try {
      const before = parsePostFile(git(contentDir, ["show", `${sinceSha}:${f}`]));
      const after = parsePostFile(git(contentDir, ["show", `HEAD:${f}`]));
      if (!before.ok || !after.ok) continue;
      const textChanged = before.body.trim() !== after.body.trim();
      const updatedSame = String(before.data.updated ?? "") === String(after.data.updated ?? "");
      if (textChanged && updatedSame && after.data.draft !== true) {
        const slug = f.slice("posts/".length, -".md".length);
        out[slug] = [{ level: "soft", field: "updated", message: "You changed this post's text but didn't set 'Last updated'. Set it to today so readers and Google know the post is fresh." }];
      }
    } catch {
      continue;
    }
  }
  return out;
}
```

- [ ] **Step 4: Wire into `scripts/blog/prepare.ts`.** After `buildBlogData` returns and before the report is written:

```ts
  const si = process.argv.indexOf("--since");
  const since = si >= 0 ? process.argv[si + 1] : undefined;
  if (since && contentDir) {
    for (const [slug, ps] of Object.entries(staleUpdatedProblems(contentDir, since))) {
      if (data.posts.some((p) => p.slug === slug)) (report.problems[slug] ??= []).push(...ps);
    }
  }
```

Then, next to the existing `BLOG_STRICT` exit:

```ts
  const hard = Object.values(report.problems).flat().filter((p) => p.level === "hard").length;
  if (process.env.BLOG_FAIL_ON === "hard" && hard > 0) {
    console.error(`blog: ${hard} problem(s) keep posts offline (BLOG_FAIL_ON=hard)`);
    process.exitCode = 1;
  }
```

Import `staleUpdatedProblems` from `./changes`. `contentDir` is the value `resolveContentDir` already returned in `main()`; reuse that variable.

- [ ] **Step 5: Verify**

```bash
npx vitest run scripts/blog/changes.test.ts
BLOG_CONTENT_DIR=tests/fixtures/blog BLOG_FAIL_ON=hard npx tsx scripts/blog/prepare.ts --check; echo "exit=$?"
```

Expected: the tests pass and `exit=1`, because the fixtures' `broken.md` is a hard problem.

- [ ] **Step 6: Commit** — `git add scripts/blog/changes.ts scripts/blog/changes.test.ts scripts/blog/prepare.ts && git commit -m "feat(blog): last-updated reminder and fail-on-hard mode for checks"`

---

### Task 4: `/admin` — editor page, live preview, generated config, security headers

**Files:**
- Create: `public/admin/index.html`, `public/admin/preview.js`, `public/admin/preview.css`
- Modify: `scripts/blog/prepare.ts`, `public/_headers`, `.gitignore`

- [ ] **Step 1: Compute the SRI hash for the pinned bundle**

```bash
curl -fsSL https://cdn.jsdelivr.net/npm/decap-cms@3.18.0/dist/decap-cms.js | openssl dgst -sha384 -binary | openssl base64 -A; echo
```

Copy the output and use it as `sha384-<output>` in Step 2.

- [ ] **Step 2: `public/admin/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Lidr.io blog editor</title>
    <link rel="icon" href="/favicon-32x32.png" />
  </head>
  <body>
    <!-- Pinned version + SRI. To upgrade: change the version in this URL,
         recompute the hash (see docs/blog-setup.md), and update the CSP in
         public/_headers to the same versioned path. -->
    <script
      src="https://cdn.jsdelivr.net/npm/decap-cms@3.18.0/dist/decap-cms.js"
      integrity="sha384-PASTE_HASH_FROM_STEP_1"
      crossorigin="anonymous"
    ></script>
    <script src="/admin/preview.js"></script>
  </body>
</html>
```

Replace `PASTE_HASH_FROM_STEP_1` with the Step 1 output before committing. Confirm with: `grep -c PASTE_HASH public/admin/index.html` → `0`.

- [ ] **Step 3: `public/admin/preview.js`.** It uses Decap's global `createClass`/`h`, so no build step is needed.

```js
/* Live preview for blog posts in the editor. Mirrors the post page closely
   enough for authors to judge layout; the real page is built by Next.js. */
/* global CMS, createClass, h */
(function () {
  CMS.registerPreviewStyle("/admin/preview.css");
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function formatDate(v) {
    if (!v) return "";
    var p = String(v).slice(0, 10).split("-");
    var m = MONTHS[Number(p[1]) - 1];
    return m ? Number(p[2]) + " " + m + " " + p[0] : String(v);
  }
  var PostPreview = createClass({
    render: function () {
      var entry = this.props.entry;
      var get = function (k) { return entry.getIn(["data", k]); };
      var cover = get("cover");
      var coverAsset = cover ? this.props.getAsset(cover) : null;
      var updated = get("updated");
      return h(
        "article",
        { className: "post" },
        get("draft") ? h("p", { className: "notice" }, "Hidden: this post won't appear on lidr.io while 'Hide this post' is on.") : null,
        get("redirectTo") ? h("p", { className: "notice" }, "Retired: visitors will be sent to " + get("redirectTo")) : null,
        h("p", { className: "crumb" }, "Blog"),
        h("h1", { className: "title" }, get("title") || "Untitled post"),
        h("div", { className: "bar" }),
        h("p", { className: "meta" }, formatDate(get("date")), updated ? h("span", null, "Updated " + formatDate(updated)) : null),
        coverAsset ? h("img", { className: "cover", src: coverAsset.toString(), alt: get("coverAlt") || "" }) : null,
        h("div", { className: "prose" }, this.props.widgetFor("body"))
      );
    },
  });
  CMS.registerPreviewTemplate("blog", PostPreview);
})();
```

- [ ] **Step 4: `public/admin/preview.css`.** The colours and sizes mirror `styles/tokens.css`; the fonts are copied in by prepare (Step 5).

```css
/* Editor preview styles. Values mirror styles/tokens.css and
   components/Prose/Prose.module.css — keep in sync if those change. */
@font-face { font-family: "Amenti"; src: url("/admin/fonts/Amenti-Medium.woff2") format("woff2"); font-weight: 500; font-display: swap; }
@font-face { font-family: "Montserrat"; src: url("/admin/fonts/Montserrat-Variable-latin.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }
body { margin: 0; background: #fff; color: #2a2a2a; font-family: "Montserrat", -apple-system, "Segoe UI", sans-serif; font-size: 17px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
.post { max-width: 728px; margin: 0 auto; padding: 32px 15px 60px; }
.notice { background: #f2e32b; color: #1f1f1f; padding: 10px 14px; border-radius: 10px; font-size: 14px; font-weight: 600; }
.crumb { color: #555; font-size: 14px; margin: 0 0 16px; }
.title { font-family: "Amenti", serif; font-weight: 500; color: #192c27; font-size: 40px; line-height: 1.12; margin: 0; overflow-wrap: anywhere; }
.bar { width: 64px; height: 4px; background: #f2e32b; margin: 20px 0; }
.meta { display: flex; gap: 16px; color: #555; font-size: 14px; margin: 0 0 30px; }
.cover { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 20px; margin-bottom: 40px; }
.prose h2, .prose h3, .prose h4 { font-family: "Amenti", serif; font-weight: 500; color: #192c27; line-height: 1.5; margin: 1.5em 0 0.5em; }
.prose h2 { font-size: 35px; } .prose h3 { font-size: 30px; } .prose h4 { font-size: 25px; }
.prose p { margin: 0 0 1em; }
.prose ul, .prose ol { margin: 0 0 1em; padding-left: 2em; }
.prose a { color: #192c27; text-decoration: underline; }
.prose img { display: block; width: 100%; height: auto; border-radius: 15px; margin: 24px 0; }
.prose blockquote { margin: 24px 0; padding: 4px 0 4px 20px; border-left: 4px solid #192c27; color: #192c27; font-family: "Amenti", serif; font-size: 18px; }
.prose table { border-collapse: collapse; width: 100%; font-size: 16px; }
.prose th, .prose td { border: 1px solid #eee; padding: 8px 12px; text-align: left; }
.prose th { background: #f5f5f5; }
@media (max-width: 689px) { .title { font-size: 30px; } }
```

- [ ] **Step 5: Generate the admin config and copy the fonts in `scripts/blog/prepare.ts`** (non-check mode, after the `_blog.png` render):

```ts
  // Editor files (spec §7). Generated every build so the editor's limits always match RULES.
  const adminDir = join(cwd, "public", "admin");
  mkdirSync(join(adminDir, "fonts"), { recursive: true });
  writeFileSync(
    join(adminDir, "config.yml"),
    "# GENERATED by scripts/blog/prepare.ts from lib/blog/rules.ts. Do not edit.\n" +
      stringifyYaml(
        buildCmsConfig({
          ...DEFAULT_CMS_OPTIONS,
          ...(process.env.BLOG_CMS_REPO ? { repo: process.env.BLOG_CMS_REPO } : {}),
          ...(process.env.BLOG_CMS_AUTH_URL ? { authBaseUrl: process.env.BLOG_CMS_AUTH_URL } : {}),
        })
      )
  );
  for (const f of ["Amenti-Medium.woff2", "Montserrat-Variable-latin.woff2"]) {
    copyFileSync(join(cwd, "app", "fonts", f), join(adminDir, "fonts", f));
  }
```

Imports: `copyFileSync` from `node:fs`, `{ stringify as stringifyYaml }` from `"yaml"`, and `{ buildCmsConfig, DEFAULT_CMS_OPTIONS }` from `"./cms-config"`.

- [ ] **Step 6: `.gitignore`** — append:

```gitignore
/public/admin/config.yml
/public/admin/fonts/
```

- [ ] **Step 7: `public/_headers`** — append (keep the existing entries):

```
# Blog editor (spec §9). Script sources are pinned to the exact Decap version
# loaded by public/admin/index.html — update both together.
/admin/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net/npm/decap-cms@3.18.0/; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://raw.githubusercontent.com https://avatars.githubusercontent.com; connect-src 'self' https://api.github.com https://cms-auth.lidr.io https://cdn.jsdelivr.net; font-src 'self' data:; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
  X-Robots-Tag: noindex, nofollow
  X-Frame-Options: DENY
  Referrer-Policy: same-origin
  Cache-Control: no-store
```

- [ ] **Step 8: Verify locally** — `npm run build` (blog disabled). Then:

```bash
ls out/admin && head -3 out/admin/config.yml && grep -A1 "^/admin" out/_headers
```

Expected: `index.html`, `preview.js`, `preview.css`, `config.yml` and `fonts/` are present. The config starts with the GENERATED comment and contains `repo: lidradmin/lidr-blog`. The CSP block is present.

- [ ] **Step 9: Commit** — `git add public/admin/index.html public/admin/preview.js public/admin/preview.css public/_headers .gitignore scripts/blog/prepare.ts && git commit -m "feat(blog): /admin editor with live preview, generated config and strict CSP"`

---

### Task 5: OAuth Worker (`workers/cms-auth`)

**Files:**
- Create: `workers/cms-auth/src/index.ts`, `workers/cms-auth/src/index.test.ts`, `workers/cms-auth/wrangler.toml`, `workers/cms-auth/README.md`
- Modify: `vitest.config.mts` (include `"workers/**/*.test.ts"`)

- [ ] **Step 1: Failing tests** — `workers/cms-auth/src/index.test.ts`

```ts
import { describe, expect, test, vi } from "vitest";
import { handle, type Env } from "./index";

const env: Env = { GITHUB_CLIENT_ID: "cid", GITHUB_CLIENT_SECRET: "secret", ALLOWED_ORIGIN: "https://lidr.io" };
const BASE = "https://cms-auth.lidr.io";

describe("/auth", () => {
  test("redirects to GitHub with state cookie", async () => {
    const res = await handle(new Request(`${BASE}/auth?provider=github&site_id=lidr.io&scope=repo`), env);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("Location")!);
    expect(loc.origin + loc.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(loc.searchParams.get("client_id")).toBe("cid");
    expect(loc.searchParams.get("redirect_uri")).toBe(`${BASE}/callback`);
    const state = loc.searchParams.get("state")!;
    expect(state).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("Set-Cookie")).toContain(`cms_oauth_state=${state}`);
    expect(res.headers.get("Set-Cookie")).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  });
  test("rejects other providers", async () => {
    expect((await handle(new Request(`${BASE}/auth?provider=gitlab`), env)).status).toBe(400);
  });
});

describe("/callback", () => {
  const cb = (q: string, cookie?: string) =>
    new Request(`${BASE}/callback?${q}`, { headers: cookie ? { Cookie: cookie } : {} });

  test("state mismatch → error message, no token exchange", async () => {
    const fetcher = vi.fn();
    const res = await handle(cb("code=c&state=a", "cms_oauth_state=b"), env, fetcher);
    const html = await res.text();
    expect(fetcher).not.toHaveBeenCalled();
    expect(html).toContain("authorization:github:error:");
  });

  test("success posts the token only to the allowed origin, after the handshake", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "tok</script>x" })));
    const res = await handle(cb("code=c&state=s1", "other=1; cms_oauth_state=s1"), env, fetcher);
    const html = await res.text();
    expect(fetcher).toHaveBeenCalledWith("https://github.com/login/oauth/access_token", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).toMatchObject({ client_id: "cid", client_secret: "secret", code: "c" });
    expect(html).toContain('"https://lidr.io"');
    expect(html).toContain('postMessage("authorizing:github",origin)');
    expect(html).not.toContain("</script>x"); // token is JSON-escaped (<)
    expect(html).toContain("authorization:github:success:");
    const csp = res.headers.get("Content-Security-Policy")!;
    expect(csp).toMatch(/default-src 'none'; script-src 'nonce-[0-9a-f]+'/);
    expect(html).toMatch(/<script nonce="[0-9a-f]+">/);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  test("GitHub error → error message", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "bad_verification_code", error_description: "The code passed is incorrect or expired." })));
    const html = await (await handle(cb("code=c&state=s", "cms_oauth_state=s"), env, fetcher)).text();
    expect(html).toContain("authorization:github:error:");
    expect(html).toContain("incorrect or expired");
  });

  test("network failure → error message", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("down"));
    const html = await (await handle(cb("code=c&state=s", "cms_oauth_state=s"), env, fetcher)).text();
    expect(html).toContain("authorization:github:error:");
  });
});

test("unknown path → 404", async () => {
  expect((await handle(new Request(`${BASE}/`), env)).status).toBe(404);
});
```

- [ ] **Step 2: Update `vitest.config.mts`** — `include: ["lib/**/*.test.ts", "scripts/**/*.test.ts", "workers/**/*.test.ts"]`. Run `npx vitest run workers` → FAIL (module missing).

- [ ] **Step 3: Implement `workers/cms-auth/src/index.ts`**

```ts
/**
 * GitHub OAuth for the Decap CMS editor at lidr.io/admin (spec §9).
 * Implements Decap's popup handshake (decap-cms-lib-auth):
 *   popup → opener: "authorizing:github"; opener echoes it back (only if the
 *   popup's origin matches backend.base_url); popup → opener:
 *   "authorization:github:success:{token,provider}" — sent ONLY to ALLOWED_ORIGIN.
 * Uses a GitHub App installed only on lidradmin/lidr-blog, so tokens can only
 * touch that repo.
 */
export interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_ORIGIN: string;
}

const STATE_COOKIE = "cms_oauth_state";

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env);
  },
};

export async function handle(req: Request, env: Env, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === "/auth") return startAuth(url, env);
  if (url.pathname === "/callback") return finishAuth(req, url, env, fetcher);
  return new Response("Not found", { status: 404 });
}

function startAuth(url: URL, env: Env): Response {
  if (url.searchParams.get("provider") !== "github") return new Response("Unsupported provider", { status: 400 });
  const state = crypto.randomUUID();
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  gh.searchParams.set("redirect_uri", `${url.origin}/callback`);
  gh.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: gh.toString(),
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}

async function finishAuth(req: Request, url: URL, env: Env, fetcher: typeof fetch): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = readCookie(req.headers.get("Cookie"), STATE_COOKIE);
  if (!code || !state || !expected || state !== expected) {
    return page(env, "error", { message: "The sign-in expired or didn't match. Close this window and click Login again." });
  }
  try {
    const res = await fetcher("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "lidr-cms-auth" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${url.origin}/callback` }),
    });
    const data = (await res.json()) as { access_token?: string; error_description?: string };
    if (!data.access_token) return page(env, "error", { message: data.error_description || "GitHub didn't return a sign-in token." });
    return page(env, "success", { token: data.access_token, provider: "github" });
  } catch {
    return page(env, "error", { message: "Couldn't reach GitHub. Close this window and try again." });
  }
}

function page(env: Env, status: "success" | "error", payload: Record<string, string>): Response {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const js = (v: string) => JSON.stringify(v).replace(/</g, "\\u003c");
  const html =
    `<!doctype html><meta charset="utf-8"><title>Signing in…</title>` +
    `<p style="font-family:sans-serif">Signing you in… This window closes by itself.</p>` +
    `<script nonce="${nonce}">(function(){var origin=${js(env.ALLOWED_ORIGIN)};var msg=${js(message)};` +
    `if(!window.opener){document.body.textContent="Open the editor at "+origin+"/admin/ and sign in from there.";return;}` +
    `function receive(e){if(e.origin!==origin)return;window.removeEventListener("message",receive);window.opener.postMessage(msg,origin);}` +
    `window.addEventListener("message",receive);window.opener.postMessage("authorizing:github",origin);})();</script>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`,
      "Set-Cookie": `${STATE_COOKIE}=; Path=/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}
```

- [ ] **Step 4: `workers/cms-auth/wrangler.toml`**

```toml
name = "lidr-cms-auth"
main = "src/index.ts"
compatibility_date = "2026-11-01"
workers_dev = false

[vars]
ALLOWED_ORIGIN = "https://lidr.io"

# Secrets (set with `npx wrangler@4 secret put …`, never committed):
#   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
# Custom domain cms-auth.lidr.io: add under the Worker's Settings → Domains & Routes.
```

- [ ] **Step 5: `workers/cms-auth/README.md`.** Three short sections:
  - **What this is:** the link to spec §9 and a summary of the handshake.
  - **Deploy:** `cd workers/cms-auth && npx wrangler@4 login && npx wrangler@4 secret put GITHUB_CLIENT_ID && npx wrangler@4 secret put GITHUB_CLIENT_SECRET && npx wrangler@4 deploy`, then add the custom domain.
  - **Test:** `npx vitest run workers` from the repo root.

- [ ] **Step 6: Verify** — `npx vitest run workers` → all pass. `npx tsc --noEmit -p .` → clean. Next type-checks `workers/` too; if `Request`/`Response`/`crypto` types are missing, they come from `@types/node`'s globals, which are already present.

- [ ] **Step 7: Commit** — `git add workers/cms-auth vitest.config.mts && git commit -m "feat(blog): GitHub OAuth Worker for the CMS editor"`

---

### Task 6: Issue notifier (`scripts/blog/notify.ts`)

**Files:** Create `scripts/blog/notify.ts`, `scripts/blog/notify.test.ts`

- [ ] **Step 1: Failing tests** — `scripts/blog/notify.test.ts`

```ts
import { describe, expect, test } from "vitest";
import type { BlogReport } from "../../lib/blog/types";
import { groupProblems, planActions, renderBody, type OpenIssue } from "./notify";

const ctx = { sha: "abcdef1234567890", author: "writer1", owner: "boss", adminUrl: "https://lidr.io/admin/" };
const report: BlogReport = {
  problems: {
    "post-a": [
      { level: "hard", field: "title", message: "The post has no title." },
      { level: "soft", field: "description", message: "Too long.", detail: "raw" },
    ],
    _tags: [{ level: "soft", field: "tags.yml", message: "Tag list broken." }],
    _images: [{ level: "soft", field: "images", message: "Orphan folder." }],
  },
};

test("groups underscore keys into one setup issue", () => {
  const g = groupProblems(report);
  expect(Object.keys(g).sort()).toEqual(["_setup", "post-a"]);
  expect(g._setup).toHaveLength(2);
});

test("body: plain English, hard first, author + owner mentioned, edit link, marker", () => {
  const body = renderBody("post-a", report.problems["post-a"], ctx);
  expect(body).toContain("<!-- blog-check:post-a:");
  expect(body).toContain("@writer1");
  expect(body).toContain("@boss");
  expect(body.indexOf("no title")).toBeLessThan(body.indexOf("Too long"));
  expect(body).toContain("https://lidr.io/admin/#/collections/blog/entries/post-a");
  expect(body).toContain("<details>");
});

test("creates new issues, updates changed ones, closes fixed ones, leaves unchanged alone", () => {
  const unchangedBody = renderBody("post-c", [{ level: "soft", field: "x", message: "Same." }], ctx);
  const open: OpenIssue[] = [
    { number: 1, body: renderBody("post-a", [{ level: "soft", field: "x", message: "Old." }], ctx) },
    { number: 2, body: renderBody("post-b", [{ level: "soft", field: "x", message: "Fixed now." }], ctx) },
    { number: 3, body: unchangedBody },
    { number: 4, body: "unrelated issue without marker" },
  ];
  const r: BlogReport = { problems: { ...report.problems, "post-c": [{ level: "soft", field: "x", message: "Same." }] } };
  const actions = planActions(r, open, ctx);
  expect(actions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "update", number: 1 }),
      expect.objectContaining({ kind: "close", number: 2 }),
      expect.objectContaining({ kind: "create", key: "_setup", title: "Blog setup needs attention", assignees: ["boss"] }),
    ])
  );
  expect(actions.find((a) => "number" in a && a.number === 3)).toBeUndefined();
  expect(actions.find((a) => "number" in a && a.number === 4)).toBeUndefined();
  const createPost = planActions({ problems: { "post-z": [{ level: "soft", field: "x", message: "y" }] } }, [], ctx)[0];
  expect(createPost).toMatchObject({ kind: "create", title: "Post needs attention: post-z", assignees: ["writer1"] });
});

test("no author → assign owner", () => {
  const a = planActions({ problems: { p: [{ level: "soft", field: "x", message: "y" }] } }, [], { ...ctx, author: "" })[0];
  expect(a).toMatchObject({ assignees: ["boss"] });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run scripts/blog/notify.test.ts` → FAIL.

- [ ] **Step 3: Implement `scripts/blog/notify.ts`**

```ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { BlogReport, Problem } from "../../lib/blog/types";

/**
 * Turns a blog check report into GitHub Issues on the content repo (spec §8):
 * one issue per post with problems (assigned to the commit author), one
 * "Blog setup needs attention" issue for non-post problems (assigned to the
 * owner), updated when the problems change, closed when they're fixed.
 * Only issues carrying our hidden marker are ever touched.
 */
export const LABEL = "blog-check";
export type Ctx = { sha: string; author: string; owner: string; adminUrl: string };
export type OpenIssue = { number: number; body: string };
export type Action =
  | { kind: "create"; key: string; title: string; body: string; assignees: string[] }
  | { kind: "update"; number: number; body: string }
  | { kind: "close"; number: number; comment: string };

const MARKER = /<!-- blog-check:([a-z0-9_-]+):([0-9a-f]{12}) -->/;

export function groupProblems(report: BlogReport): Record<string, Problem[]> {
  const out: Record<string, Problem[]> = {};
  for (const [key, ps] of Object.entries(report.problems)) {
    if (!ps.length) continue;
    const k = key.startsWith("_") ? "_setup" : key;
    (out[k] ??= []).push(...ps);
  }
  return out;
}

const fingerprint = (ps: Problem[]) =>
  createHash("sha256").update(JSON.stringify(ps.map((p) => [p.level, p.field, p.message]))).digest("hex").slice(0, 12);

const titleFor = (key: string) => (key === "_setup" ? "Blog setup needs attention" : `Post needs attention: ${key}`);

export function renderBody(key: string, problems: Problem[], ctx: Ctx): string {
  const hard = problems.filter((p) => p.level === "hard");
  const soft = problems.filter((p) => p.level === "soft");
  const who = key === "_setup" ? `@${ctx.owner}` : ctx.author ? `@${ctx.author}` : `@${ctx.owner}`;
  const lines = [
    `<!-- blog-check:${key}:${fingerprint(problems)} -->`,
    key === "_setup"
      ? `${who}, the blog checker found a problem with the blog's settings or photo folders (commit ${ctx.sha.slice(0, 7)}).`
      : `Hi ${who}, the blog checker found something in **${key}** (commit ${ctx.sha.slice(0, 7)}).`,
    "",
  ];
  if (hard.length) {
    lines.push("**Your latest change isn't live yet.** Fix these first:", ...hard.map((p) => `- ${p.message}`), "");
  }
  if (soft.length) {
    lines.push(hard.length ? "**Also worth fixing:**" : "**The post is live, but these are worth fixing:**", ...soft.map((p) => `- ${p.message}`), "");
  }
  if (key !== "_setup") lines.push(`Open it in the editor: ${ctx.adminUrl}#/collections/blog/entries/${key}`, "");
  const details = problems.filter((p) => p.detail);
  if (details.length) {
    lines.push("<details><summary>Technical details (for the site owner)</summary>", "", ...details.map((p) => `- \`${p.field}\`: ${p.detail}`), "", "</details>", "");
  }
  lines.push(`This issue updates and closes itself when the problems are fixed. cc @${ctx.owner}`);
  return lines.join("\n");
}

export function planActions(report: BlogReport, open: OpenIssue[], ctx: Ctx): Action[] {
  const groups = groupProblems(report);
  const byKey = new Map<string, OpenIssue & { fp: string }>();
  for (const i of open) {
    const m = i.body?.match(MARKER);
    if (m) byKey.set(m[1], { ...i, fp: m[2] });
  }
  const actions: Action[] = [];
  for (const [key, ps] of Object.entries(groups)) {
    const existing = byKey.get(key);
    const body = renderBody(key, ps, ctx);
    if (!existing) {
      const assignee = key === "_setup" ? ctx.owner : ctx.author || ctx.owner;
      actions.push({ kind: "create", key, title: titleFor(key), body, assignees: [assignee] });
    } else if (existing.fp !== fingerprint(ps)) {
      actions.push({ kind: "update", number: existing.number, body });
    }
  }
  for (const [key, i] of byKey) {
    if (!groups[key]) actions.push({ kind: "close", number: i.number, comment: `Fixed. The checker found no problems at commit ${ctx.sha.slice(0, 7)}. Thanks!` });
  }
  return actions;
}

// ---------------- CLI (runs in the content repo's GitHub Action) ----------------
async function gh(repo: string, token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
  });
  if (!res.ok && res.status !== 422) throw new Error(`GitHub API ${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res;
}

async function main() {
  const arg = (n: string) => {
    const i = process.argv.indexOf(n);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const report = JSON.parse(readFileSync(arg("--report")!, "utf8")) as BlogReport;
  const hard = Object.values(report.problems).flat().filter((p) => p.level === "hard").length;
  if (process.argv.includes("--fail-on-hard")) {
    if (hard) {
      console.error(`${hard} problem(s) keep posts offline. See the repo's Issues for details.`);
      process.exit(1);
    }
    return;
  }
  const repo = arg("--repo")!;
  const token = process.env.GITHUB_TOKEN!;
  const ctx: Ctx = { sha: arg("--sha") ?? "", author: process.env.BLOG_AUTHOR ?? "", owner: process.env.BLOG_OWNER || "lidradmin", adminUrl: "https://lidr.io/admin/" };
  await gh(repo, token, "/labels", { method: "POST", body: JSON.stringify({ name: LABEL, color: "f2e32b", description: "Automatic blog checker" }) });
  const open = (await (await gh(repo, token, `/issues?labels=${LABEL}&state=open&per_page=100`)).json()) as OpenIssue[];
  const actions = planActions(report, open, ctx);
  for (const a of actions) {
    if (process.env.DRY_RUN === "1") {
      console.log(JSON.stringify(a));
      continue;
    }
    if (a.kind === "create") {
      const res = await gh(repo, token, "/issues", { method: "POST", body: JSON.stringify({ title: a.title, body: a.body, labels: [LABEL], assignees: a.assignees }) });
      if (res.status === 422) {
        // e.g. the assignee can't be assigned: create without assignee
        await gh(repo, token, "/issues", { method: "POST", body: JSON.stringify({ title: a.title, body: a.body, labels: [LABEL] }) });
      }
    } else if (a.kind === "update") {
      await gh(repo, token, `/issues/${a.number}`, { method: "PATCH", body: JSON.stringify({ body: a.body }) });
    } else {
      await gh(repo, token, `/issues/${a.number}/comments`, { method: "POST", body: JSON.stringify({ body: a.comment }) });
      await gh(repo, token, `/issues/${a.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "completed" }) });
    }
  }
  console.log(`notify: ${actions.length} issue action(s)`);
}

if (process.argv[1]?.endsWith("notify.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run** — `npx vitest run scripts/blog/notify.test.ts` → PASS. `npx tsc --noEmit -p .` → clean.

- [ ] **Step 5: Dry run against the fixtures**

```bash
BLOG_CONTENT_DIR=tests/fixtures/blog npx tsx scripts/blog/prepare.ts --check --report /tmp/r.json
npx tsx scripts/blog/notify.ts --report /tmp/r.json --fail-on-hard; echo "exit=$?"
```

Expected: `exit=1` and the message about posts offline. That's correct, because `broken.md` has a hard problem.

- [ ] **Step 6: Commit** — `git add scripts/blog/notify.ts scripts/blog/notify.test.ts && git commit -m "feat(blog): plain-English GitHub issue notifications for blog problems"`

---

### Task 7: Site CI — check live content whenever blog code changes

**Files:** Create `.github/workflows/blog-content.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Blog code vs live content
on:
  pull_request:
    paths: ["lib/blog/**", "scripts/blog/**", "app/blog/**", "components/blog/**", "workers/**", "package-lock.json"]
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: blog-content-${{ github.ref }}
  cancel-in-progress: true
jobs:
  check:
    # GitHub-hosted only: never run this public repo's jobs on self-hosted runners.
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
        env:
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1"
      - run: npx vitest run
      - name: Clone live blog content
        run: git clone --quiet --filter=blob:none https://github.com/lidradmin/lidr-blog.git "$RUNNER_TEMP/content"
      - name: Live content still builds with this change (no post may go offline)
        env:
          BLOG_CONTENT_DIR: ${{ runner.temp }}/content
          BLOG_FAIL_ON: hard
        run: npx tsx scripts/blog/prepare.ts --check --report "$RUNNER_TEMP/report.json"
```

- [ ] **Step 2: Validate the syntax** — `npx --yes yaml-lint .github/workflows/blog-content.yml || python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/blog-content.yml'))"` → no error.

- [ ] **Step 3: Commit** — `git add .github/workflows/blog-content.yml && git commit -m "ci(blog): check live content against blog code changes"`

The clone step fails until the content repo exists (Task 9). That's expected; the workflow only runs on blog-code PRs.

---

### Task 8: Owner runbook `docs/blog-setup.md`

**Files:** Create `docs/blog-setup.md`

- [ ] **Step 1: Write the runbook** with exactly these sections and commands. Write it as a plain checklist in second person ("you"):

1. **Create the content repo.** As `lidradmin`: GitHub → New repository → `lidr-blog`, Public, no README. Then push the prepared scaffold (`git remote add origin https://github.com/lidradmin/lidr-blog.git && git push -u origin main` from `/Users/conor.mullan/Documents/lidr-blog`). Settings → Actions → General:
   - "Fork pull request workflows from outside collaborators" → "Require approval for all outside collaborators".
   - Workflow permissions: "Read repository contents".
   Settings → Variables → Actions: set `BLOG_OWNER` to the GitHub username that should be mentioned on problems.
2. **Create the GitHub App (editor login).** As `lidradmin`: Settings → Developer settings → GitHub Apps → New.
   - Name: `Lidr Blog Editor`.
   - Homepage: `https://lidr.io/admin/`.
   - Callback URL: `https://cms-auth.lidr.io/callback`.
   - Untick "Expire user authorization tokens" only if 8-hour logins annoy authors. Leaving it ticked is more secure.
   - Webhook: off.
   - Repository permissions: Contents **Read and write**, Metadata **Read-only**. Nothing else.
   - "Where can this GitHub App be installed": Only on this account.
   Then:
   - Create it and note the **Client ID**.
   - Generate a **client secret**.
   - Install the App on **only** `lidradmin/lidr-blog`.
3. **Deploy the login Worker.**
   - From the site repo: `cd workers/cms-auth && npx wrangler@4 login && npx wrangler@4 secret put GITHUB_CLIENT_ID && npx wrangler@4 secret put GITHUB_CLIENT_SECRET && npx wrangler@4 deploy`.
   - Cloudflare → Workers → `lidr-cms-auth` → Settings → Domains & Routes → add custom domain `cms-auth.lidr.io`.
   - Check: `curl -sI "https://cms-auth.lidr.io/auth?provider=github" | grep -i location` shows a `github.com/login/oauth/authorize` URL.
4. **Connect the site to the content.**
   - Cloudflare Pages → `lidr-io` → Settings → Variables and secrets → add `BLOG_CONTENT_REPO` = `https://github.com/lidradmin/lidr-blog.git` (Production **and** Preview).
   - Settings → Build → Deploy Hooks → add hook `blog-content` on branch `main` and copy its URL.
   - In `lidradmin/lidr-blog` → Settings → Secrets → Actions → add `CF_DEPLOY_HOOK` = that URL.
   - Trigger a deploy (Deployments → Retry latest). The build log must show `blog: N post(s)…`, not `disabled`.
5. **Invite authors.** `lidr-blog` → Settings → Collaborators → add each author's GitHub username with **Write**. Authors are never added to `lidr.io`.
6. **Google Search Console.** Add the property `https://lidr.io` (DNS verification via Cloudflare), then Sitemaps → submit `https://lidr.io/sitemap.xml`.
7. **Upgrading Decap later.**
   - Change the version in `public/admin/index.html`.
   - Recompute the SRI with `curl -fsSL https://cdn.jsdelivr.net/npm/decap-cms@X.Y.Z/dist/decap-cms.js | openssl dgst -sha384 -binary | openssl base64 -A`.
   - Update the versioned path in the `/admin/*` CSP in `public/_headers`.
8. **If something goes wrong.**
   - **A failed site build** leaves the previous version live. Check the Cloudflare build log; `blog:` lines name the problem.
   - **A "Could not fetch blog content"** error means the content repo URL or GitHub was unreachable. Retry the deploy.
   - **Authors can't log in:** check the Worker's custom domain, the GitHub App callback URL, and that the App is installed on `lidr-blog`.

- [ ] **Step 2: Commit** — `git add docs/blog-setup.md && git commit -m "docs(blog): owner setup runbook"`

---

### Task 9: Content repo scaffold (`/Users/conor.mullan/Documents/lidr-blog`)

**Files:** all new, in a NEW local git repo (not inside lidr.io).

- [ ] **Step 1: Init**

```bash
mkdir -p /Users/conor.mullan/Documents/lidr-blog && cd /Users/conor.mullan/Documents/lidr-blog && git init -q -b main
mkdir -p posts images .github/workflows scripts docs .claude/skills/new-blog-post
touch posts/.gitkeep images/.gitkeep
```

- [ ] **Step 2: `tags.yml`.** These are the starting topics; authors edit them in the editor (Settings → Topics).

```yaml
tags:
  - slug: site-photos
    name: Site photos
    description: How to capture site photos that are clear, timestamped and easy to find later.
  - slug: reporting
    name: Reporting
    description: Turning site photos into reports clients and inspectors trust.
  - slug: safety
    name: Safety
    description: Using photo records to support safety checks and toolbox talks.
```

- [ ] **Step 3: `.github/workflows/check.yml`**

```yaml
name: Blog check
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
  issues: write
concurrency:
  group: blog-check-${{ github.ref }}
  cancel-in-progress: true
jobs:
  check:
    runs-on: ubuntu-latest # GitHub-hosted only
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          path: content
          fetch-depth: 0
      - uses: actions/checkout@v4
        with:
          repository: lidradmin/lidr.io
          ref: main
          path: site
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: site/package-lock.json
      - run: npm ci
        working-directory: site
        env:
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1"
      - name: Check posts
        working-directory: site
        env:
          BLOG_CONTENT_DIR: ${{ github.workspace }}/content
          BEFORE: ${{ github.event.before }}
        run: |
          SINCE=""
          if [ "${{ github.event_name }}" = "push" ] && [ -n "$BEFORE" ] && [ "$BEFORE" != "0000000000000000000000000000000000000000" ]; then SINCE="--since $BEFORE"; fi
          npx tsx scripts/blog/prepare.ts --check --report "$GITHUB_WORKSPACE/report.json" $SINCE
      - name: Tell authors (GitHub Issues)
        if: github.event_name == 'push'
        working-directory: site
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          BLOG_AUTHOR: ${{ github.event.head_commit.author.username }}
          BLOG_OWNER: ${{ vars.BLOG_OWNER }}
        run: npx tsx scripts/blog/notify.ts --report "$GITHUB_WORKSPACE/report.json" --repo "$GITHUB_REPOSITORY" --sha "$GITHUB_SHA"
      - name: Fail if a post can't go live
        working-directory: site
        run: npx tsx scripts/blog/notify.ts --report "$GITHUB_WORKSPACE/report.json" --fail-on-hard
```

- [ ] **Step 4: `.github/workflows/publish.yml`**

```yaml
name: Publish to lidr.io
on:
  push:
    branches: [main]
    paths: ["posts/**", "images/**", "tags.yml"]
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: publish
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest # GitHub-hosted only
    timeout-minutes: 5
    steps:
      - name: Rebuild lidr.io with the new content
        env:
          HOOK: ${{ secrets.CF_DEPLOY_HOOK }}
        run: |
          test -n "$HOOK" || { echo "CF_DEPLOY_HOOK secret is not set (see lidr.io docs/blog-setup.md)"; exit 1; }
          curl -fsS -X POST "$HOOK" > /dev/null
          echo "Build started. Live in about 3 minutes."
```

- [ ] **Step 5: `scripts/check.sh`** (then `chmod +x scripts/check.sh`)

```bash
#!/usr/bin/env bash
# Checks this repo's posts with the real lidr.io validator (strict: any problem fails).
# Used by the Claude Code skill and by anyone who edits files directly.
set -euo pipefail
CONTENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="${LIDR_SITE_DIR:-$HOME/.cache/lidr-site}"
if [ -d "$SITE_DIR/.git" ]; then
  git -C "$SITE_DIR" fetch --quiet --depth 1 origin main
  git -C "$SITE_DIR" reset --quiet --hard origin/main
else
  git clone --quiet --depth 1 https://github.com/lidradmin/lidr.io.git "$SITE_DIR"
fi
cd "$SITE_DIR"
LOCK_HASH="$(shasum -a 256 package-lock.json | cut -d' ' -f1)"
if [ ! -f node_modules/.lidr-lock-hash ] || [ "$(cat node_modules/.lidr-lock-hash)" != "$LOCK_HASH" ]; then
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --silent --no-audit --no-fund
  echo "$LOCK_HASH" > node_modules/.lidr-lock-hash
fi
BLOG_CONTENT_DIR="$CONTENT_DIR" BLOG_STRICT=1 npx tsx scripts/blog/prepare.ts --check
```

- [ ] **Step 6: `.claude/skills/new-blog-post/SKILL.md`**

````markdown
---
name: new-blog-post
description: Write, check and publish a lidr.io blog post end to end. Use when asked to write, draft or publish a blog post or article for lidr.io.
---

# Publish a lidr.io blog post

Posts go live on https://lidr.io/blog/ about 3 minutes after you push to `main`. Nobody reviews them, so you are the review: follow every step.

## 1. Start clean
```bash
git fetch origin && git worktree add -B post/$(date +%s) ../lidr-blog-post origin/main && cd ../lidr-blog-post
```
Work only in this worktree. You may only create or change `posts/<slug>.md`, files under `images/<slug>/`, and `tags.yml`. Never edit anything else.

## 2. Pick a topic nobody has covered
- Read every file in `posts/` (titles, descriptions, headings) and `tags.yml`.
- Choose a topic and ONE target search phrase that no existing post targets. If the user's topic overlaps an existing post, say so and suggest updating that post instead.

## 3. Write the post: `posts/<slug>.md`
- `<slug>`: lowercase words joined by hyphens, e.g. `photo-evidence-for-snagging`. It becomes the URL forever. Choose carefully.
- Front-matter (exact keys):
```yaml
---
title: 10–70 characters, includes the target phrase
description: 50–160 characters, the sentence Google shows under the title
date: YYYY-MM-DD (today)
tags: [one-to-three, existing-tag-slugs]
---
```
- Optional: `cover: /images/blog/<slug>/<file>.jpg` plus `coverAlt: what the photo shows`. Only use real photos the user gave you; never invent or download images.
- Body: Markdown. Start with the answer, not a preamble. Use `##` and `###` headings (never `#`). Aim for 700–1,400 words.
- At least 2 internal links: one of https://lidr.io/features/ or https://lidr.io/pricing/ (as `/features/` or `/pricing/`), and one related existing post (`/blog/<slug>/`).
- Every image needs alt text: `![what it shows](/images/blog/<slug>/photo.jpg)`.

## 4. Self-review (required)
Read the post back and fix it until all of these are true:
- No invented statistics, studies, quotes, customer names or testimonials. If a number matters, ask the user for the source, or remove it.
- Every claim about Lidr matches the live https://lidr.io/features/ and https://lidr.io/pricing/ pages (fetch them).
- British English, plain and practical. Written for construction site teams, not marketers.
- The target phrase appears in the title, description and first paragraph, naturally.

## 5. Check with the real validator
```bash
./scripts/check.sh
```
It must end with no problems listed. Fix every problem it prints, then run it again.

## 6. Publish
```bash
git add posts images tags.yml
git diff --cached --name-only   # must list ONLY posts/, images/, tags.yml paths
git commit -m "Publish blog post \"<slug>\""
git push origin HEAD:main || { git pull --rebase origin main && ./scripts/check.sh && git push origin HEAD:main; }
```
If the push is rejected twice, stop and tell the user.

## 7. Report
Tell the user the URL (https://lidr.io/blog/<slug>/), that it's live in about 3 minutes, and anything they should add, such as real photos or a customer example. Then remove the worktree: `cd - && git worktree remove ../lidr-blog-post`.
````

- [ ] **Step 7: `docs/claude-instructions.md`** (for a Claude.ai Project):

```markdown
# Lidr.io blog: Claude Project instructions

Paste this into a Claude.ai Project's instructions. It drafts posts that you then paste into https://lidr.io/admin/.

You write blog posts for Lidr.io, a mobile app that helps construction teams capture, organise and report on site photos (GPS tags, timestamps, annotations, PDF reports).

Audience: site managers, project managers, surveyors, subcontractors. Practical people on phones. British English. Plain, specific, no hype.

For every post:
1. Ask what the post is for and who should read it, if the user hasn't said.
2. Pick ONE search phrase to target and use it naturally in the title, description and first paragraph.
3. Start with the answer. Use "Heading 2" and "Heading 3" style headings (## and ###), never a single #.
4. 700–1,400 words. Short paragraphs. Checklists where useful.
5. Link to https://lidr.io/features/ or https://lidr.io/pricing/ at least once, where it genuinely helps.
6. Never invent statistics, studies, quotes, customer names or testimonials. If a number would help, write [NEEDS SOURCE] and tell the user.
7. Only describe Lidr features that appear on https://lidr.io/features/.

Output exactly two parts:

**Part 1 – fields for the editor** (the user copies each into its box):
- Title (10–70 characters):
- Description for Google (50–160 characters):
- Topics (1–3 from: Site photos, Reporting, Safety, or tell the user a new topic is needed):
- Suggested photos: what to photograph, with a one-line description (alt text) for each

**Part 2 – the post body** in Markdown, ready to paste into the editor's "Post" box (switch the editor to Markdown mode first, or paste into rich text).

Before you finish, check: no invented facts, the target phrase used naturally, headings are ## or ###, and links work.
```

- [ ] **Step 8: `docs/authoring-guide.md`.** The team guide; screenshots are added in Task 10. Write plain step-by-step sections:
  1. **One-time setup:**
     - create a free GitHub account at github.com/signup;
     - send the site owner your username;
     - accept the email invite to `lidr-blog` (check spam).
  2. **Write a post:**
     - go to https://lidr.io/admin/ → Login with GitHub → Blog posts → New Blog post;
     - fill in each box (each has a hint underneath);
     - the preview on the right shows how it will look.
  3. **Add photos:**
     - use "Cover photo", or the image button in the toolbar;
     - JPEG/PNG/WebP up to 15 MB;
     - iPhone users should set Settings → Camera → Formats → Most Compatible;
     - turn off location for the camera, or remove it before uploading;
     - always fill in the photo description.
  4. **Publish:** click Publish → Publish now. The post is live at lidr.io/blog/your-post/ in about 3 minutes. Unsaved work stays in your browser if you get logged out.
  5. **Change a live post:** open it, edit, set "Last updated" to today, then Publish.
  6. **Take a post down:**
     - turn on "Hide this post", then Publish;
     - to send readers elsewhere, fill in "Retire this post and send visitors to".
     - Never delete posts. The editor doesn't allow it, because deleted pages hurt Google rankings.
  7. **"Post needs attention" emails:**
     - GitHub emails you an Issue if something in your post needs fixing;
     - "isn't live yet" means fix it now, because the old version, or nothing, is showing;
     - "worth fixing" means the post is live but could be better;
     - open the link in the email, fix it in the editor, and Publish. The Issue closes by itself.
  8. **Writing with Claude:** see `docs/claude-instructions.md`, or use the Claude Code skill (`.claude/skills/new-blog-post`).

- [ ] **Step 9: `README.md`**

```markdown
# lidr-blog

Blog content for https://lidr.io/blog/. **Edit posts at https://lidr.io/admin/**, not here.

- Writing guide: `docs/authoring-guide.md`
- With Claude: `docs/claude-instructions.md` (Claude.ai) or the `new-blog-post` skill (Claude Code)
- Every push is checked automatically; problems arrive as GitHub Issues assigned to you.
- Site code lives in `lidradmin/lidr.io` (`docs/blog-setup.md` for the owner).
```

- [ ] **Step 10: Validate and commit**

```bash
python3 -c "import yaml;[yaml.safe_load(open(f)) for f in ['tags.yml','.github/workflows/check.yml','.github/workflows/publish.yml']]" && bash -n scripts/check.sh
git add -A && git commit -q -m "Blog content repo scaffold" && git log --oneline
```

- [ ] **Step 11: Local end-to-end check against the site repo's validator**

```bash
LIDR_SITE_DIR=/Users/conor.mullan/Documents/Lidr.io-check ./scripts/check.sh; echo "exit=$?"
```

Expected: `blog: 0 post(s), 0 tag(s)…`, no problems, `exit=0`. Tag pages are only built for tags that have posts, so 0 tags is expected. Delete `/Users/conor.mullan/Documents/Lidr.io-check` afterwards.

**This step only works after the site-repo branch is merged**, because check.sh clones `lidr.io` `main`, which must contain Tasks 1–6. Run it after Task 10 Step 1 if needed.

---

### Task 10: Merge, owner setup, and live acceptance test

- [ ] **Step 1: Merge the site branch.**
  - Full verification: `npx vitest run`, `npx tsc --noEmit -p .`, `npm run build` (disabled), `npm run test:a11y`.
  - Merge `feat/blog-publishing` → `main` and push. The production site still shows the blog disabled, `/admin/` now exists, and login won't work yet.
- [ ] **Step 2: Owner executes `docs/blog-setup.md` §1–§6.** Pause here for the owner. Agents can't do these steps.
- [ ] **Step 3: Check the editor loads under its CSP.** Open https://lidr.io/admin/ in Chrome (Claude in Chrome, or the owner) and read the console.
  - If there are `Content-Security-Policy` violations, add exactly the blocked source to the `/admin/*` CSP. Only add `'unsafe-eval'` to `script-src` if the violation is an eval. Commit, push, and re-check.
  - Log in. The GitHub popup should show the "Lidr Blog Editor" app; authorise it, and the editor should show "Blog posts" and "Settings".
- [ ] **Step 4: Publish a test post** titled "Test post — please ignore". It needs a cover photo from a phone with location ON, one body image, 1 topic, and **no** "Describe the cover photo" text. Both are soft problems, so the post still publishes. (Don't use an over-long description: the editor blocks it before Publish.) Publish, then within 5 minutes confirm:
  - (a) `lidr-blog` has a commit `Create blog "test-post-please-ignore"` with `posts/…md` and `images/test-post-please-ignore/…`;
  - (b) the "Publish to lidr.io" action succeeded and Cloudflare built with `blog: 1 post(s)`;
  - (c) https://lidr.io/blog/test-post-please-ignore/ shows the post, the cover is WebP via `<picture>`, and the image has no GPS (`exiftool` or `sharp` metadata on the downloaded `-1600.jpg`);
  - (d) the "Blog check" action opened an Issue "Post needs attention: test-post-please-ignore", assigned to the author and mentioning `BLOG_OWNER`. It should list the missing cover description and the photo-location warning;
  - (e) `/blog/` now has the footer Blog link and is indexable.
- [ ] **Step 5: Fix it in the editor.** Fill in "Describe the cover photo" and Publish. The Issue updates; the location warning remains, because the original upload is still in the repo. The warning only clears once the original file is deleted via the media library: remove it from the post (or swap in a location-free photo), delete the original in the media library, and Publish. The Issue closes itself with the comment "No problems found at commit …. Closing this issue."
- [ ] **Step 6: Further live checks.**
  - The login popup handshake survives: after authorising, the editor loads and no "Open the editor at…" message appears.
  - An invited collaborator (Write on `lidr-blog`, not on `lidr.io`) can sign in and publish.
  - No CSP violations in the console after login, and none when opening an existing entry.
  - The Claude Code route: install the skill from `docs/claude-code/new-blog-post/SKILL.md`, run `/new-blog-post`, and stop at the approval step without publishing.
- [ ] **Step 7: Retire the test post.** Turn on "Hide this post" and Publish. The page 404s within about 3 minutes, and the blog returns to "No posts yet". If this was the only post, the footer link disappears too.
- [ ] **Step 8: Screenshots for `docs/authoring-guide.md`.** Capture these and add them under `docs/images/` in `lidr-blog`, linked from the guide:
  - the login screen;
  - the new-post form with the preview;
  - the Publish menu;
  - an Issue email.
  Commit in `lidr-blog` with a non-post path, so it won't trigger the publish workflow.
- [ ] **Step 9: Hand over.** Tell the owner:
  - authors can now be invited (§5);
  - point them at `docs/authoring-guide.md`;
  - the Claude Code skill and the Claude.ai instructions are ready.

---

## Self-review

- **Spec coverage:**
  - §1 content repo → Task 9.
  - §2 single source of truth → Task 1. The CMS hides `canonical`, and unpublishing works through draft/redirect with delete disabled.
  - §7 CMS (config, preview, media limits, commit messages) → Tasks 1, 4.
  - §8:
    - editor guard → Task 1;
    - author is told → Tasks 6, 9;
    - deploy hook → Task 9;
    - site CI → Task 7;
    - duplicate titles, broken links and the `updated` reminder → Tasks 2, 3.
  - §9:
    - GitHub App scoped to `lidr-blog` → Task 8 §2;
    - `ALLOWED_ORIGIN` → Task 5;
    - `/admin` CSP, SRI and noindex → Task 4;
    - `sanitize_preview` → Task 1;
    - runner policy → Tasks 7, 9.
  - §10 Claude → Task 9 Steps 6–7.
  - §11 docs → Tasks 8, 9 and 10 Step 7.
  - §13 owner setup → Tasks 8, 10.
- **Known gaps by design:**
  - Originals with GPS remain in the public content repo's history. Authors are warned in the editor hint, in the guide and in the Issue. Sveltia's in-browser re-encoding (spec §12 item 8) is deferred, since Decap was chosen.
  - `BLOG_OWNER` defaults to `lidradmin` until set.
- **Placeholder scan:** the only fill-in is the SRI hash, which Task 4 Step 1 computes with an exact command; Step 2 verifies it was replaced.
