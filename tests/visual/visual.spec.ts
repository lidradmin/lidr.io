import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
// Typed via the sibling scripts/capture/screenshot.d.mts declaration file.
import { captureFullPage } from "../../scripts/capture/screenshot.mjs";
import { ENABLED } from "./enabled-pages";

const PAGES: Record<string, string> = {
  home: "/", about: "/about/", features: "/features/", pricing: "/pricing/",
  "contact-us": "/contact-us/", "privacy-policy": "/privacy-policy/",
  "gdpr-policy": "/gdpr-policy/", "terms-of-service": "/terms-of-service/",
  "fair-use-policy": "/fair-use-policy/", "complaints-policy": "/complaints-policy/",
};
const BREAKPOINTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];
const THRESHOLD = 0.01; // <1% of page area

for (const slug of ENABLED) {
  for (const bp of BREAKPOINTS) {
    test(`${slug} @ ${bp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: bp.width, height: bp.height },
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      await page.goto(PAGES[slug], { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({
        content: `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`,
      });

      mkdirSync("test-results/actual", { recursive: true });
      const actualPath = `test-results/actual/${slug}-${bp.name}.png`;
      await captureFullPage(page, actualPath);
      await ctx.close();

      const expected = PNG.sync.read(
        readFileSync(`capture/screens/${slug}-${bp.name}.png`)
      );
      const actual = PNG.sync.read(readFileSync(actualPath));
      expect(
        actual.width,
        "viewport width mismatch vs reference — regenerate captures or check breakpoints"
      ).toBe(expected.width);
      const width = expected.width;
      const height = Math.max(expected.height, actual.height);
      // pad both to same canvas so height drift shows up as diff pixels
      const pad = (src: PNG) => {
        const out = new PNG({ width, height });
        PNG.bitblt(
          src,
          out,
          0,
          0,
          Math.min(src.width, width),
          Math.min(src.height, height),
          0,
          0
        );
        return out;
      };
      const a = pad(expected), b = pad(actual);
      const diff = new PNG({ width, height });
      const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
        threshold: 0.15, // per-pixel color tolerance (anti-aliasing)
      });
      const ratio = diffPixels / (width * height);
      mkdirSync("test-results/diffs", { recursive: true });
      writeFileSync(`test-results/diffs/${slug}-${bp.name}.png`, PNG.sync.write(diff));
      expect(ratio, `pixel diff ${(ratio * 100).toFixed(2)}% (see test-results/diffs/${slug}-${bp.name}.png)`)
        .toBeLessThan(THRESHOLD);
    });
  }
}
