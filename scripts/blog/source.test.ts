import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { cloneArgs, resolveContentDir } from "./source";

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

test("clone argv puts -- directly before the URL", () => {
  const url = "--upload-pack=touch /tmp/x";
  const args = cloneArgs(url, "/t/.blog-content");
  expect(args[args.indexOf(url) - 1]).toBe("--");
});

test("a leading-dash repo value fails safely without creating files", () => {
  const dir = mkdtempSync(join(tmpdir(), "inj-"));
  const marker = join(dir, "pwned");
  expect(() => resolveContentDir({ BLOG_CONTENT_REPO: `--upload-pack=touch ${marker}` }, join(dir, ".blog-content"))).toThrow(/Could not fetch/);
  expect(existsSync(marker)).toBe(false);
});

test("credentials in the URL never appear in the error", () => {
  const target = join(mkdtempSync(join(tmpdir(), "t-")), ".blog-content");
  let msg = "";
  try {
    resolveContentDir({ BLOG_CONTENT_REPO: "https://user:secret@nonexistent.invalid/x.git" }, target);
  } catch (e) {
    msg = (e as Error).message;
  }
  expect(msg).toMatch(/Could not fetch/);
  expect(msg).not.toContain("secret");
});

test("symlinks in the repo arrive as regular files", () => {
  const src = mkdtempSync(join(tmpdir(), "src-"));
  execFileSync("git", ["init", "-q"], { cwd: src });
  symlinkSync("/etc/passwd", join(src, "link"));
  const g = ["-c", "user.name=t", "-c", "user.email=t@t"];
  execFileSync("git", [...g, "add", "."], { cwd: src });
  execFileSync("git", [...g, "commit", "-q", "-m", "x"], { cwd: src });
  const target = join(mkdtempSync(join(tmpdir(), "t-")), ".blog-content");
  resolveContentDir({ BLOG_CONTENT_REPO: src }, target);
  expect(lstatSync(join(target, "link")).isSymbolicLink()).toBe(false);
});

test("refuses a clone target not named .blog-content", () => {
  const dir = mkdtempSync(join(tmpdir(), "t-"));
  expect(() => resolveContentDir({ BLOG_CONTENT_REPO: "/x" }, dir)).toThrow(/Refusing/);
  expect(existsSync(dir)).toBe(true);
});
