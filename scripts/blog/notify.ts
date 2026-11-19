import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { BlogReport, Problem } from "../../lib/blog/types";

/**
 * Turns a blog check report into GitHub Issues on the content repo (spec §8):
 * one issue per post with problems (assigned to the commit author), one
 * "Blog setup needs attention" issue for non-post problems (assigned to the
 * owner), updated when the problems change, closed when they're fixed.
 * Only issues carrying our hidden marker are ever touched.
 */
export const LABEL = "blog-check";
export type Ctx = { sha: string; author: string; owner: string; adminUrl: string };
export type OpenIssue = { number: number; body: string };
export type Action =
  | { kind: "create"; key: string; title: string; body: string; assignees: string[] }
  | { kind: "update"; number: number; body: string }
  | { kind: "close"; number: number; comment: string };

const MARKER = /<!-- blog-check:([a-z0-9_-]+):([0-9a-f]{12}) -->/;

export function groupProblems(report: BlogReport): Record<string, Problem[]> {
  const out: Record<string, Problem[]> = {};
  for (const [key, ps] of Object.entries(report.problems)) {
    if (!ps.length) continue;
    const k = key.startsWith("_") ? "_setup" : key;
    (out[k] ??= []).push(...ps);
  }
  return out;
}

// Sorted so the same problems in a different order give the same fingerprint.
const fingerprint = (ps: Problem[]) =>
  createHash("sha256")
    .update(JSON.stringify(ps.map((p) => JSON.stringify([p.level, p.field, p.message])).sort()))
    .digest("hex")
    .slice(0, 12);

const titleFor = (key: string) => (key === "_setup" ? "Blog setup needs attention" : `Post needs attention: ${key}`);

export function renderBody(key: string, problems: Problem[], ctx: Ctx): string {
  const hard = problems.filter((p) => p.level === "hard");
  const soft = problems.filter((p) => p.level === "soft");
  const who = key === "_setup" ? `@${ctx.owner}` : ctx.author ? `@${ctx.author}` : `@${ctx.owner}`;
  const lines = [
    `<!-- blog-check:${key}:${fingerprint(problems)} -->`,
    key === "_setup"
      ? `${who}, the blog checker found a problem with the blog's settings or photo folders (commit ${ctx.sha.slice(0, 7)}).`
      : `Hi ${who}, the blog checker found something in **${key}** (commit ${ctx.sha.slice(0, 7)}).`,
    "",
  ];
  if (hard.length) {
    lines.push("**Your latest change isn't live yet.** Fix these first:", ...hard.map((p) => `- ${p.message}`), "");
  }
  if (soft.length) {
    lines.push(hard.length ? "**Also worth fixing:**" : "**The post is live, but these are worth fixing:**", ...soft.map((p) => `- ${p.message}`), "");
  }
  if (key !== "_setup") lines.push(`Open it in the editor: ${ctx.adminUrl}#/collections/blog/entries/${key}`, "");
  const details = problems.filter((p) => p.detail);
  if (details.length) {
    lines.push("<details><summary>Technical details (for the site owner)</summary>", "", ...details.map((p) => `- \`${p.field}\`: ${p.detail}`), "", "</details>", "");
  }
  lines.push(`This issue updates and closes itself when the problems are fixed. cc @${ctx.owner}`);
  return lines.join("\n");
}

export function planActions(report: BlogReport, open: OpenIssue[], ctx: Ctx): Action[] {
  const groups = groupProblems(report);
  const byKey = new Map<string, OpenIssue & { fp: string }>();
  for (const i of open) {
    const m = i.body?.match(MARKER);
    if (m) byKey.set(m[1], { ...i, fp: m[2] });
  }
  const actions: Action[] = [];
  for (const [key, ps] of Object.entries(groups)) {
    const existing = byKey.get(key);
    const body = renderBody(key, ps, ctx);
    if (!existing) {
      const assignee = key === "_setup" ? ctx.owner : ctx.author || ctx.owner;
      actions.push({ kind: "create", key, title: titleFor(key), body, assignees: [assignee] });
    } else if (existing.fp !== fingerprint(ps)) {
      actions.push({ kind: "update", number: existing.number, body });
    }
  }
  for (const [key, i] of byKey) {
    if (!groups[key]) actions.push({ kind: "close", number: i.number, comment: `Fixed. The checker found no problems at commit ${ctx.sha.slice(0, 7)}. Thanks!` });
  }
  return actions;
}

// ---------------- CLI (runs in the content repo's GitHub Action) ----------------
async function gh(repo: string, token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
  });
  if (!res.ok && res.status !== 422) throw new Error(`GitHub API ${init.method ?? "GET"} ${path}: ${res.status} ${await res.text()}`);
  return res;
}

async function main() {
  const arg = (n: string) => {
    const i = process.argv.indexOf(n);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const report = JSON.parse(readFileSync(arg("--report")!, "utf8")) as BlogReport;
  const hard = Object.values(report.problems).flat().filter((p) => p.level === "hard").length;
  if (process.argv.includes("--fail-on-hard")) {
    if (hard) {
      console.error(`${hard} problem(s) keep posts offline. See the repo's Issues for details.`);
      process.exit(1);
    }
    return;
  }
  const repo = arg("--repo")!;
  const token = process.env.GITHUB_TOKEN!;
  const ctx: Ctx = { sha: arg("--sha") ?? "", author: process.env.BLOG_AUTHOR ?? "", owner: process.env.BLOG_OWNER || "lidradmin", adminUrl: "https://lidr.io/admin/" };
  await gh(repo, token, "/labels", { method: "POST", body: JSON.stringify({ name: LABEL, color: "f2e32b", description: "Automatic blog checker" }) });
  const open = (await (await gh(repo, token, `/issues?labels=${LABEL}&state=open&per_page=100`)).json()) as OpenIssue[];
  const actions = planActions(report, open, ctx);
  for (const a of actions) {
    if (process.env.DRY_RUN === "1") {
      console.log(JSON.stringify(a));
      continue;
    }
    if (a.kind === "create") {
      const res = await gh(repo, token, "/issues", { method: "POST", body: JSON.stringify({ title: a.title, body: a.body, labels: [LABEL], assignees: a.assignees }) });
      if (res.status === 422) {
        // e.g. the assignee can't be assigned: create without assignee
        await gh(repo, token, "/issues", { method: "POST", body: JSON.stringify({ title: a.title, body: a.body, labels: [LABEL] }) });
      }
    } else if (a.kind === "update") {
      await gh(repo, token, `/issues/${a.number}`, { method: "PATCH", body: JSON.stringify({ body: a.body }) });
    } else {
      await gh(repo, token, `/issues/${a.number}/comments`, { method: "POST", body: JSON.stringify({ body: a.comment }) });
      await gh(repo, token, `/issues/${a.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "completed" }) });
    }
  }
  console.log(`notify: ${actions.length} issue action(s)`);
}

if (process.argv[1]?.endsWith("notify.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
