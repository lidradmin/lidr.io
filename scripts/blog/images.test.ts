import { existsSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import exifReader from "exif-reader";
import { beforeAll, describe, expect, test } from "vitest";
import { processImages } from "./images";

type Result = Awaited<ReturnType<typeof processImages>>;

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

describe("processImages robustness", () => {
  let root: string;
  let pub: string;
  let r: Result;
  const msgs = () => Object.values(r.problems).flat().map((p) => p.message).join("\n");
  const slugMsgs = (slug: string) => (r.problems[slug] ?? []).map((p) => p.message).join("\n");

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "blog-edge-"));
    pub = mkdtempSync(join(tmpdir(), "blog-edge-pub-"));
    const dir = join(root, "images", "edge-post");
    mkdirSync(dir, { recursive: true });
    const px = (w: number, h: number, bg: string | { r: number; g: number; b: number; alpha: number }, ch: 3 | 4 = 3) =>
      sharp({ create: { width: w, height: h, channels: ch, background: bg } });

    const real = await px(800, 600, "#456").jpeg().toBuffer();
    writeFileSync(join(dir, "truncated.jpg"), real.subarray(0, Math.floor(real.length / 2)));
    writeFileSync(join(dir, "a.jpg"), real);
    await px(300, 200, "#654").png().toFile(join(dir, "a.png"));
    writeFileSync(join(dir, "My Photo (1).jpg"), real);
    writeFileSync(join(dir, "Photo.jpg"), real);
    await px(30, 30, "#111").png().toFile(join(dir, "photo.png"));
    mkdirSync(join(dir, "x.jpg"));
    const outside = join(root, "outside.jpg");
    writeFileSync(outside, real);
    symlinkSync(outside, join(dir, "link.jpg"));
    writeFileSync(join(dir, "fake.jpg"), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    await px(200, 100, "#888").jpeg().withMetadata({ orientation: 6 }).toFile(join(dir, "rot.jpg"));
    await px(50, 50, { r: 255, g: 0, b: 0, alpha: 0 }, 4).png().toFile(join(dir, "alpha.png"));
    await px(400, 300, "#888").webp().withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" } }).toFile(join(dir, "geo.webp"));
    writeFileSync(join(dir, "iphone.HEIC"), "x");
    writeFileSync(join(dir, "doc.pdf"), "x");
    const big = join(dir, "huge.jpg");
    writeFileSync(big, "");
    truncateSync(big, 16 * 1024 * 1024);
    mkdirSync(join(root, "images", "Bad Slug"));

    r = await processImages({ contentDir: root, publicDir: pub });
  });

  test("a truncated file does not crash the build and leaves no output", () => {
    expect(slugMsgs("edge-post")).toMatch(/"truncated\.jpg" looks damaged or incomplete and was left out\. Upload it again\./);
    expect(r.manifest["/images/blog/edge-post/truncated.jpg"]).toBeUndefined();
    const out = readdirSync(join(pub, "images/blog/edge-post"));
    expect(out.filter((f) => f.startsWith("truncated"))).toEqual([]);
  });

  test("files over the size limit are skipped before reading", () => {
    expect(slugMsgs("edge-post")).toMatch(/"huge\.jpg" is larger than 15 MB/);
    expect(r.manifest["/images/blog/edge-post/huge.jpg"]).toBeUndefined();
  });

  test("same output name collisions: first file wins", () => {
    expect(r.manifest["/images/blog/edge-post/a.jpg"]).toBeDefined();
    expect(r.manifest["/images/blog/edge-post/a.png"]).toBeUndefined();
    expect(slugMsgs("edge-post")).toMatch(/"a\.png" has the same name as another photo in this post\. Rename one and upload again\./);
    expect(r.manifest["/images/blog/edge-post/Photo.jpg"]).toBeDefined();
    expect(r.manifest["/images/blog/edge-post/photo.png"]).toBeUndefined();
    expect(slugMsgs("edge-post")).toMatch(/"photo\.png" has the same name/);
  });

  test("unsafe file names give safe URLs but the manifest key stays raw", () => {
    const img = r.manifest["/images/blog/edge-post/My Photo (1).jpg"];
    expect(img).toBeDefined();
    expect(img.src).toBe("/images/blog/edge-post/my-photo-1-1600.jpg");
    expect(`${img.src} ${img.srcset}`).not.toMatch(/[()]| (?!\d+w)\S*[ ,]\S*\.webp|%/);
    for (const part of img.srcset.split(", ")) expect(part).toMatch(/^\/images\/blog\/edge-post\/my-photo-1-\d+\.webp \d+w$/);
  });

  test("directories and symlinks named like images are skipped with a problem", () => {
    expect(slugMsgs("edge-post")).toMatch(/"x\.jpg" isn't a normal photo file and was skipped\./);
    expect(slugMsgs("edge-post")).toMatch(/"link\.jpg" isn't a normal photo file and was skipped\./);
    expect(r.manifest["/images/blog/edge-post/link.jpg"]).toBeUndefined();
    expect(r.manifest["/images/blog/edge-post/x.jpg"]).toBeUndefined();
  });

  test("invalid slug directories are skipped", () => {
    expect(r.problems["Bad Slug"]).toBeUndefined();
    expect(r.problems["_images"]?.map((p) => p.message).join()).toMatch(/The photo folder "Bad Slug" doesn't match any post name and was skipped\./);
  });

  test("an SVG renamed .jpg is skipped", () => {
    expect(r.manifest["/images/blog/edge-post/fake.jpg"]).toBeUndefined();
    expect(slugMsgs("edge-post")).toMatch(/fake\.jpg/);
  });

  test("EXIF orientation is applied to dimensions", () => {
    const img = r.manifest["/images/blog/edge-post/rot.jpg"];
    expect(img.width).toBe(100);
    expect(img.height).toBe(200);
  });

  test("transparent PNG becomes white in the JPEG fallback", async () => {
    const { data } = await sharp(join(pub, "images/blog/edge-post/alpha-1600.jpg")).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(250);
    expect(data[1]).toBeGreaterThan(250);
    expect(data[2]).toBeGreaterThan(250);
  });

  test("WebP outputs carry no GPS, and the original is flagged", async () => {
    expect(slugMsgs("edge-post")).toMatch(/geo\.webp.*location/);
    const meta = await sharp(join(pub, "images/blog/edge-post/geo-480.webp")).metadata();
    expect(meta.exif ? exifReader(meta.exif).GPSInfo : undefined).toBeUndefined();
  });

  test("HEIC and other unsupported formats get specific messages", () => {
    expect(msgs()).toMatch(/"iphone\.HEIC" is an iPhone HEIC photo, which the blog can't use\. Share it as JPEG \(or set iPhone Settings > Camera > Formats > Most Compatible\) and upload again\./);
    expect(msgs()).toMatch(/"doc\.pdf" isn't a JPEG, PNG or WebP photo, so it was left out\./);
  });

  test("a missing images root gives an empty result", async () => {
    const res = await processImages({ contentDir: join(root, "nope"), publicDir: pub });
    expect(res).toEqual({ manifest: {}, problems: {} });
  });
});

describe("processImages follow-ups", () => {
  let root: string;
  let pub: string;
  let r: Result;
  const slugMsgs = (slug: string) => (r.problems[slug] ?? []).map((p) => p.message).join("\n");
  const gps = { IFD3: { GPSLatitudeRef: "N", GPSLatitude: "51/1 30/1 0/1" } };

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "blog-fu-"));
    pub = mkdtempSync(join(tmpdir(), "blog-fu-pub-"));
    const dir = join(root, "images", "fu-post");
    mkdirSync(dir, { recursive: true });
    const px = (w: number, h: number, bg = "#789") => sharp({ create: { width: w, height: h, channels: 3, background: bg } });

    // GPS-tagged and too tall: fails after the location warning is collected.
    await px(1600, 20000).jpeg().withExif(gps).toFile(join(dir, "tall.jpg"));
    // XMP-only location.
    const xmp = Buffer.from(
      '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="51,30.0N"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>',
    );
    await px(100, 100).jpeg().withXmp(xmp.toString()).toFile(join(dir, "xmp.jpg"));
    // Animated WebP.
    const a = await px(40, 40, "#f00").png().toBuffer();
    const b = await px(40, 40, "#00f").png().toBuffer();
    await sharp([a, b], { join: { animated: true } }).webp({ delay: [100, 100], loop: 0 } as never).toFile(join(dir, "anim.webp"));
    // CMYK and 16-bit.
    await px(120, 80).toColourspace("cmyk").jpeg().toFile(join(dir, "cmyk.jpg"));
    await px(120, 80).toColourspace("rgb16").png().toFile(join(dir, "deep.png"));
    // Stray file at the images root.
    writeFileSync(join(root, "images", "stray.txt"), "x");

    r = await processImages({ contentDir: root, publicDir: pub });
  });

  test("a failing file keeps earlier warnings and adds the failure", () => {
    expect(slugMsgs("fu-post")).toMatch(/"tall\.jpg" contains the location/);
    expect(slugMsgs("fu-post")).toMatch(/"tall\.jpg" is too tall to use \(very long screenshots aren't supported\)\. Crop it and upload again\./);
    expect(r.manifest["/images/blog/fu-post/tall.jpg"]).toBeUndefined();
    expect(readdirSync(join(pub, "images/blog/fu-post")).filter((f) => f.startsWith("tall"))).toEqual([]);
  });

  test("XMP-only location is flagged", () => {
    expect(slugMsgs("fu-post")).toMatch(/"xmp\.jpg" contains the location/);
  });

  test("animated images get a first-frame note and still process", () => {
    expect(slugMsgs("fu-post")).toMatch(/"anim\.webp" is animated/);
    expect(r.manifest["/images/blog/fu-post/anim.webp"]).toBeDefined();
  });

  test("CMYK and 16-bit PNG inputs process fine", () => {
    expect(r.manifest["/images/blog/fu-post/cmyk.jpg"]).toMatchObject({ width: 120, height: 80 });
    expect(r.manifest["/images/blog/fu-post/deep.png"]).toMatchObject({ width: 120, height: 80 });
    expect(slugMsgs("fu-post")).not.toMatch(/cmyk|deep/);
  });

  test("root-level strays are reported under _images", () => {
    expect((r.problems["_images"] ?? []).map((p) => p.message).join()).toMatch(/stray\.txt/);
  });
});
