import { describe, expect, test } from "vitest";
import type { BlogReport, Problem } from "../../lib/blog/types";
import { splitForSlug, strictFailures } from "./strict";

const p = (level: Problem["level"], field: string, message = "m"): Problem => ({ level, field, message });

describe("strictFailures", () => {
  test("without only, every problem counts (unchanged behaviour)", () => {
    const report: BlogReport = { problems: { a: [p("soft", "tags")], _images: [p("soft", "images")], b: [p("soft", "location")] } };
    expect(strictFailures(report)).toHaveLength(3);
  });

  test("with only, problems on the slug count, except location warnings", () => {
    const report: BlogReport = { problems: { mine: [p("soft", "description"), p("soft", "location")] } };
    expect(strictFailures(report, "mine")).toEqual([{ key: "mine", problem: p("soft", "description") }]);
  });

  test("with only, a location warning alone does not fail", () => {
    expect(strictFailures({ problems: { mine: [p("soft", "location")] } }, "mine")).toEqual([]);
  });

  test("with only, soft problems on other posts and _ keys do not fail", () => {
    const report: BlogReport = { problems: { other: [p("soft", "tags")], _images: [p("soft", "images")] } };
    expect(strictFailures(report, "mine")).toEqual([]);
  });

  test("with only, hard problems anywhere still fail", () => {
    const report: BlogReport = { problems: { other: [p("hard", "title")], _tags: [p("hard", "tags")], mine: [p("hard", "location")] } };
    expect(strictFailures(report, "mine").map((f) => f.key).sort()).toEqual(["_tags", "mine", "other"]);
  });
});

describe("splitForSlug", () => {
  test("separates the slug's problems from everything else", () => {
    const report: BlogReport = { problems: { mine: [p("soft", "tags")], other: [p("hard", "title")], _images: [p("soft", "images")] } };
    const { yours, notYours } = splitForSlug(report, "mine");
    expect(Object.keys(yours.problems)).toEqual(["mine"]);
    expect(Object.keys(notYours.problems).sort()).toEqual(["_images", "other"]);
  });
});
