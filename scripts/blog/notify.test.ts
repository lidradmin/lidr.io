import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { BlogReport } from "../../lib/blog/types";
import { groupProblems, planActions, renderBody, run, type OpenIssue } from "./notify";

const ctx = { sha: "abcdef1234567890", author: "writer1", owner: "boss", adminUrl: "https://lidr.io/admin/" };
const report: BlogReport = {
  problems: {
    "post-a": [
      { level: "hard", field: "title", message: "The post has no title." },
      { level: "soft", field: "description", message: "Too long.", detail: "raw" },
    ],
    _tags: [{ level: "soft", field: "tags.yml", message: "Tag list broken." }],
    _images: [{ level: "soft", field: "images", message: "Orphan folder." }],
  },
};

describe("notify", () => {
  test("groups underscore keys into one setup issue", () => {
    const g = groupProblems(report);
    expect(Object.keys(g).sort()).toEqual(["_setup", "post-a"]);
    expect(g._setup).toHaveLength(2);
  });

  test("body: plain English, hard first, author + owner mentioned, edit link, marker", () => {
    const body = renderBody("post-a", report.problems["post-a"], ctx);
    expect(body).toContain(`<!-- blog-check:${Buffer.from("post-a").toString("base64url")}:`);
    expect(body).toContain("@writer1");
    expect(body).toContain("@boss");
    expect(body.indexOf("no title")).toBeLessThan(body.indexOf("Too long"));
    expect(body).toContain("https://lidr.io/admin/#/collections/blog/entries/post-a");
    expect(body).toContain("<details>");
  });

  test("creates new issues, updates changed ones, closes fixed ones, leaves unchanged alone", () => {
    const unchangedBody = renderBody("post-c", [{ level: "soft", field: "x", message: "Same." }], ctx);
    const open: OpenIssue[] = [
      { number: 1, body: renderBody("post-a", [{ level: "soft", field: "x", message: "Old." }], ctx) },
      { number: 2, body: renderBody("post-b", [{ level: "soft", field: "x", message: "Fixed now." }], ctx) },
      { number: 3, body: unchangedBody },
      { number: 4, body: "unrelated issue without marker" },
    ];
    const r: BlogReport = { problems: { ...report.problems, "post-c": [{ level: "soft", field: "x", message: "Same." }] } };
    const actions = planActions(r, open, ctx);
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "update", number: 1 }),
        expect.objectContaining({ kind: "close", number: 2 }),
        expect.objectContaining({ kind: "create", key: "_setup", title: "Blog setup needs attention", assignees: ["boss"] }),
      ])
    );
    expect(actions.find((a) => "number" in a && a.number === 3)).toBeUndefined();
    expect(actions.find((a) => "number" in a && a.number === 4)).toBeUndefined();
    const createPost = planActions({ problems: { "post-z": [{ level: "soft", field: "x", message: "y" }] } }, [], ctx)[0];
    expect(createPost).toMatchObject({ kind: "create", title: "Post needs attention: post-z", assignees: ["writer1"] });
  });

  test("no author → assign owner", () => {
    const a = planActions({ problems: { p: [{ level: "soft", field: "x", message: "y" }] } }, [], { ...ctx, author: "" })[0];
    expect(a).toMatchObject({ assignees: ["boss"] });
  });

  test("same problems in a different order do not trigger an update", () => {
    const p1 = { level: "hard" as const, field: "title", message: "No title." };
    const p2 = { level: "soft" as const, field: "description", message: "Too long." };
    const open: OpenIssue[] = [{ number: 7, body: renderBody("post-a", [p1, p2], ctx) }];
    expect(planActions({ problems: { "post-a": [p2, p1] } }, open, ctx)).toEqual([]);
  });

  test("report key moving from a post slug to _setup creates setup issue and closes the post issue", () => {
    const open: OpenIssue[] = [
      { number: 9, body: renderBody("post-a", [{ level: "soft", field: "x", message: "Old." }], ctx) },
    ];
    const actions = planActions({ problems: { _tags: [{ level: "soft", field: "tags.yml", message: "Broken." }] } }, open, ctx);
    expect(actions).toHaveLength(2);
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "create", key: "_setup" }),
        expect.objectContaining({ kind: "close", number: 9 }),
      ])
    );
  });

  test("marker round-trips awkward keys: existing issue is left alone or updated, never duplicated", () => {
    const key = "My Post.v2";
    const ps = [{ level: "soft" as const, field: "x", message: "Same." }];
    const open: OpenIssue[] = [{ number: 5, body: renderBody(key, ps, ctx) }];
    expect(planActions({ problems: { [key]: ps } }, open, ctx)).toEqual([]);
    const changed = planActions({ problems: { [key]: [{ level: "soft", field: "x", message: "Different." }] } }, open, ctx);
    expect(changed).toEqual([expect.objectContaining({ kind: "update", number: 5 })]);
  });

  test("titles cap the key at 80 characters", () => {
    const a = planActions({ problems: { ["a".repeat(200)]: [{ level: "soft", field: "x", message: "y" }] } }, [], ctx)[0];
    expect(a).toMatchObject({ kind: "create" });
    expect((a as { title: string }).title.length).toBeLessThanOrEqual("Post needs attention: ".length + 80);
  });

  test("author-influenced text renders with no live mention, comment, link or HTML", () => {
    const nasty = [
      { level: "hard" as const, field: "f", message: "ping @octocat --> <!-- see org/repo#1 <img src=x onerror=1>", detail: "@octocat <!-- <b>" },
    ];
    const body = renderBody("post-a", nasty, ctx);
    const rest = body.split("\n").slice(1).join("\n");
    expect(rest).not.toContain("@octocat");
    expect(rest).not.toContain("<!--");
    expect(rest).not.toContain("-->");
    expect(rest).not.toContain("<img");
    expect(rest).not.toContain("<b>");
    expect(rest).not.toContain("repo#1");
    expect(body.match(/<!--/g)).toHaveLength(1); // only our marker
  });

  test("long messages are truncated, long lists capped, body hard-capped with marker kept", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ level: "soft" as const, field: "f", message: "m" + i + "x".repeat(500) }));
    const body = renderBody("post-a", many, ctx);
    expect(body).toContain("…and 70 more (see the Actions log)");
    expect(body.length).toBeLessThanOrEqual(60000);
    expect(body.startsWith("<!-- blog-check:")).toBe(true);
    const huge = Array.from({ length: 30 }, () => ({ level: "soft" as const, field: "f", message: "x", detail: "d".repeat(5000) }));
    expect(renderBody("post-a", huge, ctx).length).toBeLessThanOrEqual(60000);
  });

  test("updated-field reminders don't change the fingerprint but still appear in the body", () => {
    const base = [{ level: "soft" as const, field: "x", message: "A." }];
    const withUpdated = [...base, { level: "soft" as const, field: "updated", message: "Set Last updated." }];
    const open: OpenIssue[] = [{ number: 1, body: renderBody("p", base, ctx) }];
    expect(planActions({ problems: { p: withUpdated } }, open, ctx)).toEqual([]);
    expect(renderBody("p", withUpdated, ctx)).toContain("Set Last updated.");
  });

  test("only _tags/_content/_images are setup keys; other underscore keys are posts", () => {
    const g = groupProblems({ problems: { _content: [{ level: "soft", field: "a", message: "b" }], _weird: [{ level: "soft", field: "a", message: "b" }] } });
    expect(Object.keys(g).sort()).toEqual(["_setup", "_weird"]);
  });

  test("close comment is neutral", () => {
    const open: OpenIssue[] = [{ number: 2, body: renderBody("post-b", [{ level: "soft", field: "x", message: "y" }], ctx) }];
    expect(planActions({ problems: {} }, open, ctx)).toEqual([
      { kind: "close", number: 2, comment: "No problems found at commit abcdef1. Closing this issue." },
    ]);
  });

  test("create uses authorFor; update keeps the issue's existing assignee; new hard problem adds a comment", () => {
    const created = planActions({ problems: { p: [{ level: "soft", field: "x", message: "y" }] } }, [], ctx, { p: "alice" })[0];
    expect(created).toMatchObject({ kind: "create", assignees: ["alice"] });
    expect((created as { body: string }).body).toContain("@alice");
    const open: OpenIssue[] = [
      { number: 3, body: renderBody("p", [{ level: "soft", field: "x", message: "y" }], ctx, "alice"), assignees: [{ login: "alice" }] },
    ];
    const [u] = planActions({ problems: { p: [{ level: "hard", field: "t", message: "No title." }] } }, open, ctx);
    expect(u).toMatchObject({ kind: "update", number: 3 });
    expect((u as { body: string }).body).toContain("@alice");
    expect((u as { body: string }).body).not.toContain("@writer1");
    expect((u as { comment?: string }).comment).toContain("New problem");
  });
});

// ---------------- run() with an injected fetch ----------------
type Call = { method: string; url: string; body: unknown };
const BOT = { login: "github-actions[bot]" };
const writeReport = (r: BlogReport) => {
  const f = join(mkdtempSync(join(tmpdir(), "notify-")), "r.json");
  writeFileSync(f, JSON.stringify(r));
  return f;
};
function mock(handler: (c: Call) => { status?: number; json?: unknown } | undefined) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const c: Call = { method: init.method ?? "GET", url: String(url), body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    const r = handler(c) ?? { json: {} };
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}
const noSleep = async () => {};
const env = { GITHUB_TOKEN: "t", BLOG_OWNER: "boss", BLOG_AUTHOR: "pusher" };
const args = (file: string) => ["--report", file, "--repo", "o/r", "--sha", "abcdef1234567"];
const quiet = () => {};
const softP = [{ level: "soft" as const, field: "x", message: "y" }];

describe("run", () => {
  test("paginates, skips PRs and non-bot issues", async () => {
    const filler = (n: number) => ({ number: n, body: "no marker", user: BOT });
    const page1 = [{ number: 1, body: renderBody("post-a", [{ level: "soft", field: "x", message: "Old." }], ctx), user: BOT }, ...Array.from({ length: 99 }, (_, i) => filler(1000 + i))];
    const page2 = [
      { number: 200, body: renderBody("post-b", softP, ctx), user: BOT },
      { number: 201, body: renderBody("post-pr", softP, ctx), user: BOT, pull_request: {} },
      { number: 202, body: renderBody("post-human", softP, ctx), user: { login: "human" } },
    ];
    const { calls, fetchImpl } = mock((c) => {
      if (c.method === "GET" && c.url.includes("/issues?")) return { json: c.url.includes("page=2") ? page2 : page1 };
    });
    await run(args(writeReport({ problems: { "post-a": softP } })), env, fetchImpl, noSleep, quiet);
    expect(calls.some((c) => c.url.includes("page=2"))).toBe(true);
    const patches = calls.filter((c) => c.method === "PATCH").map((c) => c.url.split("/").pop());
    expect(patches.sort()).toEqual(["1", "200"]);
    expect(calls.some((c) => c.url.endsWith("/issues/201") || c.url.endsWith("/issues/202"))).toBe(false);
    const closeIdx = calls.findIndex((c) => c.method === "PATCH" && c.url.endsWith("/200"));
    const commentIdx = calls.findIndex((c) => c.url.endsWith("/200/comments"));
    expect(closeIdx).toBeLessThan(commentIdx);
  });

  test("create looks up the commit author and retries without assignees on an assignees 422", async () => {
    let posts = 0;
    const { calls, fetchImpl } = mock((c) => {
      if (c.method === "GET" && c.url.includes("/commits?")) return { json: [{ author: { login: "alice" } }] };
      if (c.method === "POST" && c.url.endsWith("/issues")) {
        posts++;
        if (posts === 1) return { status: 422, json: { message: "Validation Failed", errors: [{ field: "assignees", code: "invalid" }] } };
        return { status: 201, json: {} };
      }
      if (c.url.includes("/issues?")) return { json: [] };
    });
    await run(args(writeReport({ problems: { "post-x": softP } })), env, fetchImpl, noSleep, quiet);
    const creates = calls.filter((c) => c.method === "POST" && c.url.endsWith("/issues"));
    expect(creates).toHaveLength(2);
    expect((creates[0].body as { assignees: string[] }).assignees).toEqual(["alice"]);
    expect((creates[1].body as { assignees?: string[] }).assignees).toBeUndefined();
    expect(calls.find((c) => c.url.includes("/commits?"))!.url).toContain("path=posts%2Fpost-x.md");
  });

  test("a create 422 about something else throws", async () => {
    const { fetchImpl } = mock((c) => {
      if (c.method === "POST" && c.url.endsWith("/issues")) return { status: 422, json: { errors: [{ field: "body", code: "too_long" }] } };
      if (c.url.includes("/issues?")) return { json: [] };
    });
    await expect(run(args(writeReport({ problems: { "post-x": softP } })), env, fetchImpl, noSleep, quiet)).rejects.toThrow(/422/);
  });

  test("DRY_RUN makes no writes at all", async () => {
    const { calls, fetchImpl } = mock((c) => (c.url.includes("/issues?") ? { json: [] } : undefined));
    await run(args(writeReport({ problems: { "post-x": softP } })), { ...env, DRY_RUN: "1" }, fetchImpl, noSleep, quiet);
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  test("validates --repo and token up front", async () => {
    const { fetchImpl } = mock(() => undefined);
    const f = writeReport({ problems: {} });
    await expect(run(["--report", f, "--repo", "nope"], env, fetchImpl, noSleep, quiet)).rejects.toThrow(/--repo/);
    await expect(run(args(f), {}, fetchImpl, noSleep, quiet)).rejects.toThrow(/GITHUB_TOKEN/);
  });
});
