import { expect, test } from "vitest";
import { formatDate } from "./format";

test("formats date-only strings without timezone shifts", () => {
  expect(formatDate("2026-11-01")).toBe("1 Nov 2026");
  expect(formatDate("2026-12-31")).toBe("31 Dec 2026");
});

test("returns an empty string for an empty date", () => {
  expect(formatDate("")).toBe("");
});
