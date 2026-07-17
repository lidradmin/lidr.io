#!/usr/bin/env node
/**
 * Crawl the static build output and compare against the live site.
 * Verifies that every page in the build exists and every live page is covered.
 *
 * Usage: node scripts/crawl-compare.mjs
 * Requires: npm run build first (reads from out/)
 */

import { readdirSync, existsSync } from "fs";
import { join } from "path";

const LIVE_BASE = "https://lidr.io";
const OUT_DIR = join(process.cwd(), "out");

const KNOWN_PAGES = [
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
];

const EXPECTED_FILES = [
  "404.html",
  "sitemap.xml",
  "robots.txt",
];

let exitCode = 0;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  exitCode = 1;
}

function pass(msg) {
  console.log(`  PASS: ${msg}`);
}

console.log("=== Static build file check ===\n");

if (!existsSync(OUT_DIR)) {
  console.error("ERROR: out/ directory not found. Run `npm run build` first.");
  process.exit(1);
}

for (const page of KNOWN_PAGES) {
  const htmlPath = page === "/"
    ? join(OUT_DIR, "index.html")
    : join(OUT_DIR, page.replace(/\/$/, ""), "index.html");

  if (existsSync(htmlPath)) {
    pass(`${page} → ${htmlPath.replace(process.cwd() + "/", "")}`);
  } else {
    // Try flat file
    const flatPath = page === "/"
      ? join(OUT_DIR, "index.html")
      : join(OUT_DIR, page.replace(/\/$/, "") + ".html");
    if (existsSync(flatPath)) {
      pass(`${page} → ${flatPath.replace(process.cwd() + "/", "")}`);
    } else {
      fail(`MISSING: ${page} — no HTML file found`);
    }
  }
}

console.log("\n=== Expected infrastructure files ===\n");

for (const file of EXPECTED_FILES) {
  const filePath = join(OUT_DIR, file);
  if (existsSync(filePath)) {
    pass(file);
  } else {
    fail(`MISSING: ${file}`);
  }
}

console.log("\n=== Live site reachability check ===\n");

for (const page of KNOWN_PAGES) {
  const url = `${LIVE_BASE}${page}`;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok) {
      pass(`${url} → ${res.status}`);
    } else {
      fail(`${url} → ${res.status}`);
    }
  } catch (err) {
    fail(`${url} → ${err.message}`);
  }
}

console.log("\n=== Coverage check ===\n");

// Discover all HTML files in out/ and flag any that aren't in KNOWN_PAGES
const htmlFiles = [];
function walkDir(dir, prefix = "") {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith("_")) {
      walkDir(join(dir, entry.name), `${prefix}${entry.name}/`);
    } else if (entry.name === "index.html") {
      htmlFiles.push(`/${prefix}`);
    } else if (entry.name.endsWith(".html") && entry.name !== "index.html") {
      const slug = entry.name.replace(".html", "");
      htmlFiles.push(`/${prefix}${slug}`);
    }
  }
}
walkDir(OUT_DIR);

const knownSet = new Set(KNOWN_PAGES.map((p) => p.replace(/\/$/, "") || "/"));
const extras = htmlFiles.filter(
  (f) => !knownSet.has(f.replace(/\/$/, "") || "/")
);

if (extras.length === 0) {
  pass("No unexpected HTML files in build output");
} else {
  for (const extra of extras) {
    if (extra === "/404" || extra === "/404/") continue;
    fail(`EXTRA page in build: ${extra} — not in KNOWN_PAGES`);
  }
  if (extras.every((e) => e === "/404" || e === "/404/")) {
    pass("No unexpected HTML files in build output (404 is expected)");
  }
}

console.log(`\n=== Result: ${exitCode === 0 ? "ALL PASSED" : "FAILURES FOUND"} ===\n`);
process.exit(exitCode);
