import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, test, vi } from "vitest";
import type { BlogData, BlogReport } from "../../lib/blog/types";
import { buildBlogData, countProblems, formatProblems } from "./pipeline";

vi.mock("../../lib/blog/markdown", async (orig) => {
  const actual = await orig<typeof import("../../lib/blog/markdown")>();
  return {
    ...actual,
    renderMarkdown: (md: string, o: Parameters<typeof actual.renderMarkdown>[1]) => {
      if (md.includes("BOOM")) throw new Error("boom failure");
      return actual.renderMarkdown(md, o);
    },
  };
});
vi.mock("./og", async (orig) => {
  const actual = await orig<typeof import("./og")>();
  return {
    ...actual,
    renderOgImage: (o: { title: string; tagName?: string }) => {
      if (o.title.includes("NOOG")) throw new Error("og failure");
      return actual.renderOgImage(o);
    },
  };
});

const FIXTURES = resolve("tests/fixtures/blog");
let data: BlogData;
let report: BlogReport;
let publicDir: string;

beforeAll(async () => {
  publicDir = mkdtempSync(join(tmpdir(), "pipe-"));
  ({ data, report } = await buildBlogData({ contentDir: FIXTURES, publicDir }));
});

describe("buildBlogData with fixtures", () => {
  test("publishes valid + soft posts, newest first", () => {
    expect(data.enabled).toBe(true);
    expect(data.posts).toHaveLength(13);
    expect(data.posts[0].slug).toBe("welcome-to-the-lidr-blog");
    expect(data.posts.map((p) => p.slug)).toContain("soft-problems-example");
  });
  test("drafts, redirects and broken posts are not published", () => {
    const slugs = data.posts.map((p) => p.slug);
    expect(slugs).not.toContain("draft-post");
    expect(slugs).not.toContain("old-url");
    expect(slugs).not.toContain("broken");
  });
  test("redirects are collected", () => {
    expect(data.redirects).toEqual([{ from: "/blog/old-url/", to: "/blog/welcome-to-the-lidr-blog/" }]);
  });
  test("problems are reported per post", () => {
    expect(report.problems["broken"][0]).toMatchObject({ level: "hard", field: "title" });
    expect(report.problems["soft-problems-example"].map((p) => p.field).sort()).toEqual(["description", "tags"]);
    expect(report.problems["photo-reports-that-hold-up"].some((p) => /location/.test(p.message))).toBe(true);
  });
  test("cover and OG images are resolved", () => {
    const welcome = data.posts[0];
    expect(welcome.cover?.src).toBe("/images/blog/welcome-to-the-lidr-blog/cover-1600.jpg");
    expect(welcome.ogImage).toBe(welcome.cover?.src);
    const report = data.posts.find((p) => p.slug === "photo-reports-that-hold-up")!;
    expect(report.ogImage).toBe("/images/blog/_og/photo-reports-that-hold-up.png");
    expect(existsSync(join(publicDir, "images/blog/_og/photo-reports-that-hold-up.png"))).toBe(true);
  });
  test("body is rendered and sanitised", () => {
    const p = data.posts.find((x) => x.slug === "photo-reports-that-hold-up")!;
    expect(p.html).toContain("<picture>");
    expect(p.html).not.toContain("javascript:");
    expect(p.readingMinutes).toBe(1);
  });
  test("tags only include those with posts, with counts", () => {
    expect(data.tags.map((t) => [t.slug, t.count])).toEqual([
      ["reporting", 2],
      ["safety", 10],
      ["site-photos", 2],
    ]);
  });
  test("related posts are computed", () => {
    const p = data.posts.find((x) => x.slug === "photo-reports-that-hold-up")!;
    expect(p.related).toEqual(["welcome-to-the-lidr-blog", "soft-problems-example"]);
  });
});

test("formatProblems lists every problem with detail, countProblems counts them", () => {
  const rep: BlogReport = {
    problems: { a: [{ level: "hard", field: "title", message: "m", detail: "d" }], b: [{ level: "soft", field: "x", message: "n" }] },
  };
  expect(countProblems(rep)).toBe(2);
  expect(formatProblems(rep)).toEqual(["  a [hard] title: m", "    d", "  b [soft] x: n"]);
  expect(countProblems(report)).toBeGreaterThan(0);
});

test("disabled blog returns empty data", async () => {
  const r = await buildBlogData({ contentDir: null, publicDir: mkdtempSync(join(tmpdir(), "pipe-")) });
  expect(r.data).toEqual({ enabled: false, posts: [], tags: [], redirects: [] });
});

test("Cyrillic title without a cover gets the share-image soft problem", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pipe-content-"));
  mkdirSync(join(dir, "posts"), { recursive: true });
  copyFileSync(join(FIXTURES, "tags.yml"), join(dir, "tags.yml"));
  const body = Array.from({ length: 40 }, () => "word").join(" ");
  writeFileSync(
    join(dir, "posts", "cyrillic-title.md"),
    `---\ntitle: "Привет мир"\ndescription: "A post whose title has Cyrillic letters in it, long enough to pass checks."\ndate: 2026-11-10\ntags: [safety]\n---\n\n${body}\n`
  );
  const r = await buildBlogData({ contentDir: dir, publicDir: mkdtempSync(join(tmpdir(), "pipe-")) });
  expect(r.data.posts.map((p) => p.slug)).toContain("cyrillic-title");
  expect(r.report.problems["cyrillic-title"].some((p) => p.level === "soft" && /can't show these characters/.test(p.message))).toBe(true);
});

// ---- helpers for temp content dirs ----
const BODY = Array.from({ length: 40 }, () => "word").join(" ");
const DESC = "A description that is long enough to pass the length checks for posts.";
const post = (title: string, extra = "") => `---\ntitle: "${title}"\ndescription: "${DESC}"\ndate: 2026-11-10\ntags: [safety]\n${extra}---\n\n${BODY}\n`;
function mkContent(posts: Record<string, string>, withTags = true) {
  const dir = mkdtempSync(join(tmpdir(), "pipe-content-"));
  mkdirSync(join(dir, "posts"), { recursive: true });
  if (withTags) copyFileSync(join(FIXTURES, "tags.yml"), join(dir, "tags.yml"));
  for (const [n, c] of Object.entries(posts)) writeFileSync(join(dir, "posts", n), c);
  return dir;
}
const build = (dir: string) => buildBlogData({ contentDir: dir, publicDir: mkdtempSync(join(tmpdir(), "pipe-")) });
const git = (cwd: string, ...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd, stdio: "pipe" });
const msgs = (r: BlogReport, k: string) => (r.problems[k] ?? []).map((p) => p.message);

describe("guards", () => {
  test("missing posts/ throws; empty posts/ is fine", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pipe-content-"));
    await expect(build(dir)).rejects.toThrow(/no posts\/ folder/);
    const r = await build(mkContent({}));
    expect(r.data.enabled).toBe(true);
    expect(r.data.posts).toHaveLength(0);
  });
  test("non-.md entries are reported under _content and don't throw", async () => {
    const dir = mkContent({ "a.md": post("A"), "b.markdown": "x", "C.MD": "x" });
    mkdirSync(join(dir, "posts", "dir.md"));
    const r = await build(dir);
    expect(r.data.posts.map((p) => p.slug)).toEqual(["a"]);
    expect(r.report.problems["_content"]).toHaveLength(3);
  });
  test("two runs give identical data", async () => {
    const a = await buildBlogData({ contentDir: FIXTURES, publicDir: mkdtempSync(join(tmpdir(), "pipe-")) });
    const b = await buildBlogData({ contentDir: FIXTURES, publicDir: mkdtempSync(join(tmpdir(), "pipe-")) });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  test("future-dated post gets a soft problem but stays published", async () => {
    const dir = mkContent({ "f.md": post("A future dated post title").replace("2026-11-10", "2090-01-01") });
    const r = await build(dir);
    expect(r.data.posts[0].date).toBe("2090-01-01");
    expect(msgs(r.report, "f").some((m) => /in the future \(2090-01-01\)/.test(m))).toBe(true);
  });
  test("image folder without a post goes to _images with the folder name", async () => {
    const dir = mkContent({ "a.md": post("A") });
    mkdirSync(join(dir, "images", "ghost"), { recursive: true });
    writeFileSync(join(dir, "images", "ghost", "bad.jpg"), "not an image");
    const r = await build(dir);
    expect(r.report.problems["ghost"]).toBeUndefined();
    expect(msgs(r.report, "_images")[0]).toMatch(/^ghost: /);
  });
});

describe("redirects", () => {
  const redirect = (to: string) => `---\nredirectTo: ${to}\n---\n`;
  test("normalises trailing slash", async () => {
    const r = await build(mkContent({ "a.md": post("A"), "old.md": redirect("/blog/a") }));
    expect(r.data.redirects).toEqual([{ from: "/blog/old/", to: "/blog/a/" }]);
  });
  test("collapses chains to the final target", async () => {
    const r = await build(mkContent({ "a.md": post("A"), "b.md": redirect("/blog/a/"), "c.md": redirect("/blog/b/") }));
    expect(r.data.redirects).toEqual([
      { from: "/blog/b/", to: "/blog/a/" },
      { from: "/blog/c/", to: "/blog/a/" },
    ]);
    expect(r.report.problems["b"]).toBeUndefined();
  });
  test("loops are removed with a soft problem", async () => {
    const r = await build(mkContent({ "a.md": redirect("/blog/b/"), "b.md": redirect("/blog/a/") }));
    expect(r.data.redirects).toEqual([]);
    expect(msgs(r.report, "a")).toContain("This post redirects in a loop (a → b → a). The redirect was removed.");
    expect(msgs(r.report, "b")).toContain("This post redirects in a loop (b → a → b). The redirect was removed.");
  });
  test("dead target keeps the redirect and warns", async () => {
    const r = await build(mkContent({ "old.md": redirect("/blog/gone/"), "d.md": post("D", "draft: true\n"), "old2.md": redirect("/blog/d/") }));
    expect(r.data.redirects).toHaveLength(2);
    expect(msgs(r.report, "old")).toContain("This post redirects to /blog/gone/, which isn't published.");
    expect(msgs(r.report, "old2")).toContain("This post redirects to /blog/d/, which isn't published.");
  });
});

describe("covers", () => {
  test.each(["__proto__", "constructor"])("cover %s is not found", async (cover) => {
    const r = await build(mkContent({ "a.md": post("A", `cover: ${cover}\n`) }));
    expect(r.data.posts[0].cover).toBeUndefined();
    const all = Object.values(r.report.problems).flat().map((p) => p.message);
    expect(all.some((m) => /Cover photo not found|cover/i.test(m))).toBe(true);
  });
  test("manifest-less cover path reports not found", async () => {
    const r = await build(mkContent({ "a.md": post("A", "cover: /images/blog/a/nope.jpg\n") }));
    expect(r.data.posts[0].cover).toBeUndefined();
    expect(msgs(r.report, "a").some((m) => m.startsWith("Cover photo not found"))).toBe(true);
  });
});

describe("last-good and tags history", () => {
  function repo() {
    const dir = mkContent({});
    git(dir, "init", "-q");
    return dir;
  }
  const commit = (dir: string, m: string) => {
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", m);
  };
  test("broken v2 falls back to good v1 with the still-live message", async () => {
    const dir = repo();
    writeFileSync(join(dir, "posts", "p.md"), post("Good"));
    commit(dir, "v1");
    writeFileSync(join(dir, "posts", "p.md"), "---\ntitle: \"\"\n---\nbroken\n");
    commit(dir, "v2");
    const r = await build(dir);
    expect(r.data.posts[0]).toMatchObject({ slug: "p", title: "Good", source: "last-good" });
    expect(msgs(r.report, "p").some((m) => /previous version is still live/.test(m))).toBe(true);
  });
  test("draft v1 gives no still-live message and isn't published", async () => {
    const dir = repo();
    writeFileSync(join(dir, "posts", "p.md"), post("Draft", "draft: true\n"));
    commit(dir, "v1");
    writeFileSync(join(dir, "posts", "p.md"), "---\ntitle: \"\"\n---\nbroken\n");
    commit(dir, "v2");
    const r = await build(dir);
    expect(r.data.posts).toHaveLength(0);
    expect(msgs(r.report, "p").some((m) => /still live/.test(m))).toBe(false);
  });
  test("broken tags.yml falls back to the previous one", async () => {
    const dir = repo();
    writeFileSync(join(dir, "posts", "p.md"), post("A perfectly fine post"));
    commit(dir, "v1");
    writeFileSync(join(dir, "tags.yml"), "tags: [\n");
    commit(dir, "v2");
    const r = await build(dir);
    expect(msgs(r.report, "_tags")).toContain("tags.yml has a problem, so the previous tag list is still in use.");
    expect(r.data.tags.map((t) => t.slug)).toEqual(["safety"]);
    expect(r.report.problems["p"]).toBeUndefined();
  });
  test("broken tags.yml with no history: empty tags, no per-post tag noise", async () => {
    const dir = mkContent({ "p.md": post("A perfectly fine post") }, false);
    writeFileSync(join(dir, "tags.yml"), "tags: [\n");
    const r = await build(dir);
    expect(r.data.tags).toEqual([]);
    expect(r.report.problems["_tags"].length).toBeGreaterThan(0);
    expect((r.report.problems["p"] ?? []).filter((p) => p.field === "tags")).toEqual([]);
  });
  test("missing tags.yml adds a _tags problem", async () => {
    const r = await build(mkContent({ "p.md": post("A perfectly fine post") }, false));
    expect(msgs(r.report, "_tags")[0]).toMatch(/tags\.yml is missing/);
  });
});

describe("render failures", () => {
  const postBody = (title: string, text: string) => post(title).replace(BODY, text);
  function repo() {
    const dir = mkContent({});
    git(dir, "init", "-q");
    return dir;
  }
  const commit = (dir: string, m: string) => {
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", m);
  };
  test("v1 good, v2 fails to render: stays live from v1 with exactly one hard problem", async () => {
    const dir = repo();
    writeFileSync(join(dir, "posts", "p.md"), postBody("A perfectly fine post", BODY));
    writeFileSync(join(dir, "posts", "q.md"), postBody("Another fine post here", BODY));
    commit(dir, "v1");
    writeFileSync(join(dir, "posts", "p.md"), postBody("A perfectly fine post", `BOOM ${BODY}`));
    commit(dir, "v2");
    const r = await build(dir);
    const p = r.data.posts.find((x) => x.slug === "p")!;
    expect(p.source).toBe("last-good");
    expect(p.html).not.toContain("BOOM");
    const hard = r.report.problems["p"].filter((x) => x.level === "hard");
    expect(hard).toHaveLength(1);
    expect(hard[0].detail).toBe("boom failure");
    expect(msgs(r.report, "p").some((m) => /still live/.test(m))).toBe(true);
  });
  test("v1 and v2 both fail to render: post dropped", async () => {
    const dir = repo();
    writeFileSync(join(dir, "posts", "p.md"), postBody("A perfectly fine post", `BOOM ${BODY}`));
    writeFileSync(join(dir, "posts", "q.md"), postBody("Another fine post here", BODY));
    writeFileSync(join(dir, "posts", "r.md"), postBody("Third fine post here", BODY));
    commit(dir, "v1");
    writeFileSync(join(dir, "posts", "p.md"), postBody("A perfectly fine post", `BOOM again ${BODY}`));
    commit(dir, "v2");
    const r = await build(dir);
    expect(r.data.posts.map((x) => x.slug).sort()).toEqual(["q", "r"]);
  });
  test("every post failing aborts the build; 1 of 13 does not", async () => {
    await expect(build(mkContent({ "a.md": postBody("A perfectly fine post", `BOOM ${BODY}`), "b.md": postBody("Another fine post here", `BOOM ${BODY}`) }))).rejects.toThrow(
      /Blog build aborted: 2 of 2 posts failed to render — likely a code problem\. First error: boom failure/
    );
    const posts: Record<string, string> = { "bad.md": postBody("A perfectly fine post", `BOOM ${BODY}`) };
    for (let i = 0; i < 12; i++) posts[`ok-${i}.md`] = post(`A perfectly fine post ${i}`);
    const r = await build(mkContent(posts));
    expect(r.data.posts).toHaveLength(12);
  });
  test("systematic OG failure aborts the build", async () => {
    await expect(build(mkContent({ "a.md": post("NOOG one title"), "b.md": post("NOOG two title") }))).rejects.toThrow(/share images failed to generate/);
  });
  test("single OG failure falls back to the default image", async () => {
    const posts: Record<string, string> = { "bad.md": post("NOOG one title") };
    for (let i = 0; i < 3; i++) posts[`ok-${i}.md`] = post(`A perfectly fine post ${i}`);
    const r = await build(mkContent(posts));
    expect(r.data.posts.find((x) => x.slug === "bad")!.ogImage).toBe("/images/Group-198.webp");
  });
  test("redirect into a removed loop is flagged", async () => {
    const rd = (to: string) => `---\nredirectTo: ${to}\n---\n`;
    const r = await build(mkContent({ "a.md": rd("/blog/b/"), "b.md": rd("/blog/a/"), "c.md": rd("/blog/a/") }));
    expect(r.data.redirects).toEqual([{ from: "/blog/c/", to: "/blog/a/" }]);
    expect(msgs(r.report, "c")).toContain("This post redirects to /blog/a/, which is part of a redirect loop and isn't published.");
  });
  test("restored tags.yml re-enables unknown-tag warnings", async () => {
    const dir = repo();
    writeFileSync(join(dir, "posts", "p.md"), post("A perfectly fine post").replace("[safety]", "[nope]"));
    commit(dir, "v1");
    writeFileSync(join(dir, "tags.yml"), "tags: [\n");
    commit(dir, "v2");
    const r = await build(dir);
    expect((r.report.problems["p"] ?? []).some((p) => p.field === "tags")).toBe(true);
  });
  test("a one-post blog whose only post fails to render aborts", async () => {
    await expect(build(mkContent({ "a.md": postBody("A perfectly fine post", `BOOM ${BODY}`) }))).rejects.toThrow(/nothing is left to publish/);
  });
  test("history is walked lazily: an unreadable older blob doesn't matter once a newer good version is found", async () => {
    const dir = repo();
    const file = join(dir, "posts", "p.md");
    writeFileSync(file, postBody("A perfectly fine post", BODY));
    commit(dir, "v1");
    const oid1 = git(dir, "rev-parse", "HEAD:posts/p.md").toString().trim();
    writeFileSync(file, postBody("A perfectly fine post", `${BODY} second`));
    commit(dir, "v2");
    writeFileSync(file, postBody("A perfectly fine post", `BOOM ${BODY}`));
    commit(dir, "v3");
    rmSync(join(dir, ".git", "objects", oid1.slice(0, 2), oid1.slice(2)));
    const r = await build(dir);
    expect(r.data.posts[0]).toMatchObject({ slug: "p", source: "last-good" });
    expect(r.data.posts[0].html).toContain("second");
  });
});
