import { execFileSync } from "node:child_process";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PATH_RE = /^[a-z0-9._/-]+$/;
const MAX_VERSIONS = 25;

const run = (cwd: string, args: string[]) =>
  execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
    timeout: 30_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).toString();

/**
 * Walks posts/<slug>.md history newest → oldest (at most 25 versions) and
 * returns the first version `isGood` accepts. Skips the working-tree version
 * (assumed broken). Returns null if the content dir isn't a git repo, the slug
 * is unsafe, or nothing passes. Renames are not followed: slugs are permanent
 * (spec §2).
 *
 * Throws if a blob can't be read (e.g. a lazy fetch fails in a blob:none
 * clone) so the build fails and the previous deployment stays live.
 */
export function findLastGood(contentDir: string, slug: string, isGood: (raw: string) => boolean): string | null {
  if (!SLUG_RE.test(slug)) return null;
  return findLastGoodFile(contentDir, `posts/${slug}.md`, isGood);
}

/** Same walk as findLastGood, for any safe repo-relative file (e.g. tags.yml). */
export function findLastGoodFile(contentDir: string, relPath: string, isGood: (raw: string) => boolean): string | null {
  for (const raw of historyVersions(contentDir, relPath, MAX_VERSIONS)) {
    if (isGood(raw)) return raw;
  }
  return null;
}

/** Raw versions of a file from git history, newest first. Throws if a blob can't be read. */
export function listHistoryVersions(contentDir: string, relPath: string, max = MAX_VERSIONS): string[] {
  return [...historyVersions(contentDir, relPath, max)];
}

export function* historyVersions(contentDir: string, relPath: string, max: number = MAX_VERSIONS): Generator<string> {
  if (!PATH_RE.test(relPath) || relPath.includes("..") || relPath.startsWith("/")) return;
  const path = relPath;
  const label = relPath;
  try {
    run(contentDir, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return;
  }
  try {
    run(contentDir, ["rev-parse", "--verify", "-q", "HEAD"]);
  } catch {
    return; // repo has no commits yet
  }
  let shas: string[];
  try {
    shas = run(contentDir, ["log", "--topo-order", `--max-count=${max}`, "--format=%H", "--", path])
      .split("\n")
      .filter(Boolean);
  } catch (err) {
    throw new Error(`Could not read history for ${label}: ${(err as Error).message}`);
  }
  for (const sha of shas) {
    // Trees are local even in blob:none clones; only blobs may need a fetch.
    const tree = run(contentDir, ["ls-tree", "-z", sha, "--", path]);
    if (!tree) continue; // file absent in that commit
    const oid = /^\d+ blob ([0-9a-f]+)\t/.exec(tree)?.[1];
    if (!oid) continue;
    try {
      yield run(contentDir, ["cat-file", "blob", oid]);
    } catch (err) {
      throw new Error(`Could not read history for ${label}: ${(err as Error).message}`);
    }
  }
}
