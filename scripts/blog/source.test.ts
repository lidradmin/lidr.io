import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { resolveContentDir } from "./source";

test("BLOG_CONTENT_DIR wins and must exist", () => {
  const dir = mkdtempSync(join(tmpdir(), "c-"));
  expect(resolveContentDir({ BLOG_CONTENT_DIR: dir }, "/unused")).toBe(dir);
  expect(() => resolveContentDir({ BLOG_CONTENT_DIR: join(dir, "nope") }, "/unused")).toThrow(/does not exist/);
});

test("no config means blog disabled", () => {
  expect(resolveContentDir({}, "/unused")).toBeNull();
});

test("BLOG_CONTENT_REPO is cloned fresh", () => {
  const src = mkdtempSync(join(tmpdir(), "src-"));
  execFileSync("git", ["init", "-q"], { cwd: src });
  writeFileSync(join(src, "tags.yml"), "tags: []\n");
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "add", "."], { cwd: src });
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "x"], { cwd: src });
  const target = join(mkdtempSync(join(tmpdir(), "t-")), ".blog-content");
  expect(resolveContentDir({ BLOG_CONTENT_REPO: src }, target)).toBe(target);
  expect(existsSync(join(target, "tags.yml"))).toBe(true);
});

test("clone failure throws (build must fail, never deploy an empty blog)", () => {
  const target = join(mkdtempSync(join(tmpdir(), "t-")), ".blog-content");
  expect(() => resolveContentDir({ BLOG_CONTENT_REPO: "/definitely/not/a/repo" }, target)).toThrow(/Could not fetch/);
});

test("a repo value starting with '-' is not read as a git option", () => {
  const dir = mkdtempSync(join(tmpdir(), "inj-"));
  const marker = join(dir, "pwned");
  const target = join(dir, ".blog-content");
  expect(() => resolveContentDir({ BLOG_CONTENT_REPO: `--upload-pack=touch ${marker}` }, target)).toThrow(/Could not fetch/);
  expect(existsSync(marker)).toBe(false);
});
