import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  // Chunked full-page capture (captureFullPage) scrolls viewport-height by
  // viewport-height and screenshots each chunk in place. The tallest pages
  // run ~19,000px at the mobile breakpoint (390x844) => ~23 chunks, each with
  // its own scroll + settle wait, plus final stitch and a multi-megapixel
  // pixelmatch diff against the reference PNG. 60s is too tight for that on
  // a loaded CI box; 180s gives headroom. Applied suite-wide since the whole
  // suite is currently the visual harness.
  timeout: 180_000,
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "npx serve out -l 4173",
    url: "http://localhost:4173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
