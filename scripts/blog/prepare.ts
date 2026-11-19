import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { staleUpdatedProblems } from "./changes";
import { renderOgImage } from "./og";
import { buildBlogData, countProblems, formatProblems } from "./pipeline";
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
  const ri = process.argv.indexOf("--report");
  const reportPath = ri >= 0 ? process.argv[ri + 1] : undefined;
  if (ri >= 0 && !reportPath) throw new Error("--report needs a file path");
  const contentDir = resolveContentDir(process.env, join(cwd, ".blog-content"));
  const publicDir = check ? mkdtempSync(join(tmpdir(), "blog-check-")) : join(cwd, "public");
  if (!check) {
    rmSync(join(publicDir, "images", "blog"), { recursive: true, force: true });
    rmSync(join(cwd, ".blog"), { recursive: true, force: true });
  }

  let result;
  try {
    result = await buildBlogData({ contentDir, publicDir });
  } finally {
    if (check) rmSync(publicDir, { recursive: true, force: true });
  }
  const { data, report } = result;

  const si = process.argv.indexOf("--since");
  const since = si >= 0 ? process.argv[si + 1] : undefined;
  if (since && contentDir) {
    for (const [slug, ps] of Object.entries(staleUpdatedProblems(contentDir, since))) {
      if (data.posts.some((p) => p.slug === slug)) (report.problems[slug] ??= []).push(...ps);
    }
  }

  if (!check) {
    mkdirSync(join(cwd, ".blog"), { recursive: true });
    writeFileSync(join(cwd, ".blog/data.json"), JSON.stringify(data));
    writeFileSync(join(cwd, ".blog/report.json"), JSON.stringify(report, null, 2));
    // Default share image for the index, page-N and tag pages. Always rendered (even when the
    // blog is disabled) because /blog/ links it; a failure here is a code bug, so let it throw.
    const ogDir = join(publicDir, "images", "blog", "_og");
    mkdirSync(ogDir, { recursive: true });
    writeFileSync(join(ogDir, "_blog.png"), await renderOgImage({ title: "Lidr.io Blog", tagName: "Guides for site teams" }));
  }

  if (reportPath) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  const problems = Object.entries(report.problems);
  const problemCount = countProblems(report);
  console.log(
    data.enabled
      ? `blog: ${data.posts.length} post(s), ${data.tags.length} tag(s), ${data.redirects.length} redirect(s), ${problems.length} item(s) with problems`
      : "blog: disabled (set BLOG_CONTENT_REPO or BLOG_CONTENT_DIR to enable)"
  );
  for (const line of formatProblems(report)) console.warn(line);
  if (strict && problemCount > 0) {
    console.error(`blog: ${problemCount} problem(s) found and BLOG_STRICT=1`);
    process.exit(1);
  }
  const hard = Object.values(report.problems).flat().filter((p) => p.level === "hard").length;
  if (process.env.BLOG_FAIL_ON === "hard" && hard > 0) {
    console.error(`blog: ${hard} problem(s) keep posts offline (BLOG_FAIL_ON=hard)`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
