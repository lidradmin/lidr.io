// Captures ground truth from the live site:
//  capture/screens/<slug>-<bp>.png      full-page screenshot
//  capture/dom/<slug>.html              serialized DOM after hydration + network idle
//  capture/meta/<slug>.json             title, description, canonical, og/twitter, JSON-LD
//  capture/assets.json                  every asset URL actually requested, by page
//  capture/urls.json                    URL inventory (internal links found per page)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { LIVE_ORIGIN, PAGES, BREAKPOINTS } from "./pages.mjs";
import { captureFullPage } from "./screenshot.mjs";

for (const d of ["capture/screens", "capture/dom", "capture/meta"])
  mkdirSync(d, { recursive: true });

const browser = await chromium.launch();
const assetLog = {};
const urlInventory = {};

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // Kill smooth scrolling BEFORE any programmatic scrolling below (the same
  // generic override captureFullPage applies for its own chunk scrolls —
  // see scripts/capture/screenshot.mjs). The live WordPress theme sets
  // html { scroll-behavior: smooth }, which turns every scrollTo() here
  // into an animated glide: the pre-scroll's "return to top" was observed
  // still mid-flight hundreds of ms later (scrollY ~557 instead of 0), and
  // the reveal-quiesce wait below would otherwise evaluate against
  // transient mid-glide positions instead of the bottom of the page.
  await page.addStyleTag({
    content: `html{scroll-behavior:auto!important}`,
  });
  // scroll through to trigger lazy loads & JS-initialized Elementor widgets
  await page.evaluate(async () => {
    await new Promise((done) => {
      let y = 0;
      const step = () => {
        y += 600;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight) setTimeout(step, 120);
        else { window.scrollTo(0, 0); setTimeout(done, 500); };
      };
      step();
    });
  });
  await page.waitForLoadState("networkidle");
  // Quiesce scroll reveals before chunked screenshotting. The live site
  // runs AOS with { once: true }: an element revealed once stays revealed.
  // But AOS applies the reveal class asynchronously — its scroll handler is
  // throttled AND data-aos-delay is honored in JS (a setTimeout before the
  // class lands), so a reveal near the page bottom can land AFTER the last
  // chunk's screenshot, flipping that chunk's state run to run (observed
  // ~50/50 on the features page's bottom app mockup). Deterministic fix:
  // park at the bottom and wait — state-based — until every [data-aos]
  // element whose trigger point is inside the viewport (AOS default offset
  // 120px) has actually received .aos-animate. With once:true those states
  // then persist through the whole chunk pass, so no chunk can race them.
  // (The diff harness needs no equivalent: the rebuild's RevealManager
  // applies reveal classes synchronously in its scroll handler.)
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  );
  await page
    .waitForFunction(
      () => {
        // Only judge once we are actually AT the bottom — never against a
        // transient mid-scroll position.
        const max =
          document.documentElement.scrollHeight - window.innerHeight;
        if (window.scrollY < max - 2) return false;
        const vpBottom = window.scrollY + window.innerHeight;
        return Array.from(
          document.querySelectorAll("[data-aos].aos-init:not(.aos-animate)")
        ).every(
          (el) =>
            el.getBoundingClientRect().top + window.scrollY >= vpBottom - 120
        );
      },
      undefined,
      { timeout: 5000, polling: 100 }
    )
    .catch(() => {
      /* best-effort: an element whose trigger sits below max scroll can
         legitimately never reveal — don't hang the capture on it */
    });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.waitForLoadState("networkidle");
  // Freeze animations for stable screenshots, and hide the live site's
  // cookie-consent banner (Blocksy theme: .cookie-notification). The
  // rebuild ships no cookie banner at all (the site sets no tracking
  // cookies), so references should exclude it rather than bake in a
  // transient overlay that has no equivalent to diff against. We hide via
  // CSS instead of clicking "Accept"/"Decline" so we don't set cookies or
  // otherwise change page state during capture.
  //
  // The freeze selector must carry HIGH SPECIFICITY, not just !important:
  // a bare `* { transition: none !important }` has specificity (0,0,0), so
  // any site rule that is itself !important at class level (the live site
  // declares e.g. `.bigmainscbar-22 { transition: .5s !important }`) wins
  // the !important-vs-!important comparison and keeps animating. That
  // previously let in-flight fades leak into the references (captured
  // mid-transition instead of at rest). `html:not(#\9)x3` bumps the freeze
  // to specificity (3,0,1) while still matching every element, so the
  // references show rest states only. The diff harness
  // (tests/visual/visual.spec.ts) injects the identical rule.
  await page.addStyleTag({
    content: `html:not(#\\9):not(#\\9):not(#\\9) *, html:not(#\\9):not(#\\9):not(#\\9) *::before, html:not(#\\9):not(#\\9):not(#\\9) *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
.cookie-notification{display:none!important}`,
  });
}

// The live site is a heavy WordPress install and intermittently slow;
// a single networkidle/goto timeout must not kill a 30-screenshot run.
// Retry each page×breakpoint capture in a fresh context before giving up.
const ATTEMPTS = 3;

async function capturePageAtBreakpoint(slug, path, bp) {
  const ctx = await browser.newContext({
    viewport: { width: bp.width, height: bp.height },
    deviceScaleFactor: 1,
  });
  try {
    const page = await ctx.newPage();
    page.on("requestfinished", (r) => assetLog[slug].add(r.url()));
    await page.goto(LIVE_ORIGIN + path, { waitUntil: "load", timeout: 60000 });
    await settle(page);
    await captureFullPage(page, `capture/screens/${slug}-${bp.name}.png`);
    return { ctx, page };
  } catch (err) {
    await ctx.close();
    throw err;
  }
}

for (const { slug, path } of PAGES) {
  assetLog[slug] = new Set();
  for (const bp of BREAKPOINTS) {
    let ctx, page, lastErr;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        ({ ctx, page } = await capturePageAtBreakpoint(slug, path, bp));
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`retry ${attempt}/${ATTEMPTS} for ${slug}@${bp.name}: ${err.message?.split("\n")[0]}`);
        await new Promise((r) => setTimeout(r, 5000 * attempt));
      }
    }
    if (lastErr) throw lastErr;
    if (bp.name === "desktop") {
      writeFileSync(`capture/dom/${slug}.html`, await page.content());
      const meta = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content ?? null,
        canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
        og: Object.fromEntries(
          [...document.querySelectorAll('meta[property^="og:"]')].map((m) => [
            m.getAttribute("property"), m.content,
          ])
        ),
        twitter: Object.fromEntries(
          [...document.querySelectorAll('meta[name^="twitter:"]')].map((m) => [
            m.name, m.content,
          ])
        ),
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
          (s) => s.textContent
        ),
        h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
      }));
      writeFileSync(`capture/meta/${slug}.json`, JSON.stringify(meta, null, 2));
      urlInventory[slug] = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")]
          .map((a) => a.href)
          .filter((h) => h.startsWith(location.origin))
      );
    }
    await ctx.close();
  }
  console.log(`captured ${slug}`);
}

writeFileSync(
  "capture/assets.json",
  JSON.stringify(Object.fromEntries(Object.entries(assetLog).map(([k, v]) => [k, [...v]])), null, 2)
);
writeFileSync("capture/urls.json", JSON.stringify(urlInventory, null, 2));
await browser.close();
