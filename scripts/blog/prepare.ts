import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBlogData } from "./pipeline";
import { resolveContentDir } from "./source";

/**
 * npm run blog:prepare — runs before `next build` / `next dev`.
 *   writes .blog/data.json (read by the Next pages) and .blog/report.json
 *   writes optimised images + OG images into public/images/blog/
 * npm run blog:check — same, strict, outputs to a temp dir (CI / Claude skill).
 */
async function main() {
  const cwd = process.cwd();
  const check = process.argv.includes("--check");
  const strict = process.env.BLOG_STRICT === "1";
  const contentDir = resolveContentDir(process.env, join(cwd, ".blog-content"));
  const publicDir = check ? mkdtempSync(join(tmpdir(), "blog-check-")) : join(cwd, "public");
  if (!check) {
    rmSync(join(publicDir, "images", "blog"), { recursive: true, force: true });
    rmSync(join(cwd, ".blog"), { recursive: true, force: true });
  }

  let result;
  try {
    result = await buildBlogData({ contentDir, publicDir, strict });
  } finally {
    if (check) rmSync(publicDir, { recursive: true, force: true });
  }
  const { data, report } = result;

  if (!check) {
    mkdirSync(join(cwd, ".blog"), { recursive: true });
    writeFileSync(join(cwd, ".blog/data.json"), JSON.stringify(data));
    writeFileSync(join(cwd, ".blog/report.json"), JSON.stringify(report, null, 2));
  }

  const problems = Object.entries(report.problems);
  console.log(
    data.enabled
      ? `blog: ${data.posts.length} post(s), ${data.tags.length} tag(s), ${data.redirects.length} redirect(s), ${problems.length} item(s) with problems`
      : "blog: disabled (set BLOG_CONTENT_REPO or BLOG_CONTENT_DIR to enable)"
  );
  for (const [key, ps] of problems) {
    for (const p of ps) {
      console.warn(`  ${key} [${p.level}] ${p.field}: ${p.message}`);
      if (p.detail) console.warn(`    ${p.detail}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
