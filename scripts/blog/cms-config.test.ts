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
