import { execFileSync } from "node:child_process";
import { parsePostFile } from "../../lib/blog/validate";
import type { Problem } from "../../lib/blog/types";

const SHA = /^[0-9a-f]{40}$/;
const git = (cwd: string, args: string[]) =>
  execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"], timeout: 30_000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).toString();

/**
 * For posts whose TEXT changed since `sinceSha` but whose `updated` date
 * didn't, returns a soft reminder (spec §5). Best effort: any git failure or
 * unknown sha returns {} — a reminder must never break a check run.
 */
export function staleUpdatedProblems(contentDir: string, sinceSha: string): Record<string, Problem[]> {
  if (!SHA.test(sinceSha) || /^0+$/.test(sinceSha)) return {};
  let files: string[];
  try {
    files = git(contentDir, ["diff", "--relative", "--name-only", "--diff-filter=M", sinceSha, "HEAD", "--", "./posts/"])
      .split("\n")
      .filter((f) => /^posts\/[a-z0-9-]+\.md$/.test(f));
  } catch {
    return {};
  }
  const out: Record<string, Problem[]> = {};
  for (const f of files) {
    try {
      const before = parsePostFile(git(contentDir, ["show", `${sinceSha}:./${f}`]));
      const after = parsePostFile(git(contentDir, ["show", `HEAD:./${f}`]));
      if (!before.ok || !after.ok) continue;
      const textChanged = before.body.trim() !== after.body.trim();
      const updatedSame = String(before.data.updated ?? "") === String(after.data.updated ?? "");
      if (textChanged && updatedSame && after.data.draft !== true) {
        const slug = f.slice("posts/".length, -".md".length);
        out[slug] = [{ level: "soft", field: "updated", message: "You changed this post's text but didn't set 'Last updated'. Set it to today so readers and Google know the post is fresh." }];
      }
    } catch {
      continue;
    }
  }
  return out;
}
