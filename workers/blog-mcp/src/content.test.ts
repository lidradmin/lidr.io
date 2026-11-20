import { describe, expect, test } from "vitest";
import { RULES } from "../../../lib/blog/rules";
import { parsePostFile } from "../../../lib/blog/validate";
import type { TagDef } from "../../../lib/blog/types";
import { buildPostFile, checkDraft, imagePublicPath, safeFileName, slugify, type Draft } from "./content";

const TAGS = new Map<string, TagDef>([
  ["site-photos", { slug: "site-photos", name: "Site photos", description: "d" }],
  ["reporting", { slug: "reporting", name: "Reporting", description: "d" }],
]);
const GOOD: Draft = {
  title: "Snagging Photos: How to Take Shots Contractors Can Act On",
  description: "How to take snagging photos at handover that show the contractor exactly where each defect is.",
  tags: ["site-photos"],
  body: "Good snagging photos answer three questions.\n\n## Why it matters\n\nBecause.",
  date: "2026-11-20",
};
const ctx = (knownImages: string[] = []) => ({ slug: "a-post", tags: TAGS, knownImages: new Set(knownImages) });

describe("slugify", () => {
  test("matches the editor's addresses", () => {
    expect(slugify(GOOD.title)).toBe("snagging-photos-how-to-take-shots-contractors-can-act-on");
  });
  test("accents, apostrophes, symbols and spacing", () => {
    expect(slugify("  Café façade: what's   next? & more!! ")).toBe("cafe-facade-what-s-next-more");
  });
  test("long titles are cut at a word boundary and stay valid", () => {
    const s = slugify("word ".repeat(40));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
    expect(RULES.slugPattern.test(s)).toBe(true);
  });
  test("titles with no letters or numbers give an empty slug", () => {
    expect(slugify("!!! ???")).toBe("");
  });
});

describe("safeFileName", () => {
  test("normalises to lowercase .jpg and blocks paths", () => {
    expect(safeFileName("My Photo.HEIC")).toBe("my-photo.jpg");
    expect(safeFileName("../../etc/passwd")).toBe("etc-passwd.jpg");
    expect(safeFileName("")).toBe("photo.jpg");
  });
});

describe("buildPostFile", () => {
  test("round-trips through the site's own parser", () => {
    const d: Draft = { ...GOOD, cover: imagePublicPath("a-post", "cover.jpg"), coverAlt: 'Rebar "cage": close-up', updated: "2026-11-21" };
    const parsed = parsePostFile(buildPostFile(d));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toMatchObject({
      title: d.title,
      description: d.description,
      tags: ["site-photos"],
      cover: "/images/blog/a-post/cover.jpg",
      coverAlt: 'Rebar "cage": close-up',
      draft: false,
    });
    expect(String(parsed.data.date).slice(0, 10)).toBe("2026-11-20");
    expect(String(parsed.data.updated).slice(0, 10)).toBe("2026-11-21");
    expect(parsed.body.trim()).toBe(d.body);
  });
  test("a body containing --- lines can't break out of the settings block", () => {
    const parsed = parsePostFile(buildPostFile({ ...GOOD, body: "---\ntitle: hacked\n---\nText" }));
    expect(parsed.ok && parsed.data.title).toBe(GOOD.title);
  });
  test("omits empty optional fields", () => {
    const f = buildPostFile(GOOD);
    expect(f).not.toContain("cover");
    expect(f).not.toContain("updated");
    expect(f).toContain("draft: false");
  });
});

describe("checkDraft", () => {
  test("a good draft has no problems", async () => {
    expect(await checkDraft(GOOD, ctx())).toEqual({ hard: [], soft: [] });
  });
  test("placeholders are blocking", async () => {
    const r = await checkDraft({ ...GOOD, body: GOOD.body + "\n\nSee [NEEDS SOURCE]." }, ctx());
    expect(r.hard.map((p) => p.field)).toContain("body");
  });
  test("missing title is blocking", async () => {
    expect((await checkDraft({ ...GOOD, title: "" }, ctx())).hard[0].field).toBe("title");
  });
  test("warnings: top-level heading, outside image, unknown topic, short description", async () => {
    const r = await checkDraft(
      { ...GOOD, description: "Too short.", tags: ["nope"], body: "# Big\n\n![x](https://evil.example/x.jpg)\n\nText" },
      ctx(),
    );
    const msgs = r.soft.map((p) => p.message).join("\n");
    expect(r.hard).toEqual([]);
    expect(msgs).toMatch(/Heading 2/);
    expect(msgs).toMatch(/Only photos uploaded/);
    expect(msgs).toMatch(/don't exist/);
    expect(msgs).toMatch(/description is only/);
  });
  test("cover and inline photos must have been uploaded for this post", async () => {
    const cover = imagePublicPath("a-post", "cover.jpg");
    const inline = imagePublicPath("a-post", "inside.jpg");
    const draft = { ...GOOD, cover, coverAlt: "Rebar", body: `${GOOD.body}\n\n![Rebar close-up](${inline})` };
    const missing = await checkDraft(draft, ctx());
    expect(missing.soft.map((p) => p.message).join("\n")).toMatch(/Cover photo not uploaded/);
    expect(missing.soft.map((p) => p.message).join("\n")).toMatch(/Only photos uploaded/);
    expect(await checkDraft(draft, ctx([cover, inline]))).toEqual({ hard: [], soft: [] });
  });
  test("cover without a description warns", async () => {
    const cover = imagePublicPath("a-post", "cover.jpg");
    const r = await checkDraft({ ...GOOD, cover }, ctx([cover]));
    expect(r.soft.map((p) => p.field)).toContain("coverAlt");
  });
});
