import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Requires `npm run build:fixtures` (tests/fixtures/blog). test:a11y does this.

test("index: heading, featured post, 9 cards, pagination", async ({ page }) => {
  await page.goto("/blog/");
  await expect(page.locator("h1")).toHaveText("Blog");
  // Cards are <article>s with the link on the title (not a whole-card link); the featured card comes first.
  await expect(page.locator("article").first().locator("h2 a")).toHaveAttribute("href", "/blog/welcome-to-the-lidr-blog/");
  await expect(page.locator("article")).toHaveCount(10);
  await expect(page.getByRole("link", { name: "Older posts" })).toHaveAttribute("href", "/blog/page/2/");
});

test("page 2 has the remaining 3 posts", async ({ page }) => {
  await page.goto("/blog/page/2/");
  await expect(page.locator("article")).toHaveCount(3);
});

test("post page: one h1, canonical, JSON-LD, og:image, optimised image, sanitised", async ({ page }) => {
  await page.goto("/blog/photo-reports-that-hold-up/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://lidr.io/blog/photo-reports-that-hold-up/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://lidr.io/images/blog/_og/photo-reports-that-hold-up.png");
  // The layout also emits an Organization JSON-LD script; the post's graph is the last one.
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').last().textContent())!);
  expect(ld[0]).toMatchObject({
    "@type": "BlogPosting",
    headline: "Photo reports that hold up in a dispute",
    dateModified: "2026-11-15",
    mainEntityOfPage: { "@type": "WebPage", "@id": "https://lidr.io/blog/photo-reports-that-hold-up/" },
  });
  // The post itself is the first <article>; related-post cards (with their own covers) follow it.
  await expect(page.locator("article").first().locator('picture source[type="image/webp"]')).toHaveCount(1);
  expect(await page.content()).not.toContain("javascript:");
  const og = await page.request.get("/images/blog/_og/photo-reports-that-hold-up.png");
  expect(og.status()).toBe(200);
});

test("soft-problem post is live; draft and broken posts are not", async ({ page }) => {
  expect((await page.request.get("/blog/soft-problems-example/")).status()).toBe(200);
  expect((await page.request.get("/blog/draft-post/")).status()).toBe(404);
  expect((await page.request.get("/blog/broken/")).status()).toBe(404);
  expect((await page.request.get("/blog/__empty/")).status()).toBe(404);
});

test("redirect is written to _redirects", () => {
  expect(readFileSync("out/_redirects", "utf8")).toContain("/blog/old-url/  /blog/welcome-to-the-lidr-blog/  301");
});

test("a redirected post keeps a noindex 'moved' page in the build", async ({ page }) => {
  // Cloudflare applies _redirects first; the page is the fallback that replaces any cached copy.
  const html = readFileSync("out/blog/old-url/index.html", "utf8");
  expect(html).toContain("no longer available");
  expect(html).toMatch(/<meta name="robots" content="noindex, follow"/);
  expect(html).toContain('http-equiv="refresh" content="0;url=/blog/welcome-to-the-lidr-blog/"');
  // The retired page meta-refreshes to its target; answer that navigation with
  // 204 No Content so the browser stays on the retired page itself.
  await page.route("**/blog/welcome-to-the-lidr-blog/", (r) =>
    r.request().isNavigationRequest() ? r.fulfill({ status: 204 }) : r.continue()
  );
  await page.goto("/blog/old-url/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toHaveText("This post is no longer available");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://lidr.io/blog/welcome-to-the-lidr-blog/");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1); // the layout's Organization only
  await expect(page).toHaveURL(/\/blog\/old-url\/$/);
});

test("tag page lists only its posts", async ({ page }) => {
  await page.goto("/blog/tag/reporting/");
  await expect(page.locator("h1")).toHaveText("Reporting");
  await expect(page.locator("article")).toHaveCount(2);
  await expect(page.locator('a[aria-current="page"]')).toHaveText("Reporting");
});

test("sitemap includes posts and excludes drafts", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("https://lidr.io/blog/welcome-to-the-lidr-blog/");
  expect(xml).toContain("https://lidr.io/blog/tag/safety/");
  expect(xml).not.toContain("draft-post");
  expect(xml).not.toContain("old-url");
  expect(xml).not.toContain("/blog/page/");
});

test("RSS feed lists published posts", async ({ request }) => {
  const xml = await (await request.get("/blog/rss.xml")).text();
  expect(xml.startsWith("<?xml")).toBe(true);
  expect(xml).toContain('<atom:link href="https://lidr.io/blog/rss.xml" rel="self" type="application/rss+xml"/>');
  expect(xml).toMatch(/<lastBuildDate>[^<]+<\/lastBuildDate>/);
  expect(xml.match(/<item>/g)).toHaveLength(13);
  expect(xml).not.toContain("old-url");
});

test("footer shows the Blog link", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("footer a[data-blog-link]")).toHaveAttribute("href", "/blog/");
});

test.describe("small phones (320px)", () => {
  test.use({ viewport: { width: 320, height: 640 } });
  for (const path of ["/blog/", "/blog/tag/reporting/", "/blog/photo-reports-that-hold-up/"]) {
    test(`no sideways scrolling: ${path}`, async ({ page }) => {
      await page.goto(path);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});
