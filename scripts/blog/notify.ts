import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { BlogReport, Problem } from "../../lib/blog/types";

/**
 * Turns a blog check report into GitHub Issues on the content repo (spec §8):
 * one issue per post with problems (assigned to the last commit author of the
 * post), one "Blog setup needs attention" issue for non-post problems
 * (assigned to the owner), updated when the problems change, closed when
 * they're fixed. Only issues carrying our hidden marker, created by the
 * Actions bot, are ever touched.
 */
export const LABEL = "blog-check";
const BOT = "github-actions[bot]";
const SETUP_KEYS = new Set(["_tags", "_content", "_images"]);
const MAX_TEXT = 300;
const MAX_BULLETS = 30;
const MAX_BODY = 60000;
const MAX_CREATES = 20;

export type Ctx = { sha: string; author: string; owner: string; adminUrl: string };
export type OpenIssue = {
  number: number;
  body: string;
  user?: { login: string };
  assignees?: { login: string }[];
  pull_request?: unknown;
};
export type Action =
  | { kind: "create"; key: string; title: string; body: string; assignees: string[] }
  | { kind: "update"; number: number; body: string; comment?: string }
  | { kind: "close"; number: number; comment: string };

const MARKER = /<!-- blog-check:([A-Za-z0-9_-]+):([0-9a-f]{12}) -->/;
const ZWSP = "​";

/** One escape for all author-influenced text: no live mention, link, comment or HTML. */
export function safe(input: unknown, max = MAX_TEXT): string {
  let t = String(input).replace(/<!--|-->/g, "").replace(/\s*[\r\n]+\s*/g, " ");
  if (t.length > max) t = t.slice(0, max) + "…";
  return t.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/([@#])(?=\w)/g, `$1${ZWSP}`).replace(/GH(?=-\d)/g, `GH${ZWSP}`).replace(/[[\]()]/g, "\\$&");
}

export function groupProblems(report: BlogReport): Record<string, Problem[]> {
  const out: Record<string, Problem[]> = {};
  for (const [key, ps] of Object.entries(report.problems)) {
    if (!ps.length) continue;
    const k = SETUP_KEYS.has(key) ? "_setup" : key;
    (out[k] ??= []).push(...ps);
  }
  return out;
}

// Sorted (stable under reordering); "Last updated" reminders don't churn issues.
const fingerprint = (ps: Problem[]) =>
  createHash("sha256")
    .update(JSON.stringify(ps.filter((p) => p.field !== "updated").map((p) => JSON.stringify([p.level, p.field, p.message])).sort()))
    .digest("hex")
    .slice(0, 12);

const titleFor = (key: string) => (key === "_setup" ? "Blog setup needs attention" : `Post needs attention: ${key.slice(0, 80)}`);
const assigneeFor = (key: string, ctx: Ctx, authorFor: Record<string, string>) =>
  key === "_setup" ? ctx.owner : authorFor[key] || ctx.author || ctx.owner;

const bullets = (ps: Problem[]) => {
  const out = ps.slice(0, MAX_BULLETS).map((p) => `- ${safe(p.message)}`);
  if (ps.length > MAX_BULLETS) out.push(`…and ${ps.length - MAX_BULLETS} more (see the Actions log)`);
  return out;
};

export function renderBody(key: string, problems: Problem[], ctx: Ctx, who?: string): string {
  const hard = problems.filter((p) => p.level === "hard");
  const soft = problems.filter((p) => p.level === "soft");
  const person = who ?? assigneeFor(key, ctx, {});
  const lines = [
    `<!-- blog-check:${Buffer.from(key).toString("base64url")}:${fingerprint(problems)} -->`,
    key === "_setup"
      ? `@${ctx.owner}, the blog checker found a problem with the blog's settings or photo folders (commit ${ctx.sha.slice(0, 7)}).`
      : `Hi @${person}, the blog checker found something in **${safe(key)}** (commit ${ctx.sha.slice(0, 7)}).`,
    "",
  ];
  if (hard.length) lines.push("**Your latest change isn't live yet.** Fix these first:", ...bullets(hard), "");
  if (soft.length) {
    lines.push(hard.length ? "**Also worth fixing:**" : "**The post is live, but these are worth fixing:**", ...bullets(soft), "");
  }
  if (key !== "_setup") lines.push(`Open it in the editor: ${ctx.adminUrl}#/collections/blog/entries/${encodeURIComponent(key)}`, "");
  const details = problems.filter((p) => p.detail);
  if (details.length) {
    lines.push(
      "<details><summary>Technical details (for the site owner)</summary>",
      "",
      ...details.slice(0, MAX_BULLETS).map((p) => `- \`${safe(p.field, 80).replace(/`/g, "'")}\`: ${safe(p.detail).replace(/`/g, "'")}`),
      "",
      "</details>",
      ""
    );
  }
  lines.push(
    key === "_setup" || person === ctx.owner
      ? "This issue updates and closes itself when the problems are fixed."
      : `This issue updates and closes itself when the problems are fixed. cc @${ctx.owner}`
  );
  const body = lines.join("\n");
  return body.length > MAX_BODY ? body.slice(0, MAX_BODY - 40) + "\n\n…(truncated)" : body;
}

export function planActions(report: BlogReport, open: OpenIssue[], ctx: Ctx, authorFor: Record<string, string> = {}): Action[] {
  const groups = groupProblems(report);
  const byKey = new Map<string, OpenIssue & { fp: string }>();
  for (const i of open) {
    const m = i.body?.match(MARKER);
    if (m) byKey.set(Buffer.from(m[1], "base64url").toString("utf8"), { ...i, fp: m[2] });
  }
  const actions: Action[] = [];
  for (const [key, ps] of Object.entries(groups)) {
    const existing = byKey.get(key);
    if (!existing) {
      const who = assigneeFor(key, ctx, authorFor);
      actions.push({ kind: "create", key, title: titleFor(key), body: renderBody(key, ps, ctx, who), assignees: [who] });
    } else if (existing.fp !== fingerprint(ps)) {
      const who = existing.assignees?.[0]?.login || assigneeFor(key, ctx, authorFor);
      const action: Action = { kind: "update", number: existing.number, body: renderBody(key, ps, ctx, who) };
      if (ps.some((p) => p.level === "hard" && !existing.body.includes(`- ${safe(p.message)}`))) {
        action.comment = "New problem: your latest change isn't live yet. See the issue description.";
      }
      actions.push(action);
    }
  }
  for (const [key, i] of byKey) {
    if (!groups[key]) {
      actions.push({ kind: "close", number: i.number, comment: `No problems found at commit ${ctx.sha.slice(0, 7)}. Closing this issue.` });
    }
  }
  return actions;
}

// ---------------- CLI (runs in the content repo's GitHub Action) ----------------
class HttpError extends Error {
  constructor(public status: number, public text: string, what: string) {
    super(`GitHub API ${what}: ${status} ${text}`);
  }
}

type Sleep = (ms: number) => Promise<void>;
const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run(
  argv: string[],
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
  sleep: Sleep = realSleep,
  log: (m: string) => void = console.log
): Promise<number> {
  const arg = (n: string) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const reportPath = arg("--report");
  if (!reportPath || !existsSync(reportPath)) throw new Error(`--report must point to an existing report file (got ${reportPath ?? "nothing"}).`);
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as BlogReport;
  const hard = Object.values(report.problems).flat().filter((p) => p.level === "hard").length;
  if (argv.includes("--fail-on-hard")) {
    if (hard) {
      console.error(`${hard} problem(s) keep posts offline. See the repo's Issues for details.`);
      return 1;
    }
    return 0;
  }
  const repo = arg("--repo");
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`--repo must look like owner/name (got ${repo ?? "nothing"}).`);
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set.");
  const dry = env.DRY_RUN === "1";
  const ctx: Ctx = { sha: arg("--sha") ?? "", author: env.BLOG_AUTHOR ?? "", owner: env.BLOG_OWNER || "lidradmin", adminUrl: "https://lidr.io/admin/" };

  const gh = async (path: string, init: RequestInit = {}, allow422 = false) => {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    });
    if (!res.ok && !(allow422 && res.status === 422)) throw new HttpError(res.status, await res.text(), `${init.method ?? "GET"} ${path}`);
    return res;
  };
  const write = async (path: string, init: RequestInit, allow422 = false) => {
    const res = await gh(path, init, allow422);
    await sleep(1000);
    return res;
  };

  if (!dry) await write("/labels", { method: "POST", body: JSON.stringify({ name: LABEL, color: "f2e32b", description: "Automatic blog checker" }) }, true);

  const open: OpenIssue[] = [];
  for (let page = 1; page <= 20; page++) {
    const items = (await (await gh(`/issues?labels=${LABEL}&state=open&per_page=100&page=${page}`)).json()) as OpenIssue[];
    for (const i of items) if (!i.pull_request && i.user?.login === BOT) open.push(i);
    if (items.length < 100) break;
  }

  let actions = planActions(report, open, ctx);
  const authorFor: Record<string, string> = {};
  for (const a of actions) {
    if (a.kind !== "create" || a.key === "_setup") continue;
    try {
      const commits = (await (await gh(`/commits?path=${encodeURIComponent(`posts/${a.key}.md`)}&per_page=1`)).json()) as { author?: { login?: string } | null }[];
      const login = commits[0]?.author?.login;
      if (login) authorFor[a.key] = login;
    } catch {
      // fall back to BLOG_AUTHOR / owner
    }
  }
  actions = planActions(report, open, ctx, authorFor);

  let creates = 0;
  let skipped = 0;
  let done = 0;
  for (const a of actions) {
    if (dry) {
      log(JSON.stringify(a));
      continue;
    }
    if (a.kind === "create") {
      if (creates >= MAX_CREATES) {
        skipped++;
        log(`notify: skipped creating "${a.title}" (limit of ${MAX_CREATES} new issues per run)`);
        continue;
      }
      creates++;
      const make = (assignees?: string[]) =>
        write("/issues", { method: "POST", body: JSON.stringify({ title: a.title, body: a.body, labels: [LABEL], ...(assignees ? { assignees } : {}) }) });
      try {
        await make(a.assignees);
      } catch (e) {
        if (e instanceof HttpError && e.status === 422 && /assignees/i.test(e.text)) await make();
        else throw e;
      }
    } else if (a.kind === "update") {
      await write(`/issues/${a.number}`, { method: "PATCH", body: JSON.stringify({ body: a.body }) });
      if (a.comment) await write(`/issues/${a.number}/comments`, { method: "POST", body: JSON.stringify({ body: a.comment }) });
    } else {
      await write(`/issues/${a.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "completed" }) });
      await write(`/issues/${a.number}/comments`, { method: "POST", body: JSON.stringify({ body: a.comment }) });
    }
    done++;
  }
  log(`notify: ${dry ? actions.length : done} issue action(s)${skipped ? `, ${skipped} skipped` : ""}`);
  return 0;
}

if (process.argv[1]?.endsWith("notify.ts")) {
  run(process.argv.slice(2), process.env, fetch).then(
    (code) => process.exit(code),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  );
}
