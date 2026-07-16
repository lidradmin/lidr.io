// Shared full-page screenshot utility, reused by both the live-site capture
// (scripts/capture/capture.mjs) and the rebuilt-site diff harness (Task 5).
//
// Playwright's built-in `page.screenshot({ fullPage: true })` resizes the
// viewport to the full document height and paints once. That breaks
// position:sticky / scroll-linked content (e.g. pinned "card stack"
// sections): the sticky element only ever renders at its resting position
// for the *resized* viewport, and the space it would occupy while pinned
// during a real scroll shows up as blank. Real users never see that
// resized-viewport render — they see the page while actually scrolling.
//
// captureFullPage() instead scrolls the page viewport-height by
// viewport-height, screenshots each chunk in place (non-fullPage, so the
// viewport size never changes), and stitches the chunks into one PNG. This
// matches what a real user scrolling the page would see, including any
// scroll-linked JS/CSS. It is intentionally generic (no site-specific
// selectors) so the diff harness can call the exact same function against
// the rebuilt local site and get an apples-to-apples reference.
import { PNG } from "pngjs";

const SETTLE_MS = 150;

export async function captureFullPage(page, filePath) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("page has no viewport set");
  const { width, height: viewportHeight } = viewport;

  // Force instant scrolling for the duration of this capture. Sites that
  // set `html { scroll-behavior: smooth }` (common in WordPress themes)
  // turn window.scrollTo() into an animated scroll, so a fixed settle
  // delay lands at a timing-dependent, non-deterministic offset instead of
  // the exact requested y — corrupting the chunk stitch with drifting
  // overlaps/gaps and making captures non-reproducible run to run. This is
  // a generic override (no site-specific selectors), safe to apply to any
  // page.
  await page.addStyleTag({
    content: `html{scroll-behavior:auto!important}`,
  });

  const docHeight = await page.evaluate(
    () => document.documentElement.scrollHeight
  );

  const chunks = [];
  // Track the actual achieved scroll position (not the requested one) as
  // the source of truth for where each chunk sits in the final image.
  // documentElement.scrollHeight / window.innerHeight can shift by a
  // pixel or two mid-capture (a scrollbar toggling, a lazy-loaded image
  // resolving, sub-pixel layout rounding) — asserting scrollY landed at
  // an exact precomputed target is fragile against that jitter. Instead
  // we ask the browser where it actually ended up after each scroll and
  // use that, so a 1-2px wobble just shifts a chunk boundary slightly
  // instead of hanging or corrupting the stitch.
  let requestedY = 0;
  let lastActualY = -1;

  while (requestedY < docHeight) {
    await page.evaluate(
      (scrollY) => window.scrollTo(0, scrollY),
      requestedY
    );
    await page.waitForTimeout(SETTLE_MS);
    // Let scrollY stabilize (covers residual momentum/reflow) instead of
    // asserting it hits a precomputed pixel target.
    await page
      .waitForFunction(
        () => {
          const y = window.scrollY;
          if (window.__cfpLastY === y) return true;
          window.__cfpLastY = y;
          return false;
        },
        undefined,
        { timeout: 2000, polling: 50 }
      )
      .catch(() => {
        /* best-effort settle; fall through and use whatever scrollY is now */
      });

    const actualY = await page.evaluate(() => window.scrollY);
    if (actualY === lastActualY) break; // can't scroll further; avoid infinite loop
    lastActualY = actualY;

    const shot = await page.screenshot({ fullPage: false });
    const png = PNG.sync.read(shot);

    const remaining = docHeight - actualY;
    if (remaining <= viewportHeight) {
      // Last chunk: crop so the stitched image ends exactly at docHeight,
      // with no duplicated rows from the previous chunk.
      const cropHeight = Math.min(png.height, remaining);
      const cropFromTop = png.height - cropHeight;
      const cropped = new PNG({ width: png.width, height: cropHeight });
      PNG.bitblt(png, cropped, 0, cropFromTop, png.width, cropHeight, 0, 0);
      chunks.push({ png: cropped, sourceY: docHeight - cropHeight });
      break;
    } else {
      chunks.push({ png, sourceY: actualY });
      requestedY = actualY + viewportHeight;
    }
  }

  const stitched = new PNG({ width, height: docHeight });
  for (const { png, sourceY } of chunks) {
    PNG.bitblt(png, stitched, 0, 0, png.width, png.height, 0, sourceY);
  }

  await page.evaluate(() => window.scrollTo(0, 0));

  const { writeFileSync } = await import("node:fs");
  writeFileSync(filePath, PNG.sync.write(stitched));
}
