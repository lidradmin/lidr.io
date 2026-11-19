import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { staleUpdatedProblems } from "./changes";

const git = (cwd: string, ...a: string[]) =>
  execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd }).toString().trim();
const fm = (body: string, updated?: string) =>
  `---\ntitle: A post title here\ndescription: ${"d".repeat(60)}\ndate: 2026-11-01\n${updated ? `updated: ${updated}\n` : ""}tags: [safety]\n---\n${body}\n`;

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "chg-"));
  git(dir, "init", "-q");
  mkdirSync(join(dir, "posts"));
  return dir;
}
function commit(dir: string, file: string, text: string) {
  writeFileSync(join(dir, "posts", file), text);
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "x");
  return git(dir, "rev-parse", "HEAD");
}

test("body changed without updated → soft reminder", () => {
  const d = repo();
  const before = commit(d, "p.md", fm("Old text"));
  commit(d, "p.md", fm("New text"));
  const r = staleUpdatedProblems(d, before);
  expect(r.p?.[0]).toMatchObject({ level: "soft", field: "updated" });
});

test("body changed and updated changed → no reminder", () => {
  const d = repo();
  const before = commit(d, "p.md", fm("Old text"));
  commit(d, "p.md", fm("New text", "2026-11-19"));
  expect(staleUpdatedProblems(d, before)).toEqual({});
});

test("only front-matter changed → no reminder; new posts → no reminder", () => {
  const d = repo();
  const before = commit(d, "p.md", fm("Same"));
  commit(d, "p.md", fm("Same").replace("A post title here", "A better post title"));
  commit(d, "new.md", fm("Brand new"));
  expect(staleUpdatedProblems(d, before)).toEqual({});
});

test("bad or unknown sha → no reminder, no throw", () => {
  const d = repo();
  commit(d, "p.md", fm("x"));
  expect(staleUpdatedProblems(d, "0000000000000000000000000000000000000000")).toEqual({});
  expect(staleUpdatedProblems(d, "1".repeat(40))).toEqual({});
  expect(staleUpdatedProblems(d, "not-a-sha")).toEqual({});
});

test("draft post with changed body → no reminder", () => {
  const d = repo();
  const draft = (b: string) => fm(b).replace("tags:", "draft: true\ntags:");
  const before = commit(d, "p.md", draft("Old"));
  commit(d, "p.md", draft("New"));
  expect(staleUpdatedProblems(d, before)).toEqual({});
});

test("content dir that is a subfolder of the repo works", () => {
  const root = mkdtempSync(join(tmpdir(), "chg-root-"));
  git(root, "init", "-q");
  const sub = join(root, "content");
  mkdirSync(join(sub, "posts"), { recursive: true });
  writeFileSync(join(sub, "posts", "p.md"), fm("Old"));
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "x");
  const before = git(root, "rev-parse", "HEAD");
  writeFileSync(join(sub, "posts", "p.md"), fm("New"));
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "y");
  expect(staleUpdatedProblems(sub, before).p?.[0]).toMatchObject({ level: "soft", field: "updated" });
});
