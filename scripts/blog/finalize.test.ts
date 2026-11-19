import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { finalizeOut } from "./finalize";

test("removes __empty placeholders and appends redirects", () => {
  const out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(out, "blog/__empty"), { recursive: true });
  mkdirSync(join(out, "blog/page/__empty"), { recursive: true });
  mkdirSync(join(out, "blog/real"), { recursive: true });
  writeFileSync(join(out, "blog/__empty.txt"), "x");
  writeFileSync(join(out, "_redirects"), "/sign-up   /  301\n");

  finalizeOut(out, { enabled: true, posts: [], tags: [], retired: [], redirects: [{ from: "/blog/old/", to: "/blog/new/" }] });

  expect(existsSync(join(out, "blog/__empty"))).toBe(false);
  expect(existsSync(join(out, "blog/page/__empty"))).toBe(false);
  expect(existsSync(join(out, "blog/__empty.txt"))).toBe(false);
  expect(existsSync(join(out, "blog/real"))).toBe(true);
  const redirects = readFileSync(join(out, "_redirects"), "utf8");
  expect(redirects).toBe("/sign-up   /  301\n\n# blog (generated)\n/blog/old/  /blog/new/  301\n/blog/old  /blog/new/  301\n");
});

const empty = { enabled: true, posts: [], tags: [], retired: [], redirects: [{ from: "/blog/old/", to: "/blog/new/" }] };

test("is idempotent: the generated block appears once", () => {
  const out = mkdtempSync(join(tmpdir(), "out-"));
  writeFileSync(join(out, "_redirects"), "/sign-up   /  301\n");
  finalizeOut(out, empty);
  finalizeOut(out, empty);
  const r = readFileSync(join(out, "_redirects"), "utf8");
  expect(r.split("# blog (generated)").length).toBe(2);
  expect(r).toBe("/sign-up   /  301\n\n# blog (generated)\n/blog/old/  /blog/new/  301\n/blog/old  /blog/new/  301\n");
});

test("only exact placeholders are removed", () => {
  const out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(out, "blog/__empty-foo"), { recursive: true });
  mkdirSync(join(out, "blog/__empty"), { recursive: true });
  finalizeOut(out, { ...empty, redirects: [] });
  expect(existsSync(join(out, "blog/__empty-foo"))).toBe(true);
  expect(existsSync(join(out, "blog/__empty"))).toBe(false);
});

test("creates _redirects when missing", () => {
  const out = mkdtempSync(join(tmpdir(), "out-"));
  finalizeOut(out, empty);
  expect(readFileSync(join(out, "_redirects"), "utf8")).toContain("/blog/old/  /blog/new/  301");
});

test("no redirects leaves _redirects untouched; no out/blog does not throw", () => {
  const out = mkdtempSync(join(tmpdir(), "out-"));
  writeFileSync(join(out, "_redirects"), "/a  /b  301");
  finalizeOut(out, { ...empty, redirects: [] });
  expect(readFileSync(join(out, "_redirects"), "utf8")).toBe("/a  /b  301");
});

test("removes blog/page and blog/tag when emptied, keeps them when not", () => {
  const out = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(out, "blog/page/__empty"), { recursive: true });
  mkdirSync(join(out, "blog/tag/__empty"), { recursive: true });
  finalizeOut(out, { enabled: true, posts: [], tags: [], retired: [], redirects: [] });
  expect(existsSync(join(out, "blog/page"))).toBe(false);
  expect(existsSync(join(out, "blog/tag"))).toBe(false);

  const out2 = mkdtempSync(join(tmpdir(), "out-"));
  mkdirSync(join(out2, "blog/page/2"), { recursive: true });
  mkdirSync(join(out2, "blog/page/__empty"), { recursive: true });
  mkdirSync(join(out2, "blog/tag/__empty"), { recursive: true });
  finalizeOut(out2, { enabled: true, posts: [], tags: [], retired: [], redirects: [] });
  expect(existsSync(join(out2, "blog/page/2"))).toBe(true);
  expect(existsSync(join(out2, "blog/tag"))).toBe(false);
});
