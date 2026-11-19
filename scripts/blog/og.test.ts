import sharp from "sharp";
import { expect, test } from "vitest";
import { renderOgImage } from "./og";

test("renders a 1200x630 PNG", async () => {
  const png = await renderOgImage({ title: "How to photograph a site walk properly", tagName: "Site photos" });
  const meta = await sharp(png).metadata();
  expect(meta).toMatchObject({ format: "png", width: 1200, height: 630 });
});

test("handles long titles", async () => {
  const png = await renderOgImage({ title: "x ".repeat(60).trim() });
  expect((await sharp(png).metadata()).width).toBe(1200);
});
