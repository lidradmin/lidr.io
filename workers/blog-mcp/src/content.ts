import { stringify } from "yaml";
import { markdownToPlainText, renderMarkdown, type ImageManifest } from "../../../lib/blog/markdown";
import { RULES } from "../../../lib/blog/rules";
import type { Problem, TagDef } from "../../../lib/blog/types";
import { parsePostFile, validatePost } from "../../../lib/blog/validate";

/** A post as Claude sends it. Same fields the editor shows. */
export type Draft = {
  title: string;
  description: string;
  tags: string[];
  body: string;
  date?: string;
  updated?: string;
  cover?: string;
  coverAlt?: string;
  draft?: boolean;
};

export const imagePublicPath = (slug: string, file: string) => `/images/blog/${slug}/${file}`;
export const imageRepoPath = (slug: string, file: string) => `images/${slug}/${file}`;
export const postRepoPath = (slug: string) => `posts/${slug}.md`;
export const today = () => new Date().toISOString().slice(0, 10);

const MAX_SLUG = 80;

/** The post's web address part, built the way the editor builds it from the title. */
export function slugify(title: string): string {
  const s = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= MAX_SLUG) return s;
  const cut = s.slice(0, MAX_SLUG + 1);
  const at = cut.lastIndexOf("-");
  return (at > 20 ? cut.slice(0, at) : s.slice(0, MAX_SLUG)).replace(/-+$/, "");
}

/** Photo file names: lowercase words joined by hyphens, always .jpg (uploads are converted to JPEG). */
export function safeFileName(name: string): string {
  const base = name.replace(/\.[A-Za-z0-9]+$/, "");
  return `${slugify(base).slice(0, 60).replace(/-+$/, "") || "photo"}.jpg`;
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 120 && RULES.slugPattern.test(slug);
}

/** The post file exactly as the site reads it: a YAML settings block, then Markdown. */
export function buildPostFile(d: Draft): string {
  const data: Record<string, unknown> = {
    title: d.title,
    description: d.description,
    date: d.date || today(),
  };
  if (d.updated) data.updated = d.updated;
  data.tags = d.tags;
  if (d.cover) data.cover = d.cover;
  if (d.cover && d.coverAlt) data.coverAlt = d.coverAlt;
  data.draft = !!d.draft;
  return `---\n${stringify(data, { lineWidth: 0 })}---\n${d.body.trim()}\n`;
}

/**
 * Runs the site's own rules on a draft. `hard` problems stop the post going
 * live; `soft` ones are warnings. `knownImages` holds the public paths of
 * photos uploaded for this post (pending or already in the repo).
 */
export async function checkDraft(
  d: Draft,
  ctx: { slug: string; tags: Map<string, TagDef>; knownImages: Set<string> },
): Promise<{ hard: Problem[]; soft: Problem[] }> {
  const problems: Problem[] = [];
  const parsed = parsePostFile(buildPostFile(d));
  if (!parsed.ok) {
    problems.push(parsed.problem);
  } else {
    const plainText = markdownToPlainText(parsed.body);
    const v = validatePost({ slug: ctx.slug, data: parsed.data, body: parsed.body, plainText, tags: ctx.tags });
    problems.push(...v.problems);
    if (v.meta) {
      const images: ImageManifest = {};
      for (const src of ctx.knownImages) images[src] = { src, srcset: src, width: 1600, height: 1000 };
      const coverKnown = !!d.cover && ctx.knownImages.has(d.cover);
      if (d.cover && !coverKnown) {
        problems.push({ level: "soft", field: "cover", message: `Cover photo not uploaded for this post: ${d.cover}. Upload it with start_photo_upload first, or leave the cover out.` });
      }
      const rendered = await renderMarkdown(parsed.body, { images, hasCover: coverKnown });
      problems.push(...rendered.warnings);
    }
  }
  return { hard: problems.filter((p) => p.level === "hard"), soft: problems.filter((p) => p.level !== "hard") };
}
