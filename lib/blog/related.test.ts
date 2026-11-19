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
