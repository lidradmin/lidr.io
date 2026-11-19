import { describe, expect, test } from "vitest";
import { excerpt, parsePostFile, parseTags, validatePost } from "./validate";
import type { TagDef } from "./types";

const TAGS = new Map<string, TagDef>([
  ["site-photos", { slug: "site-photos", name: "Site photos", description: "d" }],
  ["reporting", { slug: "reporting", name: "Reporting", description: "d" }],
]);

const GOOD = {
  title: "How to photograph a site walk",
  description:
    "A practical checklist for capturing site walk photos that hold up in reports and disputes.",
  date: "2026-11-12",
  tags: ["site-photos"],
};

function run(data: Record<string, unknown>, body = "Body text here.", slug = "a-post") {
  return validatePost({ slug, data, body, plainText: body, tags: TAGS });
}

describe("validatePost — hard problems", () => {
  test("valid post has no problems", () => {
    const r = run(GOOD);
    expect(r.problems).toEqual([]);
    expect(r.meta?.title).toBe(GOOD.title);
    expect(r.meta?.draft).toBe(false);
  });
  test("missing title is hard", () => {
    const r = run({ ...GOOD, title: undefined });
    expect(r.meta).toBeNull();
    expect(r.problems[0]).toMatchObject({ level: "hard", field: "title" });
  });
  test("invalid date is hard", () => {
    expect(run({ ...GOOD, date: "12/11/2026" }).meta).toBeNull();
  });
  test("YAML Date objects are accepted as UTC dates", () => {
    expect(run({ ...GOOD, date: new Date("2026-11-12T00:00:00Z") }).meta?.date).toBe("2026-11-12");
  });
  test("empty body is hard", () => {
    expect(run(GOOD, "   ").meta).toBeNull();
  });
  test("bad slug is hard", () => {
    expect(run(GOOD, "x", "Bad Slug").meta).toBeNull();
  });
});

describe("validatePost — soft problems keep the post", () => {
  test("long description warns but publishes", () => {
    const r = run({ ...GOOD, description: "x".repeat(182) });
    expect(r.meta).not.toBeNull();
    expect(r.problems).toEqual([
      expect.objectContaining({ level: "soft", field: "description", message: expect.stringContaining("182") }),
    ]);
  });
  test("missing description falls back to excerpt", () => {
    const r = validatePost({ slug: "a", data: { ...GOOD, description: "" }, body: "Hello world", plainText: "Hello world", tags: TAGS });
    expect(r.meta?.description).toBe("Hello world");
    expect(r.problems[0].level).toBe("soft");
  });
  test("unknown tags are dropped", () => {
    const r = run({ ...GOOD, tags: ["site-photos", "nope"] });
    expect(r.meta?.tags).toEqual(["site-photos"]);
    expect(r.problems[0]).toMatchObject({ level: "soft", field: "tags" });
  });
  test("more than 3 tags are truncated", () => {
    const tags = new Map(TAGS);
    ["a-tag", "b-tag"].forEach((s) => tags.set(s, { slug: s, name: s, description: "" }));
    const r = validatePost({ slug: "a", data: { ...GOOD, tags: ["site-photos", "reporting", "a-tag", "b-tag"] }, body: "b", plainText: "b", tags });
    expect(r.meta?.tags).toHaveLength(3);
  });
  test("cover without alt falls back to title", () => {
    const r = run({ ...GOOD, cover: "/images/blog/a/c.jpg" });
    expect(r.meta?.coverAlt).toBe(GOOD.title);
    expect(r.problems[0].field).toBe("coverAlt");
  });
  test("updated earlier than date is ignored", () => {
    const r = run({ ...GOOD, updated: "2026-01-01" });
    expect(r.meta?.updated).toBeUndefined();
    expect(r.problems[0].field).toBe("updated");
  });
  test("draft, redirectTo and canonical", () => {
    const r = run({ ...GOOD, draft: true, redirectTo: "/blog/other/", canonical: "https://example.com/x" });
    expect(r.meta).toMatchObject({ draft: true, redirectTo: "/blog/other/", canonical: "https://example.com/x" });
  });
  test("unsafe redirectTo and canonical are dropped", () => {
    const r = run({ ...GOOD, redirectTo: "//evil.com", canonical: "javascript:x" });
    expect(r.meta?.redirectTo).toBeUndefined();
    expect(r.meta?.canonical).toBeUndefined();
    expect(r.problems.map((p) => p.field)).toEqual(["redirectTo", "canonical"]);
  });
});

describe("parsePostFile", () => {
  test("parses front-matter", () => {
    const r = parsePostFile("---\ntitle: Hi\n---\nBody");
    expect(r).toEqual({ ok: true, data: { title: "Hi" }, body: "Body" });
  });
  test("broken YAML is a hard problem", () => {
    const r = parsePostFile("---\ntitle: [unclosed\n---\nBody");
    expect(r.ok).toBe(false);
  });
});

describe("parseTags", () => {
  test("parses list and skips invalid entries", () => {
    const r = parseTags("tags:\n  - slug: site-photos\n    name: Site photos\n    description: About photos\n  - name: no slug\n");
    expect([...r.tags.keys()]).toEqual(["site-photos"]);
    expect(r.problems).toHaveLength(1);
  });
});

describe("excerpt", () => {
  test("cuts on a word boundary with ellipsis", () => {
    const text = "word ".repeat(60);
    const e = excerpt(text);
    expect(e.length).toBeLessThanOrEqual(156);
    expect(e.endsWith("…")).toBe(true);
  });
  test("short text unchanged", () => expect(excerpt("Short.")).toBe("Short."));
});
