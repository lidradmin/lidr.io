import { expect, test } from "vitest";
import { computeRelated } from "./related";

test("ranks by shared tags, then newest; max 3; excludes self and unrelated", () => {
  const posts = [
    { slug: "a", date: "2026-11-10", tags: ["x", "y"] },
    { slug: "b", date: "2026-11-09", tags: ["x"] },
    { slug: "c", date: "2026-11-11", tags: ["x", "y"] },
    { slug: "d", date: "2026-11-12", tags: ["z"] },
    { slug: "e", date: "2026-11-13", tags: ["y"] },
    { slug: "f", date: "2026-11-01", tags: ["x"] },
  ];
  const r = computeRelated(posts);
  expect(r.get("a")).toEqual(["c", "e", "b"]);
  expect(r.get("d")).toEqual([]);
});

test("empty input returns an empty map", () => {
  expect(computeRelated([])).toEqual(new Map());
});

test("a post with no tags gets no related posts", () => {
  const r = computeRelated([
    { slug: "a", date: "2026-11-10", tags: [] },
    { slug: "b", date: "2026-11-09", tags: ["x"] },
  ]);
  expect(r.get("a")).toEqual([]);
});

test("ties on shared count and date break alphabetically by slug", () => {
  const r = computeRelated([
    { slug: "a", date: "2026-11-10", tags: ["x"] },
    { slug: "c", date: "2026-11-09", tags: ["x"] },
    { slug: "b", date: "2026-11-09", tags: ["x"] },
  ]);
  expect(r.get("a")).toEqual(["b", "c"]);
});

test("limit=1 keeps only the best match", () => {
  const r = computeRelated(
    [
      { slug: "a", date: "2026-11-10", tags: ["x", "y"] },
      { slug: "b", date: "2026-11-09", tags: ["x"] },
      { slug: "c", date: "2026-11-11", tags: ["x", "y"] },
    ],
    1,
  );
  expect(r.get("a")).toEqual(["c"]);
});
