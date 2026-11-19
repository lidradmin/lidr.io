import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { findLastGood } from "./history";

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
