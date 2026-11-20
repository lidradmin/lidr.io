import { parse as parseYaml, parseDocument } from "yaml";
import { RULES } from "../../../lib/blog/rules";
import type { Problem } from "../../../lib/blog/types";
import { parsePostFile, parseTags } from "../../../lib/blog/validate";
import {
  buildPostFile,
  checkDraft,
  imagePublicPath,
  imageRepoPath,
  isValidSlug,
  postRepoPath,
  safeFileName,
  slugify,
  today,
  type Draft,
} from "./content";
import type { FileChange } from "./github";
import type { ToolDef, ToolResult, Tools } from "./mcp";
import { listPendingPhotos, signUploadToken, UPLOAD_LINK_TTL_MS, type KV } from "./upload";

/** The parts of the GitHub client the tools use (faked in tests). */
export type Repo = {
  readFile(repo: string, path: string): Promise<string | null>;
  listDir(repo: string, path: string): Promise<string[]>;
  commit(repo: string, files: FileChange[], message: string): Promise<{ sha: string }>;
};

export type ToolsCtx = {
  gh: Repo;
  kv: KV;
  user: { id: number; login: string };
  repo: string;
  site: string;
  publicUrl: string;
  signingKey: string;
};

export const RATE_LIMIT_PER_HOUR = 20;
const KEEP_KEYS = ["canonical", "redirectTo"]; // editor-only settings preserved on update

class InputError extends Error {}

const str = (args: Record<string, unknown>, k: string, required = true): string => {
  const v = args[k];
  if (v === undefined || v === null || v === "") {
    if (required) throw new InputError(`Missing "${k}".`);
    return "";
  }
  if (typeof v !== "string") throw new InputError(`"${k}" must be text.`);
  return v;
};
const strList = (args: Record<string, unknown>, k: string): string[] => {
  const v = args[k];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new InputError(`"${k}" must be a list of topic web-address parts, e.g. ["site-photos"].`);
  return v as string[];
};

const draftProps = {
  title: { type: "string", description: `Post title, ${RULES.title.min}–${RULES.title.max} characters.` },
  description: { type: "string", description: `Text shown under the title in Google, ${RULES.description.min}–${RULES.description.max} characters.` },
  tags: { type: "array", items: { type: "string" }, description: "1–3 topic web-address parts from get_blog_context, e.g. [\"site-photos\"]." },
  body: { type: "string", description: "The post in Markdown. Headings ## and ### only." },
  cover: { type: "string", description: "Optional cover photo path returned by start_photo_upload." },
  coverAlt: { type: "string", description: "What the cover photo shows (required if there's a cover)." },
  slug: { type: "string", description: "Optional web-address part. Defaults to one made from the title. Use the existing one to update a post." },
};

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "get_blog_context",
    title: "Get blog topics and posts",
    description: "Lists the blog's topics, its existing posts (including hidden ones) and the writing limits. Call this first.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "check_post",
    title: "Check a draft post",
    description: "Runs lidr.io's own publishing rules on a draft without saving anything. Returns blocking problems (must fix) and warnings (should fix), and the post's web address.",
    inputSchema: { type: "object", properties: draftProps, required: ["title", "description", "tags", "body"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "start_photo_upload",
    title: "Start a photo upload",
    description:
      "Prepares a one-time upload (valid 15 minutes) for a photo the user attached. Run the returned sandbox_command in your code execution tool: it removes location data, converts to JPEG and uploads. Then use the returned path in the post.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The post's title (used to work out its web address) — or give slug." },
        slug: { type: "string", description: "The post's web-address part, if already known." },
        source_path: { type: "string", description: "Where the photo is in your sandbox, e.g. /mnt/user-data/uploads/IMG_1234.jpg" },
        filename: { type: "string", description: "Short descriptive file name, e.g. rebar-cage.jpg" },
        kind: { type: "string", enum: ["cover", "inline"], description: "cover = the photo at the top; inline = a photo inside the text." },
        alt: { type: "string", description: "What the photo shows, for screen readers and Google." },
      },
      required: ["source_path", "filename", "kind", "alt"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "publish_post",
    title: "Publish a post on lidr.io",
    description:
      "Checks and publishes a post (with any photos uploaded for it) to lidr.io as the signed-in user. Refuses posts with blocking problems. Live in about 3 minutes. To change an existing post, pass its slug and update: true.",
    inputSchema: {
      type: "object",
      properties: { ...draftProps, update: { type: "boolean", description: "true to replace an existing post at the same address." } },
      required: ["title", "description", "tags", "body"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: "hide_post",
    title: "Hide a post",
    description: "Takes a post off lidr.io by turning on 'Hide this post'. Nothing is deleted; publishing it again with update: true brings it back.",
    inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
];

function describeProblems(hard: Problem[], soft: Problem[]): string {
  const lines: string[] = [];
  if (hard.length) lines.push("Blocking (must fix):", ...hard.map((p) => `- ${p.message}`));
  if (soft.length) lines.push("Warnings (should fix):", ...soft.map((p) => `- ${p.message}`));
  return lines.length ? lines.join("\n") : "No problems found.";
}

function readDraft(args: Record<string, unknown>): Draft {
  return {
    title: str(args, "title").trim(),
    description: str(args, "description").trim(),
    tags: strList(args, "tags"),
    body: str(args, "body"),
    cover: str(args, "cover", false) || undefined,
    coverAlt: str(args, "coverAlt", false).trim() || undefined,
  };
}

function resolveSlug(args: Record<string, unknown>, title: string): string {
  const slug = str(args, "slug", false) || slugify(title);
  if (!isValidSlug(slug)) throw new InputError(`"${slug || title}" can't be used as a web address. Use lowercase words joined by hyphens, e.g. snagging-photos.`);
  return slug;
}

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export function sandboxCommand(sourcePath: string, uploadUrl: string): string {
  return [
    `SRC=${shellQuote(sourcePath)}`,
    `python3 - "$SRC" <<'PY'`,
    "import subprocess, sys",
    "from PIL import Image, ImageOps",
    "try:",
    "    im = Image.open(sys.argv[1])",
    "except Exception:",
    "    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'pillow-heif'], check=True)",
    "    from pillow_heif import register_heif_opener",
    "    register_heif_opener()",
    "    im = Image.open(sys.argv[1])",
    "im = ImageOps.exif_transpose(im).convert('RGB')",
    "im.thumbnail((2400, 2400))",
    "im.save('/tmp/lidr-upload.jpg', 'JPEG', quality=85, optimize=True)  # saved without EXIF/GPS",
    "PY",
    `curl -sS --fail-with-body -X POST -H 'Content-Type: image/jpeg' --data-binary @/tmp/lidr-upload.jpg ${shellQuote(uploadUrl)}`,
  ].join("\n");
}

export function createTools(ctx: ToolsCtx): Tools {
  const { gh, kv, user, repo, site } = ctx;

  async function loadTags() {
    const raw = await gh.readFile(repo, "tags.yml");
    return parseTags(raw ?? "").tags;
  }

  async function knownImages(slug: string): Promise<Set<string>> {
    const pending = await listPendingPhotos(kv, user.id, slug);
    const inRepo = await gh.listDir(repo, `images/${slug}`);
    return new Set([...pending.map((p) => p.path), ...inRepo.map((f) => imagePublicPath(slug, f))]);
  }

  async function rateLimit() {
    const hour = new Date().toISOString().slice(0, 13);
    const key = `rl:${user.id}:${hour}`;
    const n = Number((await kv.get(key)) ?? "0");
    if (n >= RATE_LIMIT_PER_HOUR) throw new InputError(`You've published ${RATE_LIMIT_PER_HOUR} times in the last hour, which is the limit. Try again later.`);
    await kv.put(key, String(n + 1), { expirationTtl: 3700 });
  }

  const handlers: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>> = {
    async get_blog_context() {
      const tags = await loadTags();
      const files = (await gh.listDir(repo, "posts")).filter((f) => f.endsWith(".md")).slice(0, 200);
      const posts = [];
      for (const f of files) {
        const raw = await gh.readFile(repo, `posts/${f}`);
        if (!raw) continue;
        const p = parsePostFile(raw);
        if (!p.ok) continue;
        const slug = f.replace(/\.md$/, "");
        posts.push({
          slug,
          url: `${site}/blog/${slug}/`,
          title: String(p.data.title ?? ""),
          description: String(p.data.description ?? ""),
          topics: Array.isArray(p.data.tags) ? p.data.tags.map(String) : [],
          hidden: p.data.draft === true,
        });
      }
      const structured = {
        topics: [...tags.values()].map((t) => ({ slug: t.slug, name: t.name, description: t.description })),
        posts,
        rules: { title: RULES.title, description: RULES.description, topics: RULES.tags, headings: "## and ### only", words: "700–1,400" },
        facts: [`${site}/features/`, `${site}/pricing/`],
      };
      const text = [
        `Topics: ${structured.topics.map((t) => `${t.name} (${t.slug})`).join(", ") || "none yet"}`,
        `Posts (${posts.length}):`,
        ...posts.map((p) => `- ${p.title} — ${p.url}${p.hidden ? " [hidden]" : ""} [${p.topics.join(", ")}]`),
        `Facts about Lidr: ${structured.facts.join(" and ")}`,
      ].join("\n");
      return { text, structured };
    },

    async check_post(args) {
      const d = readDraft(args);
      const slug = resolveSlug(args, d.title);
      const exists = (await gh.readFile(repo, postRepoPath(slug))) !== null;
      const { hard, soft } = await checkDraft(d, { slug, tags: await loadTags(), knownImages: await knownImages(slug) });
      const url = `${site}/blog/${slug}/`;
      const text = [
        `Address: ${url}${exists ? " (a post already exists here: publishing needs update: true and will replace it)" : ""}`,
        describeProblems(hard, soft),
        hard.length ? "This post would NOT publish until the blocking problems are fixed." : "This post can be published.",
      ].join("\n");
      return { text, structured: { slug, url, exists, blocking: hard.map((p) => p.message), warnings: soft.map((p) => p.message) } };
    },

    async start_photo_upload(args) {
      const slug = str(args, "slug", false) ? resolveSlug(args, "") : resolveSlug({}, str(args, "title"));
      const kind = str(args, "kind");
      if (kind !== "cover" && kind !== "inline") throw new InputError('"kind" must be "cover" or "inline".');
      const alt = str(args, "alt").trim();
      const file = safeFileName(str(args, "filename"));
      const sourcePath = str(args, "source_path");
      const token = await signUploadToken({ u: user.id, s: slug, f: file, k: kind, alt, exp: Date.now() + UPLOAD_LINK_TTL_MS }, ctx.signingKey);
      const uploadUrl = `${ctx.publicUrl}/upload/${token}`;
      const path = imagePublicPath(slug, file);
      const command = sandboxCommand(sourcePath, uploadUrl);
      const text = [
        `Run this in your code execution tool (bash). It strips location data, converts to JPEG and uploads:`,
        "```bash",
        command,
        "```",
        `When it prints "ok": true, use ${path} as ${kind === "cover" ? `the cover (with coverAlt: ${JSON.stringify(alt)})` : `![${alt}](${path}) in the text`}.`,
        "The link works once and expires in 15 minutes.",
      ].join("\n");
      return { text, structured: { slug, path, upload_url: uploadUrl, sandbox_command: command } };
    },

    async publish_post(args) {
      const d = readDraft(args);
      const slug = resolveSlug(args, d.title);
      const update = args.update === true;
      const existingRaw = await gh.readFile(repo, postRepoPath(slug));
      const extra: Record<string, unknown> = {};
      if (existingRaw !== null) {
        if (!update) {
          return { text: `A post already exists at ${site}/blog/${slug}/. To replace it, call publish_post again with update: true. For a new post, use a different title or slug.`, isError: true };
        }
        const prev = parsePostFile(existingRaw);
        if (prev.ok) {
          const date = prev.data.date instanceof Date ? prev.data.date.toISOString().slice(0, 10) : String(prev.data.date ?? "").slice(0, 10);
          if (date) d.date = date;
          for (const k of KEEP_KEYS) if (prev.data[k] !== undefined) extra[k] = prev.data[k];
        }
        d.updated = today();
      } else {
        d.date = today();
      }
      d.draft = false;

      const { hard, soft } = await checkDraft(d, { slug, tags: await loadTags(), knownImages: await knownImages(slug) });
      if (hard.length) return { text: `Not published. ${describeProblems(hard, soft)}`, isError: true };

      await rateLimit();
      const pending = (await listPendingPhotos(kv, user.id, slug)).filter((p) => p.path === d.cover || d.body.includes(p.path));
      const files: FileChange[] = [{ path: postRepoPath(slug), content: buildPostFile(d, extra) }];
      for (const p of pending) {
        const bytes = await kv.get(p.key, "arrayBuffer");
        if (bytes) files.push({ path: imageRepoPath(slug, p.file), content: new Uint8Array(bytes) });
      }
      const verb = existingRaw === null ? "Publish" : "Update";
      const { sha } = await gh.commit(repo, files, `${verb} blog post "${slug}"`);
      for (const p of pending) await kv.delete(p.key);
      const url = `${site}/blog/${slug}/`;
      const text = [
        `${existingRaw === null ? "Published" : "Updated"}: ${url} — live in about 3 minutes${pending.length ? ` (with ${pending.length} photo${pending.length > 1 ? "s" : ""})` : ""}.`,
        soft.length ? describeProblems([], soft) : "",
        `If anything needs attention after the site builds, ${user.login} gets a GitHub email ("Post needs attention").`,
      ].filter(Boolean).join("\n");
      return { text, structured: { url, slug, commit: sha, photos: pending.map((p) => p.path), warnings: soft.map((p) => p.message) } };
    },

    async hide_post(args) {
      const slug = str(args, "slug");
      if (!isValidSlug(slug)) throw new InputError(`"${slug}" isn't a post address.`);
      const raw = await gh.readFile(repo, postRepoPath(slug));
      if (raw === null) return { text: `There's no post at ${site}/blog/${slug}/.`, isError: true };
      const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
      if (!m) return { text: "That post's settings block can't be read, so it wasn't changed. Hide it in lidr.io/admin instead.", isError: true };
      const doc = parseDocument(m[1]);
      if (doc.errors.length || typeof parseYaml(m[1]) !== "object") return { text: "That post's settings block can't be read, so it wasn't changed. Hide it in lidr.io/admin instead.", isError: true };
      if (doc.get("draft") === true) return { text: `${site}/blog/${slug}/ is already hidden.` };
      doc.set("draft", true);
      await rateLimit();
      const { sha } = await gh.commit(repo, [{ path: postRepoPath(slug), content: `---\n${doc.toString({ lineWidth: 0 })}---\n${m[2]}` }], `Hide blog post "${slug}"`);
      return { text: `Hidden: ${site}/blog/${slug}/ will disappear from lidr.io in about 3 minutes. Nothing was deleted.`, structured: { slug, commit: sha } };
    },
  };

  return {
    defs: TOOL_DEFS,
    async call(name, args) {
      const h = handlers[name];
      if (!h) return { text: `Unknown tool: ${name}`, isError: true };
      try {
        return await h(args);
      } catch (e) {
        if (e instanceof InputError) return { text: e.message, isError: true };
        throw e;
      }
    },
  };
}
