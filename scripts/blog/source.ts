import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Where blog content comes from:
 *   BLOG_CONTENT_DIR  — a local folder (tests, local editing)
 *   BLOG_CONTENT_REPO — a git URL, cloned fresh into `cloneTarget` (production)
 *   neither           — blog disabled (returns null)
 * A failed clone THROWS so the build fails and Cloudflare keeps the last
 * good deployment instead of publishing an empty blog.
 */
export function resolveContentDir(env: NodeJS.ProcessEnv | Record<string, string | undefined>, cloneTarget: string): string | null {
  if (env.BLOG_CONTENT_DIR) {
    const dir = resolve(env.BLOG_CONTENT_DIR);
    if (!existsSync(dir)) throw new Error(`BLOG_CONTENT_DIR ${dir} does not exist`);
    return dir;
  }
  if (env.BLOG_CONTENT_REPO) {
    rmSync(cloneTarget, { recursive: true, force: true });
    try {
      // blob:none keeps the clone small; history blobs load lazily for findLastGood.
      // `--` stops a URL starting with "-" from being parsed as an option.
      execFileSync("git", ["clone", "--quiet", "--filter=blob:none", "--", env.BLOG_CONTENT_REPO, cloneTarget], { stdio: "pipe" });
    } catch (err) {
      throw new Error(`Could not fetch blog content from ${env.BLOG_CONTENT_REPO}: ${(err as Error).message}`);
    }
    return cloneTarget;
  }
  return null;
}
