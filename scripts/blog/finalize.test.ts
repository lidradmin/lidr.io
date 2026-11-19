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

  finalizeOut(out, { enabled: true, posts: [], tags: [], redirects: [{ from: "/blog/old/", to: "/blog/new/" }] });

  expect(existsSync(join(out, "blog/__empty"))).toBe(false);
  expect(existsSync(join(out, "blog/page/__empty"))).toBe(false);
  expect(existsSync(join(out, "blog/__empty.txt"))).toBe(false);
  expect(existsSync(join(out, "blog/real"))).toBe(true);
  const redirects = readFileSync(join(out, "_redirects"), "utf8");
  expect(redirects).toBe("/sign-up   /  301\n\n# blog (generated)\n/blog/old/  /blog/new/  301\n/blog/old  /blog/new/  301\n");
});
