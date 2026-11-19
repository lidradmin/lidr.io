/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS config file read by lhci */
const fs = require("node:fs");

// Run Lighthouse in Playwright's own Chromium ("Google Chrome for Testing"),
// never the installed Google Chrome: a headless Chrome left behind by a crashed
// run makes macOS treat Chrome as already open, so the real browser won't start.
function playwrightChromium() {
  try {
    const p = require("playwright").chromium.executablePath();
    return fs.existsSync(p) ? p : undefined;
  } catch {
    return undefined;
  }
}

module.exports = {
  ci: {
    collect: {
      staticDistDir: "./out",
      url: [
        "/",
        "/about/",
        "/features/",
        "/pricing/",
        "/contact-us/",
        "/blog/",
        "/blog/photo-reports-that-hold-up/",
      ],
      numberOfRuns: 1,
      chromePath: playwrightChromium(),
      settings: { chromeFlags: "--headless=new" },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.7 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
      },
    },
  },
};
