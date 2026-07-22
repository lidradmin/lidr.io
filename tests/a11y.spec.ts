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
];

for (const page of PAGES) {
  test(`a11y: ${page}`, async ({ page: p }) => {
    await p.goto(page, { waitUntil: "networkidle" });
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
