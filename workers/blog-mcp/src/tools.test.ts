import { beforeEach, describe, expect, test } from "vitest";
import { parsePostFile } from "../../../lib/blog/validate";
import type { FileChange } from "./github";
import { MemoryKV } from "./testing";
import { createTools, RATE_LIMIT_PER_HOUR, sandboxCommand, type Repo } from "./tools";
import { handleUpload } from "./upload";

const REPO = "lidradmin/lidr-blog";
const KEY = "k".repeat(48);
const TAGS = `tags:\n  - slug: site-photos\n    name: Site photos\n    description: How to capture site photos.\n  - slug: reporting\n    name: Reporting\n    description: Reports.\n`;

class FakeRepo implements Repo {
  files = new Map<string, string | Uint8Array>([["tags.yml", TAGS]]);
  commits: { files: FileChange[]; message: string }[] = [];
  async readFile(_r: string, path: string) {
    const f = this.files.get(path);
    return typeof f === "string" ? f : null;
  }
  async listDir(_r: string, path: string) {
    return [...this.files.keys()].filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes("/")).map((k) => k.slice(path.length + 1));
  }
  async commit(_r: string, files: FileChange[], message: string) {
    this.commits.push({ files, message });
    for (const f of files) this.files.set(f.path, f.content);
    return { sha: `sha${this.commits.length}` };
  }
}

const BODY = "Good snagging photos answer three questions.\n\n## Why\n\nSee the [features](https://lidr.io/features/).";
const DRAFT = {
  title: "Snagging photos that contractors can act on",
  description: "How to take snagging photos at handover that show the contractor exactly where each defect is.",
  tags: ["site-photos"],
  body: BODY,
};
const SLUG = "snagging-photos-that-contractors-can-act-on";

let gh: FakeRepo;
let kv: MemoryKV;
const tools = () =>
  createTools({ gh, kv, user: { id: 7, login: "eoin" }, repo: REPO, site: "https://lidr.io", publicUrl: "https://mcp.lidr.io", signingKey: KEY });
const call = (name: string, args: Record<string, unknown> = {}) => tools().call(name, args);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xda, 0x00, 0x02, 0x11, 0xff, 0xd9]);

async function uploadPhoto(kind: "cover" | "inline", filename = "rebar.jpg") {
  const r = await call("start_photo_upload", { title: DRAFT.title, source_path: "/mnt/user-data/uploads/IMG 1.HEIC", filename, kind, alt: "Rebar cage" });
  const { upload_url, path } = r.structured as { upload_url: string; path: string };
  const token = upload_url.split("/upload/")[1];
  const res = await handleUpload(new Request(upload_url, { method: "POST", body: JPEG }), token, { kv, signingKey: KEY });
  expect(res.status).toBe(200);
  return path;
}

beforeEach(() => {
  gh = new FakeRepo();
  kv = new MemoryKV();
});

describe("tools", () => {
  test("get_blog_context lists topics and posts incl. hidden", async () => {
    gh.files.set("posts/old.md", "---\ntitle: Old post here\ndate: 2026-11-01\ntags: [reporting]\ndraft: true\n---\nText\n");
    const r = await call("get_blog_context");
    const s = r.structured as { topics: { slug: string }[]; posts: { slug: string; hidden: boolean }[] };
    expect(s.topics.map((t) => t.slug)).toEqual(["site-photos", "reporting"]);
    expect(s.posts).toEqual([expect.objectContaining({ slug: "old", hidden: true, url: "https://lidr.io/blog/old/" })]);
    expect(r.text).toContain("[hidden]");
  });

  test("check_post reports blocking problems without saving", async () => {
    const r = await call("check_post", { ...DRAFT, body: BODY + "\n\n[NEEDS SOURCE]" });
    expect(r.text).toMatch(/Blocking/);
    expect(r.text).toMatch(/would NOT publish/);
    expect((r.structured as { slug: string }).slug).toBe(SLUG);
    expect(gh.commits).toHaveLength(0);
  });

  test("publish_post commits the post as one commit and returns the URL", async () => {
    const r = await call("publish_post", DRAFT);
    expect(r.isError).toBeFalsy();
    expect(r.text).toContain(`https://lidr.io/blog/${SLUG}/`);
    expect(gh.commits).toHaveLength(1);
    expect(gh.commits[0].message).toBe(`Publish blog post "${SLUG}"`);
    const file = gh.commits[0].files[0];
    expect(file.path).toBe(`posts/${SLUG}.md`);
    const parsed = parsePostFile(String(file.content));
    expect(parsed.ok && parsed.data).toMatchObject({ title: DRAFT.title, tags: ["site-photos"], draft: false });
  });

  test("publish_post refuses blocking problems", async () => {
    const r = await call("publish_post", { ...DRAFT, body: "[TODO] write this" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/Not published/);
    expect(gh.commits).toHaveLength(0);
  });

  test("publish_post won't overwrite an existing post unless update: true, and keeps its date", async () => {
    await call("publish_post", DRAFT);
    gh.files.set(`posts/${SLUG}.md`, String(gh.files.get(`posts/${SLUG}.md`)).replace(/date: .*/, "date: 2026-01-05").replace("draft: false", "draft: false\ncanonical: https://lidr.io/blog/x/"));
    const again = await call("publish_post", DRAFT);
    expect(again.isError).toBe(true);
    expect(again.text).toMatch(/update: true/);
    const upd = await call("publish_post", { ...DRAFT, update: true, body: BODY + "\n\nMore." });
    expect(upd.isError).toBeFalsy();
    expect(gh.commits[1].message).toBe(`Update blog post "${SLUG}"`);
    const parsed = parsePostFile(String(gh.commits[1].files[0].content));
    expect(parsed.ok && String(parsed.data.date).slice(0, 10)).toBe("2026-01-05");
    expect(parsed.ok && parsed.data.updated).toBeTruthy();
    expect(parsed.ok && parsed.data.canonical).toBe("https://lidr.io/blog/x/");
  });

  test("photos uploaded via the sandbox are committed with the post, then cleared", async () => {
    const cover = await uploadPhoto("cover");
    const inline = await uploadPhoto("inline", "detail.jpg");
    await uploadPhoto("inline", "unused.jpg");
    const r = await call("publish_post", { ...DRAFT, cover, coverAlt: "Rebar cage", body: `${BODY}\n\n![Detail](${inline})` });
    expect(r.isError).toBeFalsy();
    const paths = gh.commits[0].files.map((f) => f.path);
    expect(paths[0]).toBe(`posts/${SLUG}.md`);
    expect(paths.slice(1).sort()).toEqual([`images/${SLUG}/detail.jpg`, `images/${SLUG}/rebar.jpg`]);
    expect(gh.commits[0].files[1].content).toBeInstanceOf(Uint8Array);
    expect([...(await kv.list({ prefix: "photo:" })).keys.map((k) => k.name)]).toEqual([`photo:7:${SLUG}:unused.jpg`]);
  });

  test("start_photo_upload gives a safe file name and a sandbox command", async () => {
    const r = await call("start_photo_upload", { slug: "a-post", source_path: "/mnt/user-data/uploads/it's me.HEIC", filename: "../../Evil Name.png", kind: "cover", alt: "x" });
    const s = r.structured as { path: string; sandbox_command: string; upload_url: string };
    expect(s.path).toBe("/images/blog/a-post/evil-name.jpg");
    expect(s.upload_url).toMatch(/^https:\/\/mcp\.lidr\.io\/upload\/[\w-]+\.[\w-]+$/);
    expect(s.sandbox_command).toContain(`SRC='/mnt/user-data/uploads/it'\\''s me.HEIC'`);
    expect(s.sandbox_command).toContain("pillow-heif");
  });

  test("bad input becomes a friendly error, not a crash", async () => {
    expect((await call("publish_post", { ...DRAFT, tags: "site-photos" })).text).toMatch(/list of topic/);
    expect((await call("publish_post", { ...DRAFT, slug: "../etc" })).text).toMatch(/can't be used as a web address/);
    expect((await call("start_photo_upload", { slug: "a", source_path: "x", filename: "a.jpg", kind: "banner", alt: "x" })).text).toMatch(/cover/);
    expect((await call("nope")).isError).toBe(true);
  });

  test("hide_post sets draft: true and keeps the text", async () => {
    await call("publish_post", DRAFT);
    const r = await call("hide_post", { slug: SLUG });
    expect(r.isError).toBeFalsy();
    const raw = String(gh.commits[1].files[0].content);
    const parsed = parsePostFile(raw);
    expect(parsed.ok && parsed.data.draft).toBe(true);
    expect(parsed.ok && parsed.body.trim()).toBe(BODY);
    expect(gh.commits[1].message).toBe(`Hide blog post "${SLUG}"`);
    expect((await call("hide_post", { slug: SLUG })).text).toMatch(/already hidden/);
    expect((await call("hide_post", { slug: "missing" })).isError).toBe(true);
  });

  test("hide_post splits the settings block exactly like the site (trailing spaces, --- rules in the text)", async () => {
    gh.files.set("posts/odd.md", "---\ntitle: Odd post title here\ndate: 2026-11-01\ntags: [reporting]\ndraft: false\n--- \nIntro\n\n---\n\nAfter a rule.\n");
    const r = await call("hide_post", { slug: "odd" });
    expect(r.isError).toBeFalsy();
    const parsed = parsePostFile(String(gh.commits[0].files[0].content));
    expect(parsed.ok && parsed.data.draft).toBe(true);
    expect(parsed.ok && parsed.body).toContain("---\n\nAfter a rule.");
  });

  test("very long photo descriptions are refused up front", async () => {
    const r = await call("start_photo_upload", { slug: "a", source_path: "x", filename: "a.jpg", kind: "cover", alt: "x".repeat(301) });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/under 300/);
  });

  test("rate limit stops runaway publishing", async () => {
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      expect((await call("publish_post", { ...DRAFT, slug: `post-${i}` })).isError).toBeFalsy();
    }
    const r = await call("publish_post", { ...DRAFT, slug: "one-too-many" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/limit/);
  });
});

describe("sandboxCommand", () => {
  test("quotes paths and URLs safely", () => {
    const c = sandboxCommand("/a/b'; rm -rf /", "https://x/upload/t'1");
    expect(c).toContain(`SRC='/a/b'\\''; rm -rf /'`);
    expect(c).toContain(`'https://x/upload/t'\\''1'`);
  });
});
