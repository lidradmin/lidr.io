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
import { writeFileSync } from "node:fs";
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

    // Wait for lazy-loaded images to fully arrive before shooting the
    // chunk. Scrolling a chunk into view is what triggers the site's
    // lazyloader (data-src swap / low-res blur-up placeholder / progressive
    // decode), so right after a scroll an <img> can be absent, blurry, or
    // half-decoded — a race that intermittently corrupts single chunks
    // (observed run-to-run on the live site's "Download the app" laptop
    // render). Condition: every <img> with a source is complete AND the
    // set of image sources has been stable for two consecutive polls (so a
    // placeholder→full-res src swap in progress keeps us waiting). Purely
    // state-based — no timing constants tied to any particular page.
    await page
      .waitForFunction(
        () => {
          const imgs = Array.from(document.images);
          const sig = imgs
            .map((i) => `${i.currentSrc}|${i.complete ? 1 : 0}`)
            .join(";");
          const settled =
            window.__cfpImgSig === sig &&
            imgs.every((i) => !i.currentSrc || (i.complete && i.naturalWidth > 0));
          window.__cfpImgSig = sig;
          return settled;
        },
        undefined,
        { timeout: 10000, polling: 100 }
      )
      .catch(() => {
        /* best-effort: never hang a capture on a broken image */
      });

    const actualY = await page.evaluate(() => window.scrollY);
    if (actualY === lastActualY) {
      // Can't scroll further; avoid infinite loop. If part of the document
      // below what we've already stitched is still unpainted, warn loudly —
      // silently truncating a full-page capture is worse than a noisy log,
      // since the caller (capture.mjs / the diff harness) has no other
      // signal that the output image is missing content.
      const unstitchedHeight = docHeight - (lastActualY + viewportHeight);
      if (unstitchedHeight > 0) {
        console.warn(
          `captureFullPage: scroll stalled at y=${lastActualY} on ${page.url()}; ` +
            `${unstitchedHeight * width} unpainted pixels (${unstitchedHeight}px of height) below the last captured chunk will be missing from the stitched image`
        );
      }
      break;
    }
    lastActualY = actualY;

    // Shoot the chunk only once the rendered pixels have stopped changing:
    // take viewport screenshots until two consecutive frames are
    // byte-identical. Scroll-triggered work (reveal-on-scroll classes,
    // lazyload swaps, decodes) runs on its own schedule after our scroll,
    // and no DOM-side condition can enumerate every such effect — but all
    // of them end in a stable frame. Observed without this: the features
    // page's bottom reveal raced the final chunk roughly 50/50 run to run.
    // Bounded retries keep a pathological page (e.g. genuinely infinite
    // animation that slipped past the freeze CSS) from hanging the capture
    // — after the cap we take the last frame and move on.
    let shot = await page.screenshot({ fullPage: false });
    for (let attempt = 0; attempt < 8; attempt++) {
      await page.waitForTimeout(150);
      const next = await page.screenshot({ fullPage: false });
      const stable = next.equals(shot);
      shot = next;
      if (stable) break;
      if (attempt === 7) {
        console.warn(
          `captureFullPage: frame never stabilized at y=${actualY} on ${page.url()}; using last frame`
        );
      }
    }
    const png = PNG.sync.read(shot);

    if (chunks.length === 0 && png.width !== width) {
      throw new Error(
        `chunk width ${png.width} != viewport width ${width}; captureFullPage requires deviceScaleFactor: 1`
      );
    }

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

  writeFileSync(filePath, PNG.sync.write(stitched));
}
