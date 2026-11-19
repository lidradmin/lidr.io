import { execFileSync } from "node:child_process";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const run = (cwd: string, args: string[]) =>
  execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 20 * 1024 * 1024 }).toString();

/**
 * Walks posts/<slug>.md history newest → oldest and returns the first
 * version `isGood` accepts. Skips the working-tree version (assumed broken).
 * Returns null if the content dir isn't a git repo or nothing passes,
 * or if the slug isn't a safe kebab-case slug.
 */
export function findLastGood(contentDir: string, slug: string, isGood: (raw: string) => boolean): string | null {
  if (!SLUG_RE.test(slug)) return null;
  const path = `posts/${slug}.md`;
  let shas: string[];
  try {
    shas = run(contentDir, ["log", "--format=%H", "--", path]).split("\n").filter(Boolean);
  } catch {
    return null;
  }
  for (const sha of shas) {
    let raw: string;
    try {
      raw = run(contentDir, ["show", `${sha}:${path}`]);
    } catch {
      continue; // file deleted in that commit
    }
    if (isGood(raw)) return raw;
  }
  return null;
}
