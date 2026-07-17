import { test, expect } from "@playwright/test";

test.describe("Contact form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/contact-us/");
  });

  test("shows validation errors for empty required fields", async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator("#email-error")).toHaveText("This field is required");
    await expect(page.locator("#message-error")).toHaveText("This field is required");
  });

  test("shows email format error for invalid email", async ({ page }) => {
    await page.fill("#email", "not-an-email");
    await page.fill("#message", "Hello");
    await page.click('button[type="submit"]');
    await expect(page.locator("#email-error")).toHaveText(
      "This field must contain a valid email"
    );
    await expect(page.locator("#message-error")).not.toBeVisible();
  });

  test("submits successfully with valid data", async ({ page }) => {
    await page.route("https://api.web3forms.com/submit", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    );
    await page.fill("#first_name", "Test");
    await page.fill("#last_name", "User");
    await page.fill("#email", "test@example.com");
    await page.fill("#message", "Hello from Playwright");
    await page.click('button[type="submit"]');
    await expect(page.getByText("Thank you for your message")).toBeVisible();
  });

  test("shows error state on submission failure", async ({ page }) => {
    await page.route("https://api.web3forms.com/submit", (route) =>
      route.fulfill({ status: 500, body: "Server Error" })
    );
    await page.fill("#email", "test@example.com");
    await page.fill("#message", "Hello");
    await page.click('button[type="submit"]');
    await expect(page.getByText("Something went wrong")).toBeVisible();
  });
});
