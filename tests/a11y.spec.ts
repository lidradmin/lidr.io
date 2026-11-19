import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  "/",
  "/about/",
  "/features/",
  "/pricing/",
  "/contact-us/",
  "/privacy-policy/",
  "/gdpr-policy/",
  "/terms-of-service/",
  "/fair-use-policy/",
  "/complaints-policy/",
  "/download/",
  "/blog/",
  "/blog/page/2/",
  "/blog/photo-reports-that-hold-up/",
  "/blog/tag/reporting/",
  "/blog/old-url/", // retired (redirected) post page
];

for (const page of PAGES) {
  test(`a11y: ${page}`, async ({ page: p }) => {
    if (page === "/blog/old-url/") {
      // The retired page meta-refreshes to its target; answer that navigation with
      // 204 No Content so the browser stays on the retired page itself.
      await p.route("**/blog/welcome-to-the-lidr-blog/", (r) =>
        r.request().isNavigationRequest() ? r.fulfill({ status: 204 }) : r.continue()
      );
    }
    await p.goto(page, { waitUntil: "networkidle" });
    await expect(p).toHaveURL(new RegExp(`${page.replace(/\//g, "\\/")}$`));
    const results = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      results.violations,
      results.violations
        .map(
          (v) =>
            `${v.id}: ${v.description} (${v.nodes.length} instance${v.nodes.length > 1 ? "s" : ""})`
        )
        .join("\n")
    ).toHaveLength(0);
  });
}
