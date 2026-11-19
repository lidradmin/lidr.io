import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { staleUpdatedProblems } from "./changes";

const git = (cwd: string, ...a: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd }).toString().trim();
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
  expect(staleUpdatedProblems(d, "not-a-sha")).toEqual({});
});
