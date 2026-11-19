import sharp from "sharp";
import { expect, test } from "vitest";
import { ogUnsupportedChars, renderOgImage } from "./og";

test("renders a 1200x630 PNG", async () => {
  const png = await renderOgImage({ title: "How to photograph a site walk properly", tagName: "Site photos" });
  const meta = await sharp(png).metadata();
  expect(meta).toMatchObject({ format: "png", width: 1200, height: 630 });
});

test("handles long titles", async () => {
  const png = await renderOgImage({ title: "x ".repeat(60).trim() });
  expect((await sharp(png).metadata()).width).toBe(1200);
});

test("ogUnsupportedChars flags emoji and non-Latin scripts only", () => {
  expect(ogUnsupportedChars("Hello 🏗️ мир").sort()).toEqual(
    expect.arrayContaining(["🏗", "м", "и", "р"]),
  );
  expect(ogUnsupportedChars("Plain English, “curly” quotes – café €5")).toEqual([]);
});

test("CJK title renders without throwing", async () => {
  const png = await renderOgImage({ title: "你好世界", tagName: "日本語" });
  expect((await sharp(png).metadata()).width).toBe(1200);
});

test("renders with no tag or an empty tag", async () => {
  for (const tagName of [undefined, ""]) {
    const png = await renderOgImage({ title: "No tag here", tagName });
    expect(await sharp(png).metadata()).toMatchObject({ width: 1200, height: 630 });
  }
});

test("renders a 200-character single word", async () => {
  const png = await renderOgImage({ title: "a".repeat(200) });
  expect(await sharp(png).metadata()).toMatchObject({ width: 1200, height: 630 });
});

test("draws the yellow logo bottom-left", async () => {
  const png = await renderOgImage({ title: "Logo check", tagName: "Site photos" });
  const { data, info } = await sharp(png).extract({ left: 80, top: 500, width: 200, height: 80 }).raw().toBuffer({ resolveWithObject: true });
  let yellow = false;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] < 100) { yellow = true; break; }
  }
  expect(yellow).toBe(true);
});
