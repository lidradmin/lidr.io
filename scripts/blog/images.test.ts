import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import exifReader from "exif-reader";
import { beforeAll, describe, expect, test } from "vitest";
import { processImages } from "./images";

let contentDir: string;
let publicDir: string;

beforeAll(async () => {
  contentDir = mkdtempSync(join(tmpdir(), "blog-img-"));
  publicDir = mkdtempSync(join(tmpdir(), "blog-pub-"));
  const dir = join(contentDir, "images", "my-post");
  mkdirSync(dir, { recursive: true });
  const base = sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#888" } });
  await base.clone().jpeg().withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" } }).toFile(join(dir, "gps.jpg"));
  await base.clone().resize(600).png().toFile(join(dir, "small.png"));
  writeFileSync(join(dir, "phone.heic"), "not really heic");
});

describe("processImages", () => {
  test("creates webp variants and a jpeg fallback with real dimensions", async () => {
    const { manifest } = await processImages({ contentDir, publicDir });
    const img = manifest["/images/blog/my-post/gps.jpg"];
    expect(img).toEqual({
      src: "/images/blog/my-post/gps-1600.jpg",
      srcset: "/images/blog/my-post/gps-480.webp 480w, /images/blog/my-post/gps-960.webp 960w, /images/blog/my-post/gps-1600.webp 1600w",
      width: 1600,
      height: 1067,
    });
    expect(existsSync(join(publicDir, "images/blog/my-post/gps-960.webp"))).toBe(true);
  });

  test("never enlarges small images and dedupes srcset widths", async () => {
    const { manifest } = await processImages({ contentDir, publicDir });
    const img = manifest["/images/blog/my-post/small.png"];
    expect(img.width).toBe(600);
    expect(img.srcset).toBe("/images/blog/my-post/small-480.webp 480w, /images/blog/my-post/small-960.webp 600w");
  });

  test("published files contain no GPS data", async () => {
    await processImages({ contentDir, publicDir });
    const meta = await sharp(join(publicDir, "images/blog/my-post/gps-1600.jpg")).metadata();
    const gps = meta.exif ? exifReader(meta.exif).GPSInfo : undefined;
    expect(gps).toBeUndefined();
  });

  test("warns about GPS in originals and unsupported formats", async () => {
    const { problems } = await processImages({ contentDir, publicDir });
    const msgs = problems["my-post"].map((p) => p.message).join("\n");
    expect(msgs).toMatch(/gps\.jpg.*location/);
    expect(msgs).toMatch(/phone\.heic.*JPEG/);
  });
});
