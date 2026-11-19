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

test("guard: non-positive or non-integer page returns no items", () => {
  expect(pageSlice(items, 0)).toEqual({ items: [] });
  expect(pageSlice(items, -1)).toEqual({ items: [] });
  expect(pageSlice(items, 2.5)).toEqual({ items: [] });
});

test("page 1 with 0 items has no featured and no cards", () => {
  const p = pageSlice([], 1);
  expect(p.featured).toBeUndefined();
  expect(p.items).toEqual([]);
});

test("page 1 with 1 item is featured only", () => {
  const p = pageSlice([42], 1);
  expect(p.featured).toBe(42);
  expect(p.items).toEqual([]);
});

test("exactly 10 items: page 2 is empty", () => {
  const ten = Array.from({ length: 10 }, (_, i) => i);
  expect(pageSlice(ten, 2)).toEqual({ items: [] });
});

test("28 items: page 3 holds 19..27", () => {
  const twentyEight = Array.from({ length: 28 }, (_, i) => i);
  expect(pageSlice(twentyEight, 3)).toEqual({
    items: [19, 20, 21, 22, 23, 24, 25, 26, 27],
  });
});

test("page beyond range is empty", () => {
  expect(pageSlice(items, 9)).toEqual({ items: [] });
});
