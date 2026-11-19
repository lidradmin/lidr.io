import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { findLastGood, findLastGoodFile } from "./history";
import { resolveContentDir } from "./source";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, stdio: "pipe" }).toString();

function repoWith(versions: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "blog-hist-"));
  git(dir, "init", "-q");
  mkdirSync(join(dir, "posts"));
  versions.forEach((v, i) => {
    writeFileSync(join(dir, "posts", "p.md"), v);
    git(dir, "add", ".");
    git(dir, "commit", "-q", "-m", `v${i}`);
  });
  return dir;
}

const isGood = (raw: string) => raw.includes("title: Good");

test("returns the newest version that passes", () => {
  const dir = repoWith(["title: Good one\n", "title: Good two\n", "broken\n"]);
  expect(findLastGood(dir, "p", isGood)).toBe("title: Good two\n");
});

test("returns null when no version passes", () => {
  expect(findLastGood(repoWith(["broken\n"]), "p", isGood)).toBeNull();
});

test("returns null outside a git repo", () => {
  expect(findLastGood(mkdtempSync(join(tmpdir(), "nogit-")), "p", isGood)).toBeNull();
});

test("returns null for slugs that are not safe kebab-case", () => {
  const dir = repoWith(["title: Good one\n"]);
  for (const bad of ["../p", "p/../p", "P", "p;ls", "-p", "p--q", "", "p\n"]) {
    expect(findLastGood(dir, bad, () => true)).toBeNull();
  }
});

test("works when the content dir is a subfolder of the repo", () => {
  const root = mkdtempSync(join(tmpdir(), "blog-sub-"));
  git(root, "init", "-q");
  const sub = join(root, "content");
  mkdirSync(join(sub, "posts"), { recursive: true });
  for (const v of ["title: Good one\n", "broken\n"]) {
    writeFileSync(join(sub, "posts", "p.md"), v);
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "v");
  }
  expect(findLastGood(sub, "p", isGood)).toBe("title: Good one\n");
});

test("only checks the newest 25 versions", () => {
  const versions = ["title: Good old\n", ...Array.from({ length: 30 }, (_, i) => `broken ${i}\n`)];
  expect(findLastGood(repoWith(versions), "p", isGood)).toBeNull();
});

test("skips commits where the file was deleted", () => {
  const dir = repoWith(["title: Good one\n"]);
  git(dir, "rm", "-q", "posts/p.md");
  git(dir, "commit", "-q", "-m", "rm");
  mkdirSync(join(dir, "posts"), { recursive: true });
  writeFileSync(join(dir, "posts", "p.md"), "broken\n");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "re-add");
  expect(findLastGood(dir, "p", isGood)).toBe("title: Good one\n");
});

test("works on a blob:none clone made by resolveContentDir", () => {
  const src = repoWith(["title: Good old\n", "broken\n"]);
  git(src, "config", "uploadpack.allowFilter", "true");
  git(src, "config", "uploadpack.allowAnySHA1InWant", "true");
  const target = join(mkdtempSync(join(tmpdir(), "t-")), ".blog-content");
  resolveContentDir({ BLOG_CONTENT_REPO: "file://" + src }, target);
  expect(findLastGood(target, "p", isGood)).toBe("title: Good old\n");
});

test("throws when a blob cannot be read", () => {
  const dir = repoWith(["title: Good one\n", "broken\n"]);
  const oid = git(dir, "rev-parse", "HEAD~1:posts/p.md").trim();
  rmSync(join(dir, ".git", "objects", oid.slice(0, 2), oid.slice(2)), { force: true });
  expect(() => findLastGood(dir, "p", isGood)).toThrow(/Could not read history for p/);
});

test("throws when git log fails in a corrupted repo", () => {
  const dir = repoWith(["title: Good one\n"]);
  const head = git(dir, "rev-parse", "HEAD").trim();
  rmSync(join(dir, ".git", "objects", head.slice(0, 2), head.slice(2)), { force: true });
  expect(() => findLastGood(dir, "p", isGood)).toThrow(/Could not read history for p/);
});

test("returns null for a repo with no commits", () => {
  const dir = mkdtempSync(join(tmpdir(), "empty-"));
  git(dir, "init", "-q");
  expect(findLastGood(dir, "p", isGood)).toBeNull();
});

test("findLastGoodFile reads any safe path and rejects unsafe ones", () => {
  const dir = repoWith(["title: Good one\n"]);
  expect(findLastGoodFile(dir, "posts/p.md", isGood)).toBe("title: Good one\n");
  expect(findLastGoodFile(dir, "../p.md", () => true)).toBeNull();
  expect(findLastGoodFile(dir, "posts/../p.md", () => true)).toBeNull();
  expect(findLastGoodFile(dir, "/etc/passwd", () => true)).toBeNull();
  expect(findLastGoodFile(dir, "Posts/P.md", () => true)).toBeNull();
});
