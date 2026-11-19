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
  test("cover without alt keeps alt empty and warns", () => {
    const r = run({ ...GOOD, cover: "/images/blog/a/c.jpg" });
    expect(r.meta?.coverAlt).toBe("");
    expect(r.problems[0].field).toBe("coverAlt");
    expect(r.problems[0].message).toBe("The cover photo has no description (alt text). Describe what the photo shows so screen readers can understand it.");
  });
  test("updated earlier than date is ignored", () => {
    const r = run({ ...GOOD, updated: "2026-01-01" });
    expect(r.meta?.updated).toBeUndefined();
    expect(r.problems[0].field).toBe("updated");
  });
  test("draft and canonical", () => {
    const r = run({ ...GOOD, draft: true, canonical: "https://lidr.io/x" });
    expect(r.meta).toMatchObject({ draft: true, canonical: "https://lidr.io/x" });
    expect(r.problems).toEqual([]);
  });
  test("unsafe redirectTo and canonical are dropped", () => {
    const r = run({ ...GOOD, redirectTo: "//evil.com", canonical: "javascript:x" });
    expect(r.meta?.redirectTo).toBeUndefined();
    expect(r.meta?.canonical).toBeUndefined();
    expect(r.problems.map((p) => p.field)).toEqual(["redirectTo", "canonical"]);
  });
});

describe("validatePost — hardening", () => {
  test.each([
    "/\\evil.com", "/\\/evil.com", "/x\n/evil.com", "/blog/old/ 200", "/x y", "/\t/evil.com",
    "/../admin", "/%2fevil.com", "/blog/a-post/", "/blog/a-post", 5,
  ])("redirectTo %j is rejected (C2)", (v) => {
    const r = run({ ...GOOD, redirectTo: v });
    expect(r.meta?.redirectTo).toBeUndefined();
    expect(r.problems.find((x) => x.field === "redirectTo")?.level).toBe("soft");
  });
  test.each(["/blog/other/", "/features/", "/"])("redirectTo %s is accepted (C2)", (v) => {
    expect(run({ ...GOOD, redirectTo: v }).meta?.redirectTo).toBe(v);
  });
  test("a valid redirect returns minimal meta and no soft problems (minor)", () => {
    const r = run({ title: "x", date: "2026-11-12", redirectTo: "/blog/other/", draft: "maybe", tags: "nope", canonical: "http://x" }, "b");
    expect(r.problems).toEqual([]);
    expect(r.meta).toMatchObject({ slug: "a-post", title: "x", tags: [], draft: false, redirectTo: "/blog/other/" });
  });
  test.each(["2026-02-30", "2027-02-29", "2026-13-01"])("impossible date %s rejected (I1)", (d) => {
    expect(run({ ...GOOD, date: d }).meta).toBeNull();
  });
  test("leap day accepted (I1)", () => {
    expect(run({ ...GOOD, date: "2028-02-29" }).meta?.date).toBe("2028-02-29");
  });
  test("impossible updated is ignored (I1)", () => {
    const r = run({ ...GOOD, updated: "2027-02-29" });
    expect(r.meta?.updated).toBeUndefined();
    expect(r.problems[0].field).toBe("updated");
  });
  test("numbers and booleans become strings (I2)", () => {
    const r = run({ ...GOOD, title: 1984, description: 12345, cover: "/c.jpg", coverAlt: 7 });
    expect(r.meta?.title).toBe("1984");
    expect(r.meta?.coverAlt).toBe("7");
    expect(r.meta?.description).toBe("12345");
    expect(run({ ...GOOD, title: true }).meta?.title).toBe("true");
  });
  test("comma-separated tags string, trimmed and deduped (I3)", () => {
    const r = run({ ...GOOD, tags: " site-photos , reporting,, site-photos " });
    expect(r.meta?.tags).toEqual(["site-photos", "reporting"]);
    expect(r.problems).toEqual([]);
  });
  test("list tags are trimmed, empties dropped, deduped (I3)", () => {
    expect(run({ ...GOOD, tags: ["site-photos", " site-photos", ""] }).meta?.tags).toEqual(["site-photos"]);
  });
  test("tags of the wrong type give a format message, not 'no tags' (I3)", () => {
    const r = run({ ...GOOD, tags: { a: 1 } });
    expect(r.meta?.tags).toEqual([]);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0].message).toContain("wrong format");
  });
  test("all-unknown tags say the post now has no tags (I3)", () => {
    const r = run({ ...GOOD, tags: ["nope"] });
    expect(r.problems.some((x) => x.message.includes("so the post now has no tags."))).toBe(true);
  });
  test("missing tags says no tags (I3)", () => {
    const r = run({ ...GOOD, tags: undefined });
    expect(r.problems[0].message).toContain("no tags");
  });
  test.each([["yes", true], ["ON", true], ["True", true], ["no", false], ["Off", false], ["false", false], [false, false], [true, true]])(
    "draft %j -> %j (I4)",
    (v, expected) => {
      const r = run({ ...GOOD, draft: v });
      expect(r.meta?.draft).toBe(expected);
      expect(r.problems).toEqual([]);
    }
  );
  test.each(["maybe", 2, "tru"])("unknown draft %j hides the post with a soft problem (I4)", (v) => {
    const r = run({ ...GOOD, draft: v });
    expect(r.meta?.draft).toBe(true);
    expect(r.problems[0]).toMatchObject({ level: "soft", field: "draft" });
    expect(r.problems[0].message).toContain("treated as on (hidden)");
  });
  test.each(["http://lidr.io/x", "javascript:x", "https://", "not a url", 5])("canonical %j ignored (I7)", (v) => {
    const r = run({ ...GOOD, canonical: v });
    expect(r.meta?.canonical).toBeUndefined();
    expect(r.problems[0]).toMatchObject({ level: "soft", field: "canonical" });
  });
  test("canonical on lidr.io has no problem; other host warns but is kept (I7)", () => {
    expect(run({ ...GOOD, canonical: "https://www.lidr.io/blog/x/" }).problems).toEqual([]);
    const r = run({ ...GOOD, canonical: "https://example.com/x" });
    expect(r.meta?.canonical).toBe("https://example.com/x");
    expect(r.problems[0].message).toBe("This post tells Google its original is on example.com. If that's not intended, remove the canonical setting.");
  });
  test("plain-English slug and date messages (I8)", () => {
    expect(run(GOOD, "x", "Bad Slug").problems[0].message).toContain("can't be changed in the editor; contact the site owner.");
    expect(run({ ...GOOD, date: "nope" }).problems[0].message).toBe(
      "The publish date is missing or isn't a real date (for example 2026-11-12). Pick a date in the editor."
    );
  });
  test("image-only post with no description falls back to the title (minor)", () => {
    const r = validatePost({ slug: "a", data: { ...GOOD, description: "" }, body: "![](x.jpg)", plainText: "", tags: TAGS });
    expect(r.meta?.description).toBe(GOOD.title);
  });
});

describe("validatePost — follow-ups", () => {
  const R = "/blog/other/";
  test("redirect with empty body keeps meta and no problems (R1)", () => {
    const r = run({ ...GOOD, redirectTo: R }, "   ");
    expect(r.problems).toEqual([]);
    expect(r.meta).toMatchObject({ redirectTo: R, tags: [], draft: false, description: "" });
  });
  test("redirect with no title uses the slug (R1)", () => {
    const r = run({ date: "2026-11-12", redirectTo: R });
    expect(r.problems).toEqual([]);
    expect(r.meta).toMatchObject({ redirectTo: R, title: "a-post" });
  });
  test("redirect with no date has empty date (R1)", () => {
    const r = run({ title: "Hello there", redirectTo: R });
    expect(r.problems).toEqual([]);
    expect(r.meta).toMatchObject({ redirectTo: R, date: "", title: "Hello there" });
  });
  test("redirect with a bad slug is still hard (R1)", () => {
    expect(run({ ...GOOD, redirectTo: R }, "x", "Bad Slug").meta).toBeNull();
  });
  test("front-matter over 32 KB is hard (M1)", () => {
    const r = parsePostFile(`---\ntitle: Hi\nnote: ${"x".repeat(40 * 1024)}\n---\nBody`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem.message).toBe("The settings at the top of the post are too long. Open it in lidr.io/admin and Publish again.");
  });
  test("canonical is stored as url.href (M2)", () => {
    expect(run({ ...GOOD, canonical: "https://lidr.io/a b" }).meta?.canonical).toBe("https://lidr.io/a%20b");
  });
  test.each([[0, false], [1, true]])("draft number %j -> %j (M3)", (v, expected) => {
    const r = run({ ...GOOD, draft: v });
    expect(r.meta?.draft).toBe(expected);
    expect(r.problems).toEqual([]);
  });
  test.each(["0000-01-01", "2200-01-01", "1999-12-31"])("year out of range %s rejected (M4)", (d) => {
    expect(run({ ...GOOD, date: d }).meta).toBeNull();
  });
  test("year 2000 and 2100 accepted (M4)", () => {
    expect(run({ ...GOOD, date: "2000-01-01" }).meta?.date).toBe("2000-01-01");
    expect(run({ ...GOOD, date: "2100-12-31" }).meta?.date).toBe("2100-12-31");
  });
});

describe("parsePostFile", () => {
  test("parses front-matter", () => {
    const r = parsePostFile("---\ntitle: Hi\n---\nBody");
    expect(r).toEqual({ ok: true, data: { title: "Hi" }, body: "Body" });
  });
  test("broken YAML is a hard problem with plain-English message (I8)", () => {
    const r = parsePostFile("---\ntitle: [unclosed\n---\nBody");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problem.level).toBe("hard");
      expect(r.problem.message).toContain("wrong format");
      expect(r.problem.message).toContain("lidr.io/admin");
      expect(r.problem.detail).toBeTruthy();
    }
  });
  test("duplicate key names the key (I8)", () => {
    const r = parsePostFile("---\ntitle: A\ntitle: B\n---\nBody");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem.message).toBe("The setting 'title' appears twice at the top of the post. Delete one.");
  });
  test.each(["---js", "---javascript", "---yaml", "---json"])("%s opener is a hard problem and not executed (C1)", (opener) => {
    const r = parsePostFile(`${opener}\n({title: (globalThis.__pwned = 1)})\n---\nBody`);
    expect(r.ok).toBe(false);
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
    if (!r.ok) expect(r.problem.message).toContain("wrong format");
  });
  test("missing closing marker is hard (C1)", () => {
    expect(parsePostFile("---\ntitle: Hi\nBody").ok).toBe(false);
  });
  test("no front-matter is hard (C1)", () => {
    expect(parsePostFile("Just text").ok).toBe(false);
  });
  test("CRLF line endings and BOM parse (C1)", () => {
    const r = parsePostFile("\uFEFF---\r\ntitle: Hi\r\n---\r\nBody\r\n");
    expect(r).toEqual({ ok: true, data: { title: "Hi" }, body: "Body" });
  });
  test("a --- inside the body is not a marker", () => {
    const r = parsePostFile("---\ntitle: Hi\n---\nA\n---\nB");
    expect(r).toEqual({ ok: true, data: { title: "Hi" }, body: "A\n---\nB" });
  });
  test.each(["---\n---\nBody", "---\n- a\n- b\n---\nBody", "---\njust text\n---\nBody"])(
    "null, array or scalar front-matter is hard (I6)",
    (raw) => {
      const r = parsePostFile(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.problem.message).toBe("The settings at the top of the post are in the wrong format. Open it in lidr.io/admin and Publish again.");
    }
  );
});

describe("parseTags", () => {
  test("duplicate slug: first wins, soft problem (I5)", () => {
    const r = parseTags("tags:\n  - slug: a-b\n    name: First\n  - slug: a-b\n    name: Second\n");
    expect(r.tags.get("a-b")?.name).toBe("First");
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatchObject({ level: "soft", field: "tags.yml" });
  });
  test.each(["", "just text", "- a\n- b", "other: 1"])("empty, non-mapping or no tags list gives one soft problem (I5): %j", (txt) => {
    const r = parseTags(txt);
    expect(r.tags.size).toBe(0);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatchObject({ level: "soft", field: "tags.yml" });
  });
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
  test("strips trailing punctuation before the ellipsis (minor)", () => {
    const e = excerpt("Hello there, " + "x".repeat(10) + ". " + "word ".repeat(40), 27);
    expect(e).toMatch(/[a-z0-9]…$/i);
  });
  test("short text unchanged", () => expect(excerpt("Short.")).toBe("Short."));
});
