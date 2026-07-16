// Downloads every image/font/icon actually requested by the captured pages
// (capture/assets.json) into capture/raw-assets/, deduplicated by URL and
// preserving the original filename (basename of the URL path).
//
// capture/assets.json maps page-slug -> array of every network request URL
// seen while capturing that page (see scripts/capture/capture.mjs). We only
// care about the asset-like subset (images/fonts/icons) here; JS/CSS/HTML
// requests are filtered out.
//
// Filename collisions: two different URLs that share a basename would
// overwrite each other in capture/raw-assets/. We detect this up front and
// disambiguate by prefixing a short hash of the full URL, rather than
// silently losing one of the files.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { createHash } from "node:crypto";

const log = JSON.parse(readFileSync("capture/assets.json", "utf8"));
const wanted = /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot)(\?|$)/i;
const urls = [...new Set(Object.values(log).flat())].filter((u) => {
  try {
    const parsed = new URL(u);
    void parsed;
  } catch {
    return false;
  }
  return wanted.test(u);
});

mkdirSync("capture/raw-assets", { recursive: true });

// Pre-compute names and detect collisions (same basename, different URL).
const nameFor = new Map();
const seenNames = new Map(); // name -> url that first claimed it
for (const url of urls) {
  // decodeURIComponent so "Apple%20Pay.svg" decodes, then replace spaces
  // with hyphens so the name is a clean, URL-safe filename once served
  // from /public (e.g. "Apple Pay.svg" -> "Apple-Pay.svg").
  let name = decodeURIComponent(basename(new URL(url).pathname)).replace(/\s+/g, "-");
  if (seenNames.has(name) && seenNames.get(name) !== url) {
    const hash = createHash("sha1").update(url).digest("hex").slice(0, 8);
    const dot = name.lastIndexOf(".");
    name = dot === -1 ? `${name}-${hash}` : `${name.slice(0, dot)}-${hash}${name.slice(dot)}`;
    console.warn("COLLISION disambiguated:", url, "->", name);
  }
  seenNames.set(name, url);
  nameFor.set(url, name);
}

const manifest = {};
let downloaded = 0;
for (const url of urls) {
  const name = nameFor.get(url);
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.warn("SKIP", "fetch-error", url, err.message);
    continue;
  }
  if (!res.ok) {
    console.warn("SKIP", res.status, url);
    continue;
  }
  manifest[url] = name;
  writeFileSync(`capture/raw-assets/${name}`, Buffer.from(await res.arrayBuffer()));
  downloaded++;
}
writeFileSync("capture/raw-assets/manifest.json", JSON.stringify(manifest, null, 2));
console.log(`downloaded ${downloaded}/${urls.length}`);
