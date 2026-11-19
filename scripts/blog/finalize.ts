import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLACEHOLDER } from "../../lib/blog/data";
import type { BlogData } from "../../lib/blog/types";

const MARKER = "# blog (generated)";

function removePlaceholders(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.name === PLACEHOLDER || entry.name.startsWith(`${PLACEHOLDER}.`)) rmSync(path, { recursive: true, force: true });
    else if (entry.isDirectory()) removePlaceholders(path);
  }
}

export function finalizeOut(outDir: string, data: BlogData) {
  const blogDir = join(outDir, "blog");
  if (existsSync(blogDir)) {
    removePlaceholders(blogDir);
    // Pagination/tag index dirs that only held placeholders are now empty; drop them.
    for (const d of ["page", "tag"]) {
      const dir = join(blogDir, d);
      if (existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir);
    }
  }
  if (data.redirects.length) {
    const lines = data.redirects.flatMap(({ from, to }) => [`${from}  ${to}  301`, `${from.replace(/\/$/, "")}  ${to}  301`]);
    const file = join(outDir, "_redirects");
    let existing = existsSync(file) ? readFileSync(file, "utf8") : "";
    const at = existing.indexOf(MARKER);
    if (at !== -1) existing = existing.slice(0, at).replace(/\n+$/, "\n");
    writeFileSync(file, `${existing}\n${MARKER}\n${lines.join("\n")}\n`);
  }
}

// CLI: `tsx scripts/blog/finalize.ts` (npm postbuild)
if (process.argv[1]?.endsWith("finalize.ts")) {
  const dataFile = join(process.cwd(), ".blog/data.json");
  const outDir = join(process.cwd(), "out");
  if (!existsSync(dataFile) || !existsSync(outDir)) {
    console.error("blog: .blog/data.json or out/ is missing. Run `npm run build` (not `next build`) so prebuild and postbuild both run.");
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(dataFile, "utf8")) as BlogData;
  finalizeOut(outDir, data);
  console.log(`blog: finalized out/ (${data.redirects.length} redirect(s))`);
}
