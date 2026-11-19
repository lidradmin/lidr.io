import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { basename, resolve } from "node:path";

const redact = (s: string) => s.replace(/\/\/[^@/\s]*@/g, "//***@");

/** git clone argv. `--` stops a URL starting with "-" being parsed as an option. */
export function cloneArgs(url: string, target: string): string[] {
  return [
    "-c", "core.symlinks=false",
    "-c", "filter.lfs.smudge=",
    "-c", "filter.lfs.process=",
    "-c", "filter.lfs.required=false",
    "clone", "--quiet",
    // blob:none keeps the clone small; history blobs load lazily for findLastGood.
    "--filter=blob:none",
    "--", url, target,
  ];
}

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
    // The target is deleted recursively, so refuse anything but our own dir.
    if (basename(resolve(cloneTarget)) !== ".blog-content") {
      throw new Error(`Refusing to clone into ${cloneTarget}: target must be named .blog-content`);
    }
    rmSync(cloneTarget, { recursive: true, force: true });
    const url = env.BLOG_CONTENT_REPO;
    try {
      execFileSync("git", cloneArgs(url, cloneTarget), {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_LFS_SKIP_SMUDGE: "1" },
      });
    } catch (err) {
      const e = err as { stderr?: Buffer | string; code?: string; signal?: string };
      const detail = redact(e.stderr?.toString().trim() ?? "") || e.code || e.signal || "unknown error";
      throw new Error(`Could not fetch blog content from ${redact(url)}: ${detail}`);
    }
    return cloneTarget;
  }
  return null;
}
