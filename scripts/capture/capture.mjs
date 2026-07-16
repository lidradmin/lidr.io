// Captures ground truth from the live site:
//  capture/screens/<slug>-<bp>.png      full-page screenshot
//  capture/dom/<slug>.html              serialized DOM after hydration + network idle
//  capture/meta/<slug>.json             title, description, canonical, og/twitter, JSON-LD
//  capture/assets.json                  every asset URL actually requested, by page
//  capture/urls.json                    URL inventory (internal links found per page)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { LIVE_ORIGIN, PAGES, BREAKPOINTS } from "./pages.mjs";

for (const d of ["capture/screens", "capture/dom", "capture/meta"])
  mkdirSync(d, { recursive: true });

const browser = await chromium.launch();
const assetLog = {};
const urlInventory = {};

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
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
  // freeze animations for stable screenshots
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}`,
  });
}

for (const { slug, path } of PAGES) {
  assetLog[slug] = new Set();
  for (const bp of BREAKPOINTS) {
    const ctx = await browser.newContext({
      viewport: { width: bp.width, height: bp.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    page.on("requestfinished", (r) => assetLog[slug].add(r.url()));
    await page.goto(LIVE_ORIGIN + path, { waitUntil: "load", timeout: 60000 });
    await settle(page);
    await page.screenshot({
      path: `capture/screens/${slug}-${bp.name}.png`,
      fullPage: true,
    });
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
