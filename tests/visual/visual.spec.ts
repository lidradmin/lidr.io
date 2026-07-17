import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
// Typed via the sibling scripts/capture/screenshot.d.mts declaration file.
import { captureFullPage } from "../../scripts/capture/screenshot.mjs";
// Typed via the sibling scripts/capture/pages.d.mts declaration file.
// Single source of truth shared with the live-site capture script, so the
// rebuild's page slugs/paths and breakpoints can never drift from the
// reference set the diffs are compared against.
import { PAGES as PAGE_LIST, BREAKPOINTS } from "../../scripts/capture/pages.mjs";
import { ENABLED } from "./enabled-pages";

const PAGES: Record<string, string> = Object.fromEntries(
  PAGE_LIST.map((p) => [p.slug, p.path])
);
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
      // Freeze animations/transitions before screenshotting — identical rule
      // to the one capture.mjs injects when shooting the live references.
      // The selector must carry HIGH SPECIFICITY, not just !important: a bare
      // `* { transition: none !important }` has specificity (0,0,0), so any
      // site rule that is itself !important at class level (live declares
      // e.g. `.bigmainscbar-22 { transition: .5s !important }`, faithfully
      // transcribed into the rebuild) wins the !important-vs-!important
      // comparison and keeps animating — previously freezing fades mid-flight
      // in both references and test shots. `html:not(#\9)x3` bumps the freeze
      // to specificity (3,0,1) while still matching every element, so both
      // pipelines compare rest states only.
      await page.addStyleTag({
        content: `html:not(#\\9):not(#\\9):not(#\\9) *, html:not(#\\9):not(#\\9):not(#\\9) *::before, html:not(#\\9):not(#\\9):not(#\\9) *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`,
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
