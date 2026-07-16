// Converts raster images harvested into capture/raw-assets/ into optimized
// WebP files in public/images/ (original size + a half-size variant for
// large images, used as srcset candidates by later tasks). SVG/ICO pass
// through unchanged into public/icons/ since they're already vector/tiny
// and re-encoding buys nothing.
import sharp from "sharp";
import { mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { extname, parse } from "node:path";

mkdirSync("public/images", { recursive: true });
mkdirSync("public/icons", { recursive: true });

const RASTER_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

// Filenames where flat-color / logo-like content means lossy quantization
// at quality 82 can show visible banding — these get lossless WebP instead.
// (Populated from the Step 4 visual spot-check; see report/SOURCES notes.)
const LOSSLESS = new Set(["loading11.png"]);

let count = 0;
for (const f of readdirSync("capture/raw-assets")) {
  const ext = extname(f).toLowerCase();
  const { name } = parse(f);
  if (f === "manifest.json") continue;
  if ([".svg", ".ico"].includes(ext)) {
    copyFileSync(`capture/raw-assets/${f}`, `public/icons/${f}`);
    count++;
  } else if (RASTER_EXT.includes(ext)) {
    const img = sharp(`capture/raw-assets/${f}`);
    const { width } = await img.metadata();
    const lossless = LOSSLESS.has(f);
    await img
      .webp(lossless ? { lossless: true } : { quality: 82 })
      .toFile(`public/images/${name}.webp`);
    if (width > 800)
      await sharp(`capture/raw-assets/${f}`)
        .resize({ width: Math.round(width / 2) })
        .webp(lossless ? { lossless: true } : { quality: 82 })
        .toFile(`public/images/${name}-half.webp`);
    count++;
  } else {
    console.warn("SKIP unhandled extension:", f);
  }
}
console.log(`optimized ${count} source files`);
