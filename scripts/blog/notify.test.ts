import { describe, expect, test } from "vitest";
import type { BlogReport } from "../../lib/blog/types";
import { groupProblems, planActions, renderBody, type OpenIssue } from "./notify";

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
    expect(body).toContain("<!-- blog-check:post-a:");
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
});
