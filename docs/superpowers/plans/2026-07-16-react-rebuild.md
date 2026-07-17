# Lidr.io React Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the live WordPress/Elementor site at https://lidr.io as a static Next.js app, pixel-identical at 1440/768/390px, with zero Elementor artifacts.

**Architecture:** Next.js App Router with `output: 'export'`. The live site is captured (screenshots, DOM, assets, metadata) as ground truth; pages are rebuilt as clean server components with CSS Modules and verified by a Playwright pixel-diff harness (<1% difference threshold, Chromium). Only the mobile menu and contact form are client components.

**Tech Stack:** Next.js (latest, TypeScript), CSS Modules, Playwright, pixelmatch/pngjs, sharp, Web3Forms.

**Spec:** `docs/superpowers/specs/2026-07-16-react-rebuild-design.md` — read it before starting.

**Key facts (audited, do not re-derive):**
- 10 pages: `/`, `/about/`, `/features/`, `/pricing/`, `/contact-us/`, `/privacy-policy/`, `/gdpr-policy/`, `/terms-of-service/`, `/fair-use-policy/`, `/complaints-policy/`
- Header nav: Home, About Us, Features, Pricing, Contact. **No Sign Up** (dropped; deploy config 301s `/sign-up/ → /`)
- Footer links: About Us, Pricing, Privacy Policy, Terms of Service, Complaints Policy, Fair Use Policy, GDPR Policy
- Contact form fields: First Name (text, optional), Last Name (text, optional), Email (email, required), Message (textarea, required)
- Fonts on live site: custom "Amenti" (in WP export), Manrope, DM Serif Text, Inter (verify actual rendered set from capture)
- No analytics, no cookie banner, no verification meta tags to migrate
  *(correction 2026-07-16: the live site DOES show a Blocksy cookie banner —
  JS-rendered, missed by the static audit. The rebuild still ships none; see
  the spec's corrected audited-facts section.)*
- WP export (for Amenti font + fallback assets): `/Users/conor.mullan/Downloads/allarchive/public_html/`

---

## Execution status (updated 2026-07-17, branch `rebuild`)

Executed via subagent-driven development with two-stage review per task
(spec compliance, then code quality). Statuses:

| Task | Status | Evidence |
|---|---|---|
| 1. Scaffold | ✅ Done + reviewed | commit 52b619a |
| 2. Capture harness | ✅ Done + reviewed | 6f89993, db552cf, 8f630c7 (chunked stitch, cookie banner excluded, DSF guard) |
| 3. Assets/fonts | ✅ Done + reviewed | 2b1f5cd (51/51 assets, WebP + -half variants, Amenti license flagged in app/fonts/SOURCES.md) |
| 4. Tokens/globals/fonts | ✅ Done + reviewed | 17d56fa, 1683fa4 (Montserrat is the real body font; Lora never renders) |
| 5. Visual diff harness | ✅ Done + reviewed | 8312990, 0e84229, 885eda9 (<1% gate, width-parity assert, shared manifest) |
| 6. Header/Footer/layout | ✅ Done + reviewed | 8f060c2, 028864a (Sign Up dropped; Download App → App Store URL from live evidence) |
| 7. Home page | ✅ Done + reviewed | 4783e08 — 0.11/0.04/0.16% diff |
| 8. Features page | ✅ Done + reviewed | e44e926, 77e35ad — 0.08/0.06/0.14%; real cfc sticky stack transcribed |
| 9. Pricing page | ✅ Done + reviewed | b7c7a42 built it; spec review found harness-tuned timing → root-cause rework 84a775c, 3b0f07e, f691f9a, 10008d8, 192effa (smooth-scroll override + bottom reveal-quiesce). Determinism verified 2026-07-17: double capture 28/30 pixel-identical at gate tolerance (worst content diff 0.028%, home 1–2px height jitter only; features-desktop REVEALED both runs); gate ×2 → 9 passed both. |
| 10. About page | ⬜ Not started | |
| 11. Contact page + form | ⬜ Not started | |
| 12. Legal pages ×5 | ⬜ Not started | |
| 13. 404 page | ⬜ Not started | |
| 14. SEO parity | ⬜ Not started | |
| 15. URL crawl comparison | ⬜ Not started | |
| 16. A11y/browsers/Lighthouse | ⬜ Not started | |
| 17. Deploy config + README | ⬜ Not started | |

**Resume protocol:** proceed Task 10 onward per this plan (Task 9 rework
completed 2026-07-17; TASK-STATE.md deleted). References in `capture/` are gitignored and
regenerable via `npm run capture` (live site must be up). The visual gate is
`npm run test:visual`.

---

### Task 1: Scaffold Next.js project

**Files:**
- Create: entire Next.js scaffold at repo root (`/Users/conor.mullan/Documents/Lidr.io`)
- Modify: `next.config.ts`, `.gitignore`
- Delete: default boilerplate (`app/page.module.css` demo styles, default SVGs)

- [ ] **Step 1: Scaffold**

Run from the repo root (it already contains `docs/` and `.git`; create-next-app tolerates non-empty dirs only with `--yes` in some versions — if it refuses, scaffold into `.tmp-scaffold` and `rsync -a .tmp-scaffold/ . && rm -rf .tmp-scaffold`):

```bash
npx create-next-app@latest . --typescript --app --no-tailwind --no-src-dir --eslint --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Configure static export**

Replace `next.config.ts` with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true, // URL parity with WordPress (/about/ not /about)
  images: { unoptimized: true }, // we pre-optimize; plain <img>/<picture>
};

export default nextConfig;
```

- [ ] **Step 3: Add capture dirs to .gitignore**

Append to `.gitignore`:

```
# ground-truth captures (large, regenerable)
capture/
test-results/
playwright-report/
```

- [ ] **Step 4: Verify build produces static output**

```bash
npm run build && ls out/index.html
```
Expected: `out/index.html` exists (exit 0).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js static-export app"
```

---

### Task 2: Capture harness — ground truth from the live site

**Files:**
- Create: `scripts/capture/capture.mjs`
- Create: `scripts/capture/pages.mjs`
- Modify: `package.json` (scripts + devDeps)

- [ ] **Step 1: Install Playwright**

```bash
npm i -D playwright @playwright/test pixelmatch pngjs serve
npx playwright install chromium firefox webkit
```

- [ ] **Step 2: Write the shared page/breakpoint manifest**

`scripts/capture/pages.mjs`:

```js
export const LIVE_ORIGIN = "https://lidr.io";

export const PAGES = [
  { slug: "home", path: "/" },
  { slug: "about", path: "/about/" },
  { slug: "features", path: "/features/" },
  { slug: "pricing", path: "/pricing/" },
  { slug: "contact-us", path: "/contact-us/" },
  { slug: "privacy-policy", path: "/privacy-policy/" },
  { slug: "gdpr-policy", path: "/gdpr-policy/" },
  { slug: "terms-of-service", path: "/terms-of-service/" },
  { slug: "fair-use-policy", path: "/fair-use-policy/" },
  { slug: "complaints-policy", path: "/complaints-policy/" },
];

export const BREAKPOINTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];
```

- [ ] **Step 3: Write the capture script**

`scripts/capture/capture.mjs`:

```js
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
```

- [ ] **Step 4: Add npm script and run capture**

Add to `package.json` scripts: `"capture": "node scripts/capture/capture.mjs"`.

```bash
npm run capture
ls capture/screens | wc -l   # expected: 30 (10 pages × 3 breakpoints)
ls capture/meta | wc -l      # expected: 10
```

- [ ] **Step 5: Eyeball the captures**

Open 3–4 screenshots (e.g. `capture/screens/home-desktop.png`, `home-mobile.png`) and confirm they show the fully rendered page — no cookie of blank sections, no half-loaded images. Re-run capture if flaky.

- [ ] **Step 6: Commit (scripts only — capture/ is gitignored)**

```bash
git add scripts package.json package-lock.json && git commit -m "feat: live-site capture harness (screens, DOM, meta, assets, URLs)"
```

---

### Task 3: Asset harvest, image optimization, fonts

**Files:**
- Create: `scripts/capture/harvest-assets.mjs`
- Create: `scripts/optimize-images.mjs`
- Create: `public/images/…`, `public/icons/…`, `app/fonts/…` (harvested output)

- [ ] **Step 1: Write the harvest script**

`scripts/capture/harvest-assets.mjs` — downloads every image/font/icon actually requested by the 10 pages (from `capture/assets.json`), deduplicated, into `capture/raw-assets/`, preserving filename:

```js
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { basename } from "node:path";

const log = JSON.parse(readFileSync("capture/assets.json", "utf8"));
const wanted = /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot)(\?|$)/i;
const urls = [...new Set(Object.values(log).flat())].filter((u) => wanted.test(u));

mkdirSync("capture/raw-assets", { recursive: true });
const manifest = {};
for (const url of urls) {
  const res = await fetch(url);
  if (!res.ok) { console.warn("SKIP", res.status, url); continue; }
  const name = basename(new URL(url).pathname);
  manifest[url] = name;
  writeFileSync(`capture/raw-assets/${name}`, Buffer.from(await res.arrayBuffer()));
}
writeFileSync("capture/raw-assets/manifest.json", JSON.stringify(manifest, null, 2));
console.log(`downloaded ${Object.keys(manifest).length}/${urls.length}`);
```

- [ ] **Step 2: Run it**

```bash
node scripts/capture/harvest-assets.mjs
```
Expected: `downloaded N/N` with zero SKIP lines (investigate any SKIP).

- [ ] **Step 3: Write the image optimizer**

```bash
npm i -D sharp
```

`scripts/optimize-images.mjs` — converts raster images from `capture/raw-assets/` into `public/images/`: WebP at original size plus a 1x/2x-appropriate set. SVG/ICO copy through to `public/icons/`:

```js
import sharp from "sharp";
import { mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { extname, parse } from "node:path";

mkdirSync("public/images", { recursive: true });
mkdirSync("public/icons", { recursive: true });

for (const f of readdirSync("capture/raw-assets")) {
  const ext = extname(f).toLowerCase();
  const { name } = parse(f);
  if ([".svg", ".ico"].includes(ext)) {
    copyFileSync(`capture/raw-assets/${f}`, `public/icons/${f}`);
  } else if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) {
    const img = sharp(`capture/raw-assets/${f}`);
    const { width } = await img.metadata();
    await img.webp({ quality: 82 }).toFile(`public/images/${name}.webp`);
    if (width > 800)
      await sharp(`capture/raw-assets/${f}`)
        .resize({ width: Math.round(width / 2) })
        .webp({ quality: 82 })
        .toFile(`public/images/${name}-half.webp`);
  }
}
console.log("optimized");
```

Note: PNGs that are logos/UI with transparency stay visually identical in WebP (lossless is an option: use `.webp({ lossless: true })` for images where quality 82 shows artifacts in the pixel diff).

- [ ] **Step 4: Run it and spot-check**

```bash
node scripts/optimize-images.mjs && ls public/images | head
```
Open 2–3 WebPs and compare against originals for visible artifacts.

- [ ] **Step 5: Collect fonts**

From `capture/raw-assets/` take every `.woff2` (these are what the live site actually serves). Amenti: if not among captured woff2 files, pull from the WP export:

```bash
find /Users/conor.mullan/Downloads/allarchive/public_html/wp-content -iname "*amenti*" -type f
```

Place all font files in `app/fonts/`. Record in `app/fonts/SOURCES.md` where each file came from and its license status (Google fonts = OFL; **Amenti = commercial, flag for owner license confirmation** per spec).

Subsetting note (spec: "subset where safe"): woff2 files served by Google Fonts are already latin-subset — use them as-is. Only subset Amenti (e.g. `pyftsubset` latin range) if its file is >100KB; otherwise skip — the pixel diff protects against any glyph regression either way.

- [ ] **Step 6: Commit**

```bash
git add scripts public app/fonts package.json package-lock.json
git commit -m "feat: harvest and optimize live-site assets; self-host fonts"
```

---

### Task 4: Design tokens + global styles + font loading

**Files:**
- Create: `scripts/capture/extract-tokens.mjs`
- Create: `styles/tokens.css`, `styles/globals.css`
- Modify: `app/layout.tsx`
- Delete: `app/globals.css` (replaced by `styles/globals.css`)

- [ ] **Step 1: Write the token extraction script**

`scripts/capture/extract-tokens.mjs` — reads computed styles from the live site for representative elements and writes a report. **Values inform tokens; they are normalized, never copied verbatim** (spec: 53px/51px quirks → one logical step):

```js
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("https://lidr.io/", { waitUntil: "networkidle" });

const report = await page.evaluate(() => {
  const pick = (el, props) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
  };
  const typo = ["font-family", "font-size", "font-weight", "line-height", "letter-spacing", "color"];
  const box = ["background-color", "border-radius", "box-shadow", "padding"];
  const colors = new Set();
  document.querySelectorAll("*").forEach((el) => {
    const cs = getComputedStyle(el);
    [cs.color, cs.backgroundColor, cs.borderColor].forEach((c) => {
      if (c && c !== "rgba(0, 0, 0, 0)") colors.add(c);
    });
  });
  return {
    body: pick(document.body, typo),
    h1: pick(document.querySelector("h1"), typo),
    h2: pick(document.querySelector("h2"), typo),
    h3: pick(document.querySelector("h3"), typo),
    p: pick(document.querySelector("main p, p"), typo),
    button: pick(document.querySelector('a[class*="button"], button, .elementor-button'), [...typo, ...box]),
    colorsUsed: [...colors],
  };
});
writeFileSync("capture/tokens-report.json", JSON.stringify(report, null, 2));
console.log("tokens report written");
await browser.close();
```

- [ ] **Step 2: Run it**

```bash
node scripts/capture/extract-tokens.mjs && cat capture/tokens-report.json
```

- [ ] **Step 3: Author `styles/tokens.css`**

Using the report + the captured screenshots, define the token set. Structure (fill values from the report — normalize near-duplicates to one token):

```css
:root {
  /* Brand colors — from tokens-report.json colorsUsed, deduplicated */
  --color-text: /* body color from report */;
  --color-heading: /* h1/h2 color */;
  --color-primary: /* button/CTA background */;
  --color-bg: /* page background */;
  --color-surface: /* card background */;
  /* Typography */
  --font-heading: var(--font-amenti); /* set by next/font in layout */
  --font-body: var(--font-manrope);
  --text-4xl: /* h1 size */; --text-3xl: /* h2 */; --text-2xl: /* h3 */;
  --text-base: /* p size */; --leading-tight: 1.2; --leading-normal: 1.6;
  /* Spacing scale — regularized (multiples of 4/8) */
  --space-xs: 8px; --space-sm: 16px; --space-md: 24px;
  --space-lg: 40px; --space-xl: 56px; --space-2xl: 80px; --space-3xl: 120px;
  /* Radii & shadows — from button/card report values */
  --radius-sm: /* */; --radius-md: /* */; --radius-pill: 999px;
  --shadow-card: /* */;
  /* Layout */
  --container-max: 1200px; /* verify against live content width in DOM capture */
  --bp-tablet: 768px; --bp-mobile: 390px;
}
```

- [ ] **Step 4: Author `styles/globals.css`**

Minimal reset + base typography that reproduces the live body/heading defaults:

```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
html { -webkit-text-size-adjust: 100%; }
body {
  font-family: var(--font-body);
  color: var(--color-text);
  background: var(--color-bg);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}
img, picture, svg, video { display: block; max-width: 100%; }
h1, h2, h3, h4 { font-family: var(--font-heading); color: var(--color-heading); line-height: var(--leading-tight); }
a { color: inherit; }
.skip-link {
  position: absolute; left: -9999px; top: 0; z-index: 100;
  background: var(--color-primary); color: #fff; padding: var(--space-xs) var(--space-sm);
}
.skip-link:focus { left: 0; }
```

- [ ] **Step 5: Wire fonts + globals in `app/layout.tsx`**

```tsx
import localFont from "next/font/local";
import "@/styles/tokens.css";
import "@/styles/globals.css";

const amenti = localFont({
  src: "./fonts/amenti-bold.woff2", // adjust to actual harvested filename(s)/weights
  variable: "--font-amenti",
  display: "swap",
});
const manrope = localFont({
  src: [
    { path: "./fonts/manrope-400.woff2", weight: "400" },
    { path: "./fonts/manrope-600.woff2", weight: "600" },
    { path: "./fonts/manrope-700.woff2", weight: "700" },
  ], // adjust to actual harvested files
  variable: "--font-manrope",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${amenti.variable} ${manrope.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
```

(Header/Footer are added to this layout in Task 6; add DM Serif Text/Inter the same way **only if** the capture shows them actually rendered.)

- [ ] **Step 6: Verify build**

```bash
npm run build
```
Expected: exit 0, no font resolution errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: design tokens, global styles, self-hosted fonts via next/font/local"
```

---

### Task 5: Visual diff harness (the TDD machinery for every page task)

**Files:**
- Create: `tests/visual/visual.spec.ts`
- Create: `tests/visual/enabled-pages.ts`
- Create: `playwright.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the enabled-pages registry**

Pages are added here one at a time as they're built — this is how each page task "writes its failing test first."

`tests/visual/enabled-pages.ts`:

```ts
// Add a slug here when you start building that page. Its visual test will
// fail until the rebuild matches the live capture within threshold.
export const ENABLED: string[] = [];
```

- [ ] **Step 2: Write the diff spec**

`tests/visual/visual.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
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
const THRESHOLD = 0.01; // <1% of page area (spec)

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
      const actualBuf = await page.screenshot({ fullPage: true });
      await ctx.close();

      const expected = PNG.sync.read(
        readFileSync(`capture/screens/${slug}-${bp.name}.png`)
      );
      const actual = PNG.sync.read(actualBuf);
      const width = Math.min(expected.width, actual.width);
      const height = Math.max(expected.height, actual.height);
      // pad both to same canvas so height drift shows up as diff pixels
      const pad = (src: PNG) => {
        const out = new PNG({ width, height });
        PNG.bitblt(src, out, 0, 0, width, Math.min(src.height, height), 0, 0);
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
```

- [ ] **Step 3: Playwright config with static server**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 60000,
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "npx serve out -l 4173",
    url: "http://localhost:4173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // firefox/webkit projects added in Task 12 for functional passes only
  ],
});
```

Add scripts to `package.json`: `"test:visual": "next build && playwright test tests/visual --project=chromium"`.

- [ ] **Step 4: Verify harness runs (0 tests, ENABLED is empty)**

```bash
npm run test:visual
```
Expected: "No tests found" or 0 passed — no errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Playwright pixel-diff harness against live captures"
```

---

### Task 6: Header, Footer, shared layout

**Files:**
- Create: `components/Header/Header.tsx`, `components/Header/Header.module.css`, `components/Header/MobileMenu.tsx`
- Create: `components/Footer/Footer.tsx`, `components/Footer/Footer.module.css`
- Create: `components/Button/Button.tsx`, `components/Button/Button.module.css`
- Modify: `app/layout.tsx`

**Ground truth:** `capture/dom/home.html` (header/footer markup), `capture/screens/home-*.png` (all 3 breakpoints — header collapses to hamburger on mobile/tablet; check which breakpoint it collapses at in the tablet screenshot).

- [ ] **Step 1: Study the capture**

Read the `<header>`/nav and footer regions of `capture/dom/home.html` and the three home screenshots. Note: logo asset, nav item order (Home, About Us, Features, Pricing, Contact — **omit Sign Up**), footer columns and legal links (About Us, Pricing, Privacy Policy, Terms of Service, Complaints Policy, Fair Use Policy, GDPR Policy), copyright line.

- [ ] **Step 2: Build Header (server) + MobileMenu (client)**

`components/Header/Header.tsx` — semantic structure; visual styling comes from the capture:

```tsx
import Link from "next/link";
import styles from "./Header.module.css";
import { MobileMenu } from "./MobileMenu";

export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/about/", label: "About Us" },
  { href: "/features/", label: "Features" },
  { href: "/pricing/", label: "Pricing" },
  { href: "/contact-us/", label: "Contact" },
];

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <img src="/images/logo.webp" alt="Lidr.io" width={/* from capture */0} height={0} />
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.href}><Link href={item.href}>{item.label}</Link></li>
            ))}
          </ul>
        </nav>
        <MobileMenu items={NAV_ITEMS} />
      </div>
    </header>
  );
}
```

`components/Header/MobileMenu.tsx` — the only interactive nav piece; client component with `aria-expanded`, Escape-to-close, focus trap:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./Header.module.css";

export function MobileMenu({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>("a, button");
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={styles.mobileMenu}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
        className={styles.menuToggle}
      >
        <span aria-hidden="true" className={styles.burger} />
      </button>
      {open && (
        <div ref={panelRef} className={styles.menuPanel}>
          <ul>
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} onClick={() => setOpen(false)}>{i.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build Footer (server)**

Reproduce columns/links/copyright from capture with the same pattern (semantic `<footer>`, `<nav aria-label="Footer">`). CSS Module for styling.

- [ ] **Step 4: Build Button**

One shared `Button` (renders `<a>` or `<button>`) matching the live CTA style from tokens.

- [ ] **Step 5: Mount in layout**

In `app/layout.tsx` body: `<Header />` before `{children}` (wrap children in `<main id="main">` — pages will render inside), `<Footer />` after.

- [ ] **Step 6: Verify visually (manual, no page enabled yet)**

```bash
npm run dev
```
Compare header/footer at 1440/768/390 against `capture/screens/home-*.png` side by side. Match spacing, colors, hamburger behavior. (Full pixel verification happens when Home is enabled in Task 7.)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: Header (with accessible mobile menu), Footer, Button"
```

---

### Task 7: Home page

**Files:**
- Create: `app/page.tsx`, section components under `components/` as repetition demands (`Hero/`, `CTA/`, `FeatureCard/`, …)
- Modify: `tests/visual/enabled-pages.ts`

**Ground truth:** `capture/dom/home.html`, `capture/screens/home-{desktop,tablet,mobile}.png`, `capture/meta/home.json`.

- [ ] **Step 1: Write the failing test — enable the page**

```ts
export const ENABLED: string[] = ["home"];
```

```bash
npm run test:visual
```
Expected: 3 FAILURES (home @ desktop/tablet/mobile) — page doesn't match capture yet.

- [ ] **Step 2: Decompose the capture into sections**

Walk `capture/screens/home-desktop.png` top to bottom; list the sections (hero, feature grid, CTA bands, testimonials, etc. — whatever the design actually contains). For each, decide: page-local JSX in `app/page.tsx`, or shared component if it repeats on other pages (check features/pricing screenshots before deciding).

- [ ] **Step 3: Build sections top-down**

For each section: semantic HTML (`<section aria-labelledby>`, correct heading level), CSS Module using tokens, images from `public/images/` via `<img>`/`<picture>` with explicit `width`/`height`, `loading="lazy"` below the fold. Text content comes verbatim from `capture/dom/home.html`. Clean class names only.

- [ ] **Step 4: Iterate the pixel diff to green**

```bash
npm run test:visual
```
Use `test-results/diffs/home-*.png` to see exactly where it differs; fix; repeat. Expected end state: 3 PASS (<1% diff each). Differences that are purely font anti-aliasing: manual review per spec — inspect the diff image and confirm no structural difference before accepting.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: home page, pixel-verified at 3 breakpoints"
```

---

### Task 8: Features page

**Files:**
- Create: `app/features/page.tsx` (+ any new shared section components)
- Modify: `tests/visual/enabled-pages.ts` (add `"features"`)

Same 5-step procedure as Task 7 (enable → 3 failing tests → decompose `capture/dom/features.html` + screenshots → build with shared components where sections repeat Home's → iterate to 3 PASS → commit `feat: features page, pixel-verified`).

Extract repetition: if a section here matches a Home section structurally, refactor it into a shared component (props for text/images) rather than duplicating — run `npm run test:visual` after the refactor to prove Home still passes.

---

### Task 9: Pricing page

**Files:**
- Create: `app/pricing/page.tsx`, `components/PricingCard/`
- Modify: `tests/visual/enabled-pages.ts` (add `"pricing"`)

Same procedure as Task 7. `PricingCard` takes plan name/price/features/CTA as props — one component, N cards from the capture.

---

### Task 10: About page

**Files:**
- Create: `app/about/page.tsx`
- Modify: `tests/visual/enabled-pages.ts` (add `"about"`)

Same procedure as Task 7.

---

### Task 11: Contact page + form

**Files:**
- Create: `app/contact-us/page.tsx`, `components/ContactForm/ContactForm.tsx`, `components/ContactForm/ContactForm.module.css`
- Create: `tests/contact-form.spec.ts`
- Modify: `tests/visual/enabled-pages.ts` (add `"contact-us"`)

- [ ] **Step 1: Enable page — 3 failing visual tests** (as Task 7 Step 1)

- [ ] **Step 2: Build ContactForm (client component)**

Fields from the live FluentForm: First Name (optional), Last Name (optional), Email (required), Message (required). Web3Forms + honeypot per spec:

```tsx
"use client";
import { useState } from "react";
import styles from "./ContactForm.module.css";

const WEB3FORMS_KEY = "REPLACE_WITH_REAL_ACCESS_KEY"; // owner swaps in — see README

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const errs: Record<string, string> = {};
    if (!String(data.get("email")).match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/))
      errs.email = "Please enter a valid email address.";
    if (!String(data.get("message")).trim())
      errs.message = "Please enter a message.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setStatus("sending");
    data.append("access_key", WEB3FORMS_KEY);
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: data,
      });
      setStatus(res.ok ? "success" : "error");
      if (res.ok) form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      {/* honeypot — invisible to humans, Web3Forms drops submissions where it's checked */}
      <input type="checkbox" name="botcheck" className={styles.botcheck} tabIndex={-1} aria-hidden="true" />
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="first_name">First Name</label>
          <input id="first_name" name="first_name" type="text" placeholder="First Name" autoComplete="given-name" />
        </div>
        <div className={styles.field}>
          <label htmlFor="last_name">Last Name</label>
          <input id="last_name" name="last_name" type="text" placeholder="Last Name" autoComplete="family-name" />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" placeholder="Email Address" required
          autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} />
        {errors.email && <p id="email-error" role="alert" className={styles.error}>{errors.email}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message" placeholder="Your Message" rows={4} required
          aria-invalid={!!errors.message} aria-describedby={errors.message ? "message-error" : undefined} />
        {errors.message && <p id="message-error" role="alert" className={styles.error}>{errors.message}</p>}
      </div>
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Submit"}
      </button>
      <div aria-live="polite">
        {status === "success" && <p className={styles.success}>Thanks — your message has been sent.</p>}
        {status === "error" && (
          <p role="alert" className={styles.error}>
            Something went wrong. Please email us directly at{" "}
            <a href="mailto:hello@lidr.io">hello@lidr.io</a>.
            {/* verify actual contact email from capture/dom/contact-us.html */}
          </p>
        )}
      </div>
    </form>
  );
}
```

`ContactForm.module.css` must include `.botcheck { display: none; }` and match label/field styling from the capture (labels may be visually hidden if the live form is placeholder-only — check the screenshot; if so use a `.visuallyHidden` class on labels, keeping them for screen readers).

- [ ] **Step 3: Write functional form tests**

`tests/contact-form.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("contact form", () => {
  test("validates required fields", async ({ page }) => {
    await page.goto("/contact-us/");
    await page.getByRole("button", { name: /submit/i }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("submits successfully (mocked service)", async ({ page }) => {
    await page.route("https://api.web3forms.com/submit", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' })
    );
    await page.goto("/contact-us/");
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/message/i).fill("Hello");
    await page.getByRole("button", { name: /submit/i }).click();
    await expect(page.getByText(/has been sent/i)).toBeVisible();
  });

  test("shows fallback on service failure", async ({ page }) => {
    await page.route("https://api.web3forms.com/submit", (r) => r.fulfill({ status: 500 }));
    await page.goto("/contact-us/");
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/message/i).fill("Hello");
    await page.getByRole("button", { name: /submit/i }).click();
    await expect(page.getByText(/mailto|email us directly/i)).toBeVisible();
  });
});
```

- [ ] **Step 4: Build the rest of the contact page** (headings, contact info blocks per capture), iterate visual diff to 3 PASS, run form tests:

```bash
npm run test:visual && npx playwright test tests/contact-form.spec.ts --project=chromium
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: contact page with accessible Web3Forms form (honeypot, validation, fallback)"
```

---

### Task 12: Legal pages (5) via LegalLayout + content modules

**Files:**
- Create: `components/LegalLayout/LegalLayout.tsx`, `components/LegalLayout/LegalLayout.module.css`
- Create: `content/legal/privacy.tsx`, `content/legal/gdpr.tsx`, `content/legal/terms.tsx`, `content/legal/fair-use.tsx`, `content/legal/complaints.tsx`
- Create: `app/privacy-policy/page.tsx`, `app/gdpr-policy/page.tsx`, `app/terms-of-service/page.tsx`, `app/fair-use-policy/page.tsx`, `app/complaints-policy/page.tsx`
- Modify: `tests/visual/enabled-pages.ts` (add all 5 slugs)

- [ ] **Step 1: Enable all 5 — 15 failing visual tests**

- [ ] **Step 2: Build LegalLayout**

```tsx
import styles from "./LegalLayout.module.css";

export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className={styles.legal}>
      <h1>{title}</h1>
      {children}
    </article>
  );
}
```

Style (max-width, heading/paragraph/list rhythm) from the legal-page captures.

- [ ] **Step 3: Port content**

For each policy, extract the text from `capture/dom/<slug>.html` into a content module — **content, not UI** (spec):

```tsx
// content/legal/privacy.tsx — text verbatim from capture/dom/privacy-policy.html
export const privacyContent = (
  <>
    <p>…</p>
    <h2>…</h2>
    {/* full policy text, semantic h2/h3/p/ul — no Elementor wrappers */}
  </>
);
```

Page files are thin:

```tsx
// app/privacy-policy/page.tsx
import { LegalLayout } from "@/components/LegalLayout/LegalLayout";
import { privacyContent } from "@/content/legal/privacy";

export default function PrivacyPolicyPage() {
  return <LegalLayout title="Privacy Policy">{privacyContent}</LegalLayout>;
}
```

(Exact `title` values from each page's captured `h1` in `capture/meta/<slug>.json`.)

- [ ] **Step 4: Iterate to 15 PASS, commit**

```bash
npm run test:visual
git add -A && git commit -m "feat: 5 legal pages via LegalLayout + content modules, pixel-verified"
```

---

### Task 13: 404 page

**Files:**
- Create: `app/not-found.tsx`

- [ ] **Step 1:** Build a simple 404 using the site's tokens/Header/Footer (WordPress default 404 has no meaningful design to match — style it consistently: heading "Page not found", link home).
- [ ] **Step 2:** `npm run build && ls out/404.html` — expected: exists.
- [ ] **Step 3:** Commit: `git add -A && git commit -m "feat: 404 page"`.

---

### Task 14: SEO parity — metadata, JSON-LD, sitemap, robots

**Files:**
- Create: `lib/seo.ts`
- Create: `app/sitemap.ts`, `app/robots.ts`
- Modify: every `app/**/page.tsx` (add `metadata` export), `app/layout.tsx` (site-wide JSON-LD)

- [ ] **Step 1: Write `lib/seo.ts`**

```ts
import type { Metadata } from "next";

export const SITE = {
  origin: "https://lidr.io",
  name: "LIDR.IO",
  ogImage: "/images/og-image.webp", // actual og:image from capture/meta/home.json — harvest it in Task 3 if not already
};

export function pageMetadata(opts: {
  title: string;
  description?: string; // omit for pages with no meta description on the live site (parity — don't invent)
  path: string; // "/about/" etc.
}): Metadata {
  const url = SITE.origin + opts.path;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      type: "website",
      locale: "en_US",
      siteName: SITE.name,
      images: [SITE.ogImage],
    },
    twitter: { card: "summary_large_image" },
  };
}

// Yoast-equivalent schema graph (spec: WebSite, Organization, WebPage)
export function jsonLd(opts: { title: string; path: string; description?: string }) {
  const url = SITE.origin + opts.path;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: opts.title,
        description: opts.description,
        isPartOf: { "@id": `${SITE.origin}/#website` },
        about: { "@id": `${SITE.origin}/#organization` },
        inLanguage: "en-US",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE.origin}/#website`,
        url: SITE.origin + "/",
        name: SITE.name,
        publisher: { "@id": `${SITE.origin}/#organization` },
        inLanguage: "en-US",
      },
      {
        "@type": "Organization",
        "@id": `${SITE.origin}/#organization`,
        name: SITE.name,
        url: SITE.origin + "/",
        logo: SITE.origin + "/images/logo.webp",
      },
    ],
  };
}
```

Cross-check field values against each `capture/meta/<slug>.json` jsonLd — mirror what Yoast emitted (og:locale, organization name, etc.), not this template blindly.

- [ ] **Step 2: Add metadata to every page**

Titles/descriptions verbatim from `capture/meta/<slug>.json`. Known values:

| Page | Title |
|---|---|
| `/` | `Smart, Scalable Solutions to Simplify Your Workflow \| LIDR.IO` |
| `/about/` | `About - Lidr.io` |
| `/features/` | `Features - Lidr.io` |
| `/pricing/` | `Pricing - Lidr.io` |
| `/contact-us/` | `Contact Us - Lidr.io` |
| `/privacy-policy/` | `Lidr Privacy Policy - How We Protect Your Data` |
| `/gdpr-policy/` | `GDPR Policy - Lidr.io` |
| `/terms-of-service/` | `Lidr Terms of Service - User Agreement and Policies` |
| `/fair-use-policy/` | `Fair Use Policy - Lidr.io` |
| `/complaints-policy/` | `Complaints Policy - Lidr.io` |

Descriptions: home, privacy, and terms have them in the captures (see `capture/meta/`); pages without a meta description on the live site get **none** (parity, don't invent). Example page wiring:

```tsx
// app/about/page.tsx
import { pageMetadata, jsonLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About - Lidr.io",
  // no description on the live /about/ page — omit (see capture/meta/about.json)
  path: "/about/",
});

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd({ title: "About - Lidr.io", path: "/about/" })) }}
      />
      {/* page sections */}
    </>
  );
}
```

(Pages without a live meta description simply omit the field — `description` is optional in `pageMetadata`.)

- [ ] **Step 3: sitemap + robots**

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export const dynamic = "force-static";

const PATHS = ["/", "/about/", "/features/", "/pricing/", "/contact-us/",
  "/privacy-policy/", "/gdpr-policy/", "/terms-of-service/",
  "/fair-use-policy/", "/complaints-policy/"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({ url: SITE.origin + p }));
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE.origin}/sitemap.xml`,
  };
}
```

- [ ] **Step 4: Verify head parity**

```bash
npm run build
node -e "
const { readFileSync } = require('fs');
const pages = { home:'index', about:'about/index', features:'features/index', pricing:'pricing/index', 'contact-us':'contact-us/index', 'privacy-policy':'privacy-policy/index', 'gdpr-policy':'gdpr-policy/index', 'terms-of-service':'terms-of-service/index', 'fair-use-policy':'fair-use-policy/index', 'complaints-policy':'complaints-policy/index' };
for (const [slug, out] of Object.entries(pages)) {
  const meta = JSON.parse(readFileSync('capture/meta/'+slug+'.json','utf8'));
  const html = readFileSync('out/'+out+'.html','utf8');
  const title = (html.match(/<title>([^<]*)<\/title>/)||[])[1];
  const ok = title === meta.title;
  console.log(ok?'OK ':'MISMATCH', slug, ok?'':(JSON.stringify(title)+' vs '+JSON.stringify(meta.title)));
}
"
```
Expected: `OK` × 10. Also confirm `out/sitemap.xml` and `out/robots.txt` exist.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: SEO parity — metadata, JSON-LD, sitemap, robots"
```

---

### Task 15: URL crawl comparison

**Files:**
- Create: `scripts/crawl-compare.mjs`

- [ ] **Step 1: Write the comparison script**

```js
// Diffs the URL inventory of the static build against the live-site inventory
// (capture/urls.json). Flags: pages missing from the build, broken internal
// links/assets in the build, canonical mismatches.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const liveUrls = new Set(
  Object.values(JSON.parse(readFileSync("capture/urls.json", "utf8")))
    .flat()
    .map((u) => new URL(u).pathname)
    // exclude WordPress plumbing we intentionally drop, and the dropped sign-up page
    .filter((p) => !/^\/(wp-|feed|comments|xmlrpc|sign-up)/.test(p) && !p.startsWith("/wp-content"))
);

// collect built pages
const built = new Set();
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f === "index.html")
      built.add(p.replace(/^out/, "").replace(/index\.html$/, "") || "/");
  }
})("out");

let fail = false;
for (const p of liveUrls)
  if (!built.has(p)) { console.log("MISSING PAGE:", p); fail = true; }

// verify every asset referenced in built HTML exists in out/
for (const p of built) {
  const html = readFileSync(join("out", p, "index.html"), "utf8");
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) {
    const asset = m[1].split("?")[0].split("#")[0];
    if (asset.endsWith("/")) continue; // page links checked above
    if (!existsSync(join("out", asset)) && !existsSync(join("out", asset, "index.html"))) {
      console.log("BROKEN REF:", asset, "on", p); fail = true;
    }
  }
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  const expected = "https://lidr.io" + p;
  if (canonical !== expected) { console.log("CANONICAL MISMATCH:", p, canonical); fail = true; }
}
console.log(fail ? "FAIL" : `PASS: ${built.size} pages, all live URLs covered`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it**

```bash
npm run build && node scripts/crawl-compare.mjs
```
Expected: `PASS: 11 pages, all live URLs covered` (10 + 404 output dir may vary — the count line is informational; zero MISSING/BROKEN/MISMATCH lines is the requirement).

- [ ] **Step 3: Commit**

```bash
git add scripts/crawl-compare.mjs && git commit -m "feat: URL crawl comparison (live vs static build)"
```

---

### Task 16: Accessibility + cross-browser + Lighthouse gates

**Files:**
- Create: `tests/a11y.spec.ts`, `tests/functional.spec.ts`
- Modify: `playwright.config.ts` (add firefox/webkit projects for functional tests)

- [ ] **Step 1: Axe scan on every page**

```bash
npm i -D @axe-core/playwright
```

`tests/a11y.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PATHS = ["/", "/about/", "/features/", "/pricing/", "/contact-us/",
  "/privacy-policy/", "/gdpr-policy/", "/terms-of-service/",
  "/fair-use-policy/", "/complaints-policy/"];

for (const path of PATHS) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
```

Per spec: contrast failures that faithfully reproduce the live design get flagged to the owner (documented in the PR/README), not silently "fixed" — exclude with `.disableRules(["color-contrast"])` **only** if such failures exist, and list them.

- [ ] **Step 2: Functional spec (runs in all 3 engines)**

`tests/functional.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("nav links resolve", async ({ page }) => {
  await page.goto("/");
  for (const label of ["About Us", "Features", "Pricing", "Contact"]) {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: label }).click();
    await expect(page).not.toHaveTitle(/not found/i);
  }
});

test("mobile menu opens, traps focus, closes on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /open menu/i });
  await toggle.click();
  await expect(page.getByRole("button", { name: /close menu/i })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /open menu/i })).toHaveAttribute("aria-expanded", "false");
});

test("skip link focuses main", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Skip to content")).toBeFocused();
});
```

Add to `playwright.config.ts` projects:

```ts
{ name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: /visual/ },
{ name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: /visual/ },
```

```bash
npx playwright test tests/functional.spec.ts tests/a11y.spec.ts tests/contact-form.spec.ts
```
Expected: all PASS in chromium; functional + form PASS in firefox and webkit.

- [ ] **Step 3: Manual cross-engine visual spot-check**

Open the built site (`npx serve out -l 4173`) in Firefox and Safari; check every page at 1440/768/390 for flexbox/font/form-control/SVG anomalies (spec §browser matrix). Record findings in the PR description.

- [ ] **Step 4: Lighthouse gates**

```bash
npm i -D @lhci/cli
npx lhci autorun --collect.staticDistDir=out --collect.url=http://localhost/index.html \
  --assert.assertions.categories:performance=0.95 \
  --assert.assertions.categories:accessibility=1 \
  --assert.assertions.categories:best-practices=1 \
  --assert.assertions.categories:seo=1
```
Expected: all assertions pass (spec targets). Use the Lighthouse trace to confirm the LCP element per page; add `<link rel="preload">` for confirmed LCP images only (via each page's `metadata` or a `<link>` in the page head), re-run.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test: a11y, cross-browser functional, Lighthouse gates"
```

---

### Task 17: Deploy config + README + final sweep

**Files:**
- Create: `vercel.json`, `public/_redirects`, `README.md`

- [ ] **Step 1: Redirects (both host formats, per spec 301 for /sign-up/)**

`vercel.json`:

```json
{
  "redirects": [
    { "source": "/sign-up/", "destination": "/", "permanent": true },
    { "source": "/sign-up", "destination": "/", "permanent": true }
  ]
}
```

`public/_redirects` (Netlify/Cloudflare Pages — ships into `out/`):

```
/sign-up/ / 301
/sign-up  / 301
```

- [ ] **Step 2: README**

Document: `npm run dev` / `build` (output in `out/`), capture + verification workflow (`npm run capture`, `npm run test:visual`), **Web3Forms key swap location** (`components/ContactForm/ContactForm.tsx`), deploy notes (any static host; redirects files included), post-cutover checklist: confirm Search Console ownership still valid (DNS-based), submit `sitemap.xml`, confirm Amenti font license (see `app/fonts/SOURCES.md`), watch form spam (escalate to Turnstile if needed).

- [ ] **Step 3: Elementor artifact sweep (acceptance criterion)**

```bash
grep -riE "elementor|e-con|fluentform|wp-content|wp-includes" app components content styles lib public --include="*.tsx" --include="*.ts" --include="*.css" -l
grep -riE "elementor|e-con-|fluentform" out -l
```
Expected: no output from either (empty = pass). `wp-content` matches in `out/` would mean a missed asset rewrite.

- [ ] **Step 4: Full gate run**

```bash
npm run build && npm run test:visual && npx playwright test && node scripts/crawl-compare.mjs
```
Expected: 30/30 visual PASS, all functional/a11y PASS, crawl PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: deploy config (sign-up 301), README, final verification sweep"
```

---

## Execution notes

- Tasks 7–12 are the bulk of the work; each one ends with its pages' visual diffs green before moving on. Never loosen `THRESHOLD` to make a test pass — fix the page, or (anti-aliasing-only diffs) document the manual review in the commit message.
- If the live site changes mid-project, re-run `npm run capture` and re-verify previously green pages before continuing.
- The live WordPress site stays up until cutover; nothing in this plan touches it.
