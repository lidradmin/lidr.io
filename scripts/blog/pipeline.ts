import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { markdownToPlainText, renderMarkdown } from "../../lib/blog/markdown";
import { computeRelated } from "../../lib/blog/related";
import { RULES } from "../../lib/blog/rules";
import { EMPTY_BLOG, type BlogData, type BlogReport, type BuiltPost, type PostMeta, type Problem, type TagDef } from "../../lib/blog/types";
import { parsePostFile, parseTags, validatePost } from "../../lib/blog/validate";
import { findLastGood } from "./history";
import { processImages } from "./images";
import { ogUnsupportedChars, renderOgImage } from "./og";

function analyse(slug: string, raw: string, tags: Map<string, TagDef>): { meta: PostMeta | null; body: string; problems: Problem[] } {
  const parsed = parsePostFile(raw);
  if (!parsed.ok) return { meta: null, body: "", problems: [parsed.problem] };
  const plainText = markdownToPlainText(parsed.body);
  const r = validatePost({ slug, data: parsed.data, body: parsed.body, plainText, tags });
  return { ...r, body: parsed.body };
}

export async function buildBlogData(opts: {
  contentDir: string | null;
  publicDir: string;
  strict: boolean;
}): Promise<{ data: BlogData; report: BlogReport }> {
  const report: BlogReport = { problems: {} };
  if (!opts.contentDir) return { data: { ...EMPTY_BLOG }, report };
  const contentDir = opts.contentDir;
  const add = (key: string, ps: Problem[]) => {
    if (ps.length) (report.problems[key] ??= []).push(...ps);
  };

  const tagsFile = join(contentDir, "tags.yml");
  const { tags, problems: tagProblems } = existsSync(tagsFile)
    ? parseTags(readFileSync(tagsFile, "utf8"))
    : { tags: new Map<string, TagDef>(), problems: [] };
  add("_tags", tagProblems);

  const { manifest, problems: imageProblems } = await processImages({ contentDir, publicDir: opts.publicDir });
  for (const [slug, ps] of Object.entries(imageProblems)) add(slug, ps);

  const postsDir = join(contentDir, "posts");
  const files = existsSync(postsDir) ? readdirSync(postsDir).filter((f) => f.endsWith(".md")).sort() : [];
  const ogDir = join(opts.publicDir, "images", "blog", "_og");
  mkdirSync(ogDir, { recursive: true });

  const built: Omit<BuiltPost, "related">[] = [];
  const redirects: BlogData["redirects"] = [];

  for (const file of files) {
    const slug = basename(file, ".md");
    let { meta, body, problems } = analyse(slug, readFileSync(join(postsDir, file), "utf8"), tags);
    let source: BuiltPost["source"] = "current";
    add(slug, problems);

    if (!meta) {
      const lastGood = findLastGood(contentDir, slug, (raw) => analyse(slug, raw, tags).meta !== null);
      if (!lastGood) continue;
      ({ meta, body } = analyse(slug, lastGood, tags));
      if (!meta) continue;
      source = "last-good";
      add(slug, [{ level: "soft", field: "post", message: "Your latest change has a problem, so the previous version is still live. Fix the problem above and publish again." }]);
    }

    if (meta.redirectTo) {
      redirects.push({ from: `/blog/${slug}/`, to: meta.redirectTo });
      continue;
    }
    if (meta.draft) continue;

    const rendered = await renderMarkdown(body, { images: manifest });
    add(slug, rendered.warnings);

    let cover: BuiltPost["cover"];
    if (meta.cover) {
      const img = manifest[meta.cover];
      if (img) cover = { ...img, alt: meta.coverAlt ?? meta.title };
      else add(slug, [{ level: "soft", field: "cover", message: `Cover photo not found: ${meta.cover}. Upload it again in the editor.` }]);
    }

    let ogImage = cover?.src;
    if (!ogImage) {
      const unsupported = ogUnsupportedChars(meta.title);
      if (unsupported.length) {
        add(slug, [{ level: "soft", field: "cover", message: `The share image can't show these characters from the title: ${unsupported.join(" ")}. Add a cover photo so the post looks right when shared.` }]);
      }
      const png = await renderOgImage({ title: meta.title, tagName: meta.tags[0] ? tags.get(meta.tags[0])?.name : undefined });
      writeFileSync(join(ogDir, `${slug}.png`), png);
      ogImage = `/images/blog/_og/${slug}.png`;
    }

    built.push({
      slug,
      title: meta.title,
      description: meta.description,
      date: meta.date,
      updated: meta.updated,
      tags: meta.tags,
      cover,
      html: rendered.html,
      readingMinutes: Math.max(1, Math.ceil(rendered.words / RULES.wordsPerMinute)),
      canonical: meta.canonical,
      ogImage,
      source,
    });
  }

  built.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const related = computeRelated(built);
  const posts: BuiltPost[] = built.map((p) => ({ ...p, related: related.get(p.slug) ?? [] }));

  const counts = new Map<string, number>();
  posts.forEach((p) => p.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  const tagPages = [...tags.values()]
    .filter((t) => counts.has(t.slug))
    .map((t) => ({ ...t, count: counts.get(t.slug)! }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  if (opts.strict) {
    const total = Object.values(report.problems).flat().length;
    if (total > 0) {
      const lines = Object.entries(report.problems).flatMap(([k, ps]) => ps.map((p) => `  ${k} [${p.level}] ${p.field}: ${p.message}`));
      throw new Error(`Blog content has ${total} problem(s):\n${lines.join("\n")}`);
    }
  }

  return { data: { enabled: true, posts, tags: tagPages, redirects }, report };
}
