import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { BlogData } from "../../lib/blog/types";

/** Placeholder param used when a dynamic blog route has nothing to build (see lib/blog/data.ts). */
const PLACEHOLDER = "__empty";

function removePlaceholders(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.name.startsWith(PLACEHOLDER)) rmSync(path, { recursive: true, force: true });
    else if (entry.isDirectory()) removePlaceholders(path);
  }
}

export function finalizeOut(outDir: string, data: BlogData) {
  const blogDir = join(outDir, "blog");
  if (existsSync(blogDir)) removePlaceholders(blogDir);
  if (data.redirects.length) {
    const lines = data.redirects.flatMap(({ from, to }) => [`${from}  ${to}  301`, `${from.replace(/\/$/, "")}  ${to}  301`]);
    appendFileSync(join(outDir, "_redirects"), `\n# blog (generated)\n${lines.join("\n")}\n`);
  }
}

// CLI: `tsx scripts/blog/finalize.ts` (npm postbuild)
if (process.argv[1]?.endsWith("finalize.ts")) {
  const data = JSON.parse(readFileSync(join(process.cwd(), ".blog/data.json"), "utf8")) as BlogData;
  finalizeOut(join(process.cwd(), "out"), data);
  console.log(`blog: finalized out/ (${data.redirects.length} redirect(s))`);
}
