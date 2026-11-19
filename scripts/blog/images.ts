import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import exifReader from "exif-reader";
import sharp from "sharp";
import type { ImageManifest } from "../../lib/blog/markdown";
import { RULES } from "../../lib/blog/rules";
import type { Problem } from "../../lib/blog/types";

export const WIDTHS = [480, 960, 1600] as const;

const soft = (message: string): Problem => ({ level: "soft", field: "images", message });

function hasGps(exif: Buffer | undefined): boolean {
  if (!exif) return false;
  try {
    const info = exifReader(exif).GPSInfo;
    return !!info && Object.keys(info).length > 0;
  } catch {
    return false;
  }
}

/**
 * Turns content/images/<slug>/<file> into optimised, metadata-free files at
 * public/images/blog/<slug>/<name>-<w>.webp and <name>-1600.jpg.
 * Manifest keys are the paths authors use in Markdown: /images/blog/<slug>/<file>.
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

  for (const slug of readdirSync(root).sort()) {
    const dir = join(root, slug);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir).sort()) {
      if (file.startsWith(".")) continue;
      const ext = extname(file).slice(1).toLowerCase();
      if (!(RULES.imageExtensions as readonly string[]).includes(ext)) {
        add(slug, soft(`"${file}" is a ${ext.toUpperCase() || "unknown"} file, which browsers can't show. Save it as JPEG and upload it again.`));
        continue;
      }
      const input = readFileSync(join(dir, file));
      if (input.length > RULES.maxImageBytes) {
        add(slug, soft(`"${file}" is larger than 15 MB and was skipped. Upload a smaller version.`));
        continue;
      }
      let meta: sharp.Metadata;
      try {
        meta = await sharp(input).metadata();
      } catch {
        add(slug, soft(`"${file}" can't be opened as an image. Upload it again.`));
        continue;
      }
      if (hasGps(meta.exif)) {
        add(slug, soft(`"${file}" contains the location where it was taken. The published copy has it removed, but the original upload is public. Turn off location before uploading photos.`));
      }

      const name = basename(file, extname(file));
      const outDir = join(opts.publicDir, "images", "blog", slug);
      mkdirSync(outDir, { recursive: true });
      const urlBase = `/images/blog/${slug}/${name}`;

      const srcset: string[] = [];
      const seen = new Set<number>();
      let width = 0;
      let height = 0;
      for (const w of WIDTHS) {
        const info = await sharp(input)
          .rotate() // apply EXIF orientation; output has no metadata
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: 78 })
          .toFile(join(outDir, `${name}-${w}.webp`));
        if (!seen.has(info.width)) {
          seen.add(info.width);
          srcset.push(`${urlBase}-${w}.webp ${info.width}w`);
        }
        width = info.width;
        height = info.height;
      }
      await sharp(input)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(join(outDir, `${name}-1600.jpg`));

      manifest[`/images/blog/${slug}/${file}`] = { src: `${urlBase}-1600.jpg`, srcset: srcset.join(", "), width, height };
    }
  }
  return { manifest, problems };
}
