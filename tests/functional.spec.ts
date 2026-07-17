import { test, expect } from "@playwright/test";

test("skip link targets #main", async ({ page }) => {
  await page.goto("/");
  const skip = page.locator("a.skip-link");
  await expect(skip).toHaveAttribute("href", "#main");
  await expect(page.locator("main#main")).toBeVisible();
});

test("nav links navigate to correct pages", async ({ page }) => {
  await page.goto("/");
  const navLinks = [
    { text: "Features", href: "/features/" },
    { text: "Pricing", href: "/pricing/" },
    { text: "About Us", href: "/about/" },
    { text: "Contact", href: "/contact-us/" },
  ];
  for (const { text, href } of navLinks) {
    const link = page.locator(`nav a`, { hasText: text }).first();
    await expect(link).toHaveAttribute("href", href);
  }
});

test("footer legal links present", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  const legalLinks = [
    "Privacy Policy",
    "GDPR Policy",
    "Terms of Service",
    "Fair Use Policy",
    "Complaints Policy",
  ];
  for (const text of legalLinks) {
    await expect(footer.locator(`a:has-text("${text}")`)).toBeVisible();
  }
});

test("mobile menu toggle", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.locator('[aria-label="Open menu"]');
  await expect(toggle).toBeVisible();
  await toggle.click();
  const dialog = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('nav[aria-label="Main menu"]')).toBeVisible();
  const close = dialog.locator('[aria-label="Close menu"]');
  await close.click();
  await expect(dialog).not.toBeVisible();
});
