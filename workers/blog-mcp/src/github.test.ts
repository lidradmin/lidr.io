import { describe, expect, test, vi } from "vitest";
import { GitHub, GitHubAuthError } from "./github";

const REPO = "lidradmin/lidr-blog";
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
type Call = { method: string; path: string; body: any; auth: string | null };

/** Fake GitHub: routes by "METHOD path", records every call. */
function fake(routes: Record<string, (body: any, n: number) => Response>) {
  const calls: Call[] = [];
  const counts: Record<string, number> = {};
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const key = `${method} ${url.pathname}`;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const headers = new Headers(init?.headers);
    calls.push({ method, path: url.pathname, body, auth: headers.get("Authorization") });
    counts[key] = (counts[key] ?? 0) + 1;
    const h = routes[key];
    return h ? h(body, counts[key]) : new Response("not found", { status: 404 });
  });
  return { gh: new GitHub("tok", fetcher as unknown as typeof fetch), calls };
}

describe("GitHub", () => {
  test("whoAmI and canWrite send the user's token", async () => {
    const { gh, calls } = fake({
      "GET /user": () => ok({ id: 7, login: "eoin" }),
      [`GET /repos/${REPO}`]: () => ok({ permissions: { push: true } }),
    });
    expect(await gh.whoAmI()).toEqual({ id: 7, login: "eoin" });
    expect(await gh.canWrite(REPO)).toBe(true);
    expect(calls.every((c) => c.auth === "Bearer tok")).toBe(true);
  });

  test("canWrite is false without push permission or on 404", async () => {
    expect(await fake({ [`GET /repos/${REPO}`]: () => ok({ permissions: { push: false } }) }).gh.canWrite(REPO)).toBe(false);
    expect(await fake({}).gh.canWrite(REPO)).toBe(false);
  });

  test("401 becomes GitHubAuthError", async () => {
    await expect(fake({ "GET /user": () => new Response("", { status: 401 }) }).gh.whoAmI()).rejects.toBeInstanceOf(GitHubAuthError);
  });

  test("readFile decodes UTF-8 and returns null for missing files", async () => {
    const content = btoa(String.fromCharCode(...new TextEncoder().encode("Café ✓")));
    const { gh } = fake({ [`GET /repos/${REPO}/contents/tags.yml`]: () => ok({ type: "file", content, encoding: "base64" }) });
    expect(await gh.readFile(REPO, "tags.yml")).toBe("Café ✓");
    expect(await gh.readFile(REPO, "nope.yml")).toBeNull();
  });

  test("listDir returns file names, [] when missing", async () => {
    const { gh } = fake({ [`GET /repos/${REPO}/contents/posts`]: () => ok([{ name: "a.md", type: "file" }, { name: "x", type: "dir" }]) });
    expect(await gh.listDir(REPO, "posts")).toEqual(["a.md"]);
    expect(await gh.listDir(REPO, "images/none")).toEqual([]);
  });

  const commitRoutes = (refUpdate: (n: number) => Response) => ({
    [`GET /repos/${REPO}/git/ref/heads/main`]: () => ok({ object: { sha: "base" } }),
    [`GET /repos/${REPO}/git/commits/base`]: () => ok({ tree: { sha: "basetree" } }),
    [`POST /repos/${REPO}/git/blobs`]: (_b: unknown, n: number) => ok({ sha: `blob${n}` }, 201),
    [`POST /repos/${REPO}/git/trees`]: () => ok({ sha: "newtree" }, 201),
    [`POST /repos/${REPO}/git/commits`]: () => ok({ sha: "newcommit" }, 201),
    [`PATCH /repos/${REPO}/git/refs/heads/main`]: (_b: unknown, n: number) => refUpdate(n),
  });

  test("commit writes all files in one commit on main", async () => {
    const { gh, calls } = fake(commitRoutes(() => ok({ object: { sha: "newcommit" } })));
    const res = await gh.commit(REPO, [
      { path: "posts/a.md", content: "hello ✓" },
      { path: "images/a/p.jpg", content: new Uint8Array([0xff, 0xd8, 0xff]) },
    ], 'Publish blog post "a"');
    expect(res).toEqual({ sha: "newcommit" });
    const blobs = calls.filter((c) => c.path.endsWith("/git/blobs")).map((c) => c.body);
    expect(blobs[0]).toEqual({ content: "hello ✓", encoding: "utf-8" });
    expect(blobs[1]).toEqual({ content: "/9j/", encoding: "base64" });
    const tree = calls.find((c) => c.path.endsWith("/git/trees"))!.body;
    expect(tree).toEqual({
      base_tree: "basetree",
      tree: [
        { path: "posts/a.md", mode: "100644", type: "blob", sha: "blob1" },
        { path: "images/a/p.jpg", mode: "100644", type: "blob", sha: "blob2" },
      ],
    });
    expect(calls.find((c) => c.path.endsWith("/git/commits") && c.method === "POST")!.body).toEqual({ message: 'Publish blog post "a"', tree: "newtree", parents: ["base"] });
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ sha: "newcommit", force: false });
  });

  test("commit retries once when main moved underneath it", async () => {
    const { gh, calls } = fake(commitRoutes((n) => (n === 1 ? new Response("not fast forward", { status: 422 }) : ok({}))));
    await gh.commit(REPO, [{ path: "posts/a.md", content: "x" }], "m");
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(2);
  });

  test("commit gives up after the retry", async () => {
    const { gh } = fake(commitRoutes(() => new Response("not fast forward", { status: 422 })));
    await expect(gh.commit(REPO, [{ path: "posts/a.md", content: "x" }], "m")).rejects.toThrow(/changed while saving/);
  });

  test("403 (no access) explains itself", async () => {
    const { gh } = fake({ [`GET /repos/${REPO}/git/ref/heads/main`]: () => new Response("forbidden", { status: 403 }) });
    await expect(gh.commit(REPO, [{ path: "posts/a.md", content: "x" }], "m")).rejects.toThrow(/permission/);
  });
});
