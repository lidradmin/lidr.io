import { expect, test } from "vitest";
import { pageCount, pageSlice } from "./paginate";

const items = Array.from({ length: 13 }, (_, i) => i);

test("pageCount", () => {
  expect(pageCount(0)).toBe(1);
  expect(pageCount(10)).toBe(1);
  expect(pageCount(11)).toBe(2);
  expect(pageCount(19)).toBe(2);
  expect(pageCount(20)).toBe(3);
});

test("page 1 has featured + 9", () => {
  const p = pageSlice(items, 1);
  expect(p.featured).toBe(0);
  expect(p.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("page 2 has the remainder", () => {
  expect(pageSlice(items, 2)).toEqual({ items: [10, 11, 12] });
});
