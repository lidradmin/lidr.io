import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import exifReader from "exif-reader";
import sharp, { type Metadata } from "sharp";
import type { ImageManifest } from "../../lib/blog/markdown";
import { RULES } from "../../lib/blog/rules";
import type { Problem } from "../../lib/blog/types";

export const WIDTHS = [480, 960, 1600] as const;
const MAX_WIDTH = WIDTHS[WIDTHS.length - 1];
const CONCURRENCY = 3;
const MAX_PIXELS = 100_000_000;
const REAL_FORMATS = ["jpeg", "png", "webp"];

const soft = (message: string): Problem => ({ level: "soft", field: "images", message });

function hasGps(meta: Metadata): boolean {
  if (meta.exif) {
    try {
      const info = exifReader(meta.exif).GPSInfo;
      if (info && info.GPSLatitude !== undefined) return true;
    } catch {
      // unreadable EXIF: fall through to the XMP check
    }
  }
  return !!meta.xmp && meta.xmp.toString("latin1").includes("GPSLatitude");
}

/** Lowercase ASCII, hyphen-separated, safe in URLs and srcset. */
function safeName(base: string): string {
  return (
    base
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "image"
  );
}

type FileResult = { key?: string; variant?: ImageManifest[string]; problems: Problem[] };

async function processFile(opts: {
  slug: string;
  file: string;
  outName: string;
  inDir: string;
  outDir: string;
}): Promise<FileResult> {
  const { slug, file, outName, inDir, outDir } = opts;
  const problems: Problem[] = [];
  const written: string[] = [];
  try {
    const path = join(inDir, file);
    if (statSync(path).size > RULES.maxImageBytes) {
      const mb = Math.round(RULES.maxImageBytes / (1024 * 1024));
      return { problems: [soft(`"${file}" is larger than ${mb} MB and was skipped. Upload a smaller version.`)] };
    }
    const input = readFileSync(path);
    const open = () => sharp(input, { failOn: "error", limitInputPixels: MAX_PIXELS });
    const meta = await open().metadata();
    if (!meta.format || !REAL_FORMATS.includes(meta.format)) {
      return { problems: [soft(`"${file}" isn't a JPEG, PNG or WebP photo, so it was left out.`)] };
    }
    if (hasGps(meta)) {
      problems.push(soft(`"${file}" contains the location where it was taken. The published copy has it removed, but the original upload is public. Turn off location before uploading photos.`));
    }
    if ((meta.pages ?? 1) > 1) {
      problems.push(soft(`"${file}" is animated. Only its first frame is used.`));
    }

    // Decode, rotate and resize once; every output is derived from this buffer.
    const { data, info: raw } = await open()
      .rotate() // apply EXIF orientation
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const fromRaw = () => sharp(data, { raw: { width: raw.width, height: raw.height, channels: raw.channels } });

    // Outputs deliberately carry no metadata: keepMetadata()/withMetadata() is
    // NOT called, so EXIF (including GPS), XMP and ICC are stripped.
    mkdirSync(outDir, { recursive: true });
    const urlBase = `/images/blog/${slug}/${outName}`;
    const srcset: string[] = [];
    const seen = new Set<number>();
    for (const w of WIDTHS) {
      const target = join(outDir, `${outName}-${w}.webp`);
      written.push(target);
      const info = await fromRaw().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(target);
      if (!seen.has(info.width)) {
        seen.add(info.width);
        srcset.push(`${urlBase}-${w}.webp ${info.width}w`);
      }
    }
    const jpg = join(outDir, `${outName}-${MAX_WIDTH}.jpg`);
    written.push(jpg);
    await fromRaw().flatten({ background: "#ffffff" }).jpeg({ quality: 80, mozjpeg: true }).toFile(jpg);

    return {
      key: `/images/blog/${slug}/${file}`,
      variant: { src: `${urlBase}-${MAX_WIDTH}.jpg`, srcset: srcset.join(", "), width: raw.width, height: raw.height },
      problems,
    };
  } catch (err) {
    for (const f of written) rmSync(f, { force: true });
    const text = err instanceof Error ? err.message : String(err);
    if (/pixel limit/i.test(text)) {
      return { problems: [soft(`"${file}" is too large (over 100 megapixels). Upload a smaller version.`)] };
    }
    return { problems: [soft(`"${file}" looks damaged or incomplete and was left out. Upload it again.`)] };
  }
}

/**
 * Turns content/images/<slug>/<file> into optimised, metadata-free files at
 * public/images/blog/<slug>/<name>-<w>.webp and <name>-1600.jpg.
 * Manifest keys are the paths authors use in Markdown: /images/blog/<slug>/<file>.
 * One bad file never fails the build; it becomes a soft problem.
 */
export async function processImages(opts: {
  contentDir: string;
  publicDir: string;
}): Promise<{ manifest: ImageManifest; problems: Record<string, Problem[]> }> {
  const manifest: ImageManifest = {};
  const problems: Record<string, Problem[]> = {};
  const add = (slug: string, p: Problem) => (problems[slug] ??= []).push(p);
  const root = join(opts.contentDir, "images");
  if (!existsSync(root)) return { manifest, problems };

  const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const notNormal = (name: string) => soft(`"${name}" isn't a normal photo file and was skipped.`);

  for (const d of readdirSync(root, { withFileTypes: true }).sort(byName)) {
    if (d.name.startsWith(".")) continue;
    if (!d.isDirectory() || !RULES.slugPattern.test(d.name)) {
      add(d.name, notNormal(d.name));
      continue;
    }
    const slug = d.name;
    const inDir = join(root, slug);
    const outDir = join(opts.publicDir, "images", "blog", slug);

    // Sequential pass: classify files and resolve name collisions (first sorted file wins).
    const used = new Set<string>();
    const jobs: { file: string; outName: string }[] = [];
    for (const f of readdirSync(inDir, { withFileTypes: true }).sort(byName)) {
      const file = f.name;
      if (file.startsWith(".")) continue;
      if (!f.isFile()) {
        add(slug, notNormal(file));
        continue;
      }
      const ext = extname(file).slice(1).toLowerCase();
      if (ext === "heic" || ext === "heif") {
        add(slug, soft(`"${file}" is an iPhone HEIC photo, which the blog can't use. Share it as JPEG (or set iPhone Settings > Camera > Formats > Most Compatible) and upload again.`));
        continue;
      }
      if (!(RULES.imageExtensions as readonly string[]).includes(ext)) {
        add(slug, soft(`"${file}" isn't a JPEG, PNG or WebP photo, so it was left out.`));
        continue;
      }
      const outName = safeName(basename(file, extname(file)));
      if (used.has(outName)) {
        add(slug, soft(`"${file}" has the same name as another photo in this post. Rename one and upload again.`));
        continue;
      }
      used.add(outName);
      jobs.push({ file, outName });
    }

    // Up to CONCURRENCY files at a time; results are applied in sorted order.
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const results = await Promise.all(
        jobs.slice(i, i + CONCURRENCY).map((j) => processFile({ slug, inDir, outDir, ...j })),
      );
      for (const res of results) {
        for (const p of res.problems) add(slug, p);
        if (res.key && res.variant) manifest[res.key] = res.variant;
      }
    }
  }
  return { manifest, problems };
}
