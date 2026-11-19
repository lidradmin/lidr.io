import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import type { BlogData, BlogReport } from "../../lib/blog/types";
import { buildBlogData } from "./pipeline";

const FIXTURES = resolve("tests/fixtures/blog");
let data: BlogData;
let report: BlogReport;
let publicDir: string;

beforeAll(async () => {
  publicDir = mkdtempSync(join(tmpdir(), "pipe-"));
  ({ data, report } = await buildBlogData({ contentDir: FIXTURES, publicDir, strict: false }));
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

test("strict mode rejects any problem", async () => {
  const publicDir = mkdtempSync(join(tmpdir(), "pipe-"));
  await expect(buildBlogData({ contentDir: FIXTURES, publicDir, strict: true })).rejects.toThrow(/problem/);
});

test("disabled blog returns empty data", async () => {
  const r = await buildBlogData({ contentDir: null, publicDir: mkdtempSync(join(tmpdir(), "pipe-")), strict: false });
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
  const r = await buildBlogData({ contentDir: dir, publicDir: mkdtempSync(join(tmpdir(), "pipe-")), strict: false });
  expect(r.data.posts.map((p) => p.slug)).toContain("cyrillic-title");
  expect(r.report.problems["cyrillic-title"].some((p) => p.level === "soft" && /can't show these characters/.test(p.message))).toBe(true);
});
