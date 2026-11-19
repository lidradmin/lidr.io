import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function load(data?: unknown) {
  const dir = mkdtempSync(join(tmpdir(), "blogdata-"));
  if (data !== undefined) {
    mkdirSync(join(dir, ".blog"));
    writeFileSync(join(dir, ".blog/data.json"), JSON.stringify(data));
  }
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  vi.resetModules();
  return import("./data");
}

const post = { slug: "a", title: "A", tags: ["x"] };

test("paramsOrPlaceholder falls back to the placeholder for []", async () => {
  const { paramsOrPlaceholder, PLACEHOLDER } = await load({ enabled: true, posts: [], tags: [], redirects: [] });
  expect(paramsOrPlaceholder("slug", [])).toEqual([{ slug: PLACEHOLDER }]);
});

test("paramsOrPlaceholder maps real values", async () => {
  const { paramsOrPlaceholder } = await load({ enabled: true, posts: [], tags: [], redirects: [] });
  expect(paramsOrPlaceholder("slug", ["a", "b"])).toEqual([{ slug: "a" }, { slug: "b" }]);
});

test("throws a helpful error when data.json is missing", async () => {
  const { getBlogData } = await load();
  expect(() => getBlogData()).toThrow(/blog:prepare/);
});

test("getPost finds posts and returns undefined for the placeholder", async () => {
  const { getPost, PLACEHOLDER, postsForTag } = await load({ enabled: true, posts: [post], tags: [], redirects: [] });
  expect(getPost("a")?.title).toBe("A");
  expect(getPost(PLACEHOLDER)).toBeUndefined();
  expect(postsForTag("x")).toHaveLength(1);
});

test("hasPosts reflects the data", async () => {
  const some = await load({ enabled: true, posts: [post], tags: [], redirects: [] });
  expect(some.hasPosts()).toBe(true);
  const none = await load({ enabled: false, posts: [], tags: [], redirects: [] });
  expect(none.hasPosts()).toBe(false);
});

test("non-ENOENT errors are rethrown with a cause", async () => {
  const dir = mkdtempSync(join(tmpdir(), "blogdata-"));
  mkdirSync(join(dir, ".blog"));
  writeFileSync(join(dir, ".blog/data.json"), "{not json");
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  vi.resetModules();
  const { getBlogData } = await import("./data");
  try {
    getBlogData();
    expect.unreachable();
  } catch (e) {
    expect((e as Error).message).toMatch(/Failed to read or parse/);
    expect((e as Error).cause).toBeInstanceOf(SyntaxError);
  }
});
