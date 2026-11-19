import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { lookupImage, markdownToPlainText, renderMarkdown } from "../../lib/blog/markdown";
import { computeRelated } from "../../lib/blog/related";
import { RULES } from "../../lib/blog/rules";
import { EMPTY_BLOG, type BlogData, type BlogReport, type BuiltPost, type PostMeta, type Problem, type TagDef } from "../../lib/blog/types";
import { parsePostFile, parseTags, validatePost } from "../../lib/blog/validate";
import { findLastGoodFile, historyVersions } from "./history";
import { processImages } from "./images";
import { ogUnsupportedChars, renderOgImage } from "./og";

function analyse(slug: string, raw: string, tags: Map<string, TagDef>): { meta: PostMeta | null; body: string; problems: Problem[] } {
  const parsed = parsePostFile(raw);
  if (!parsed.ok) return { meta: null, body: "", problems: [parsed.problem] };
  const plainText = markdownToPlainText(parsed.body);
  const r = validatePost({ slug, data: parsed.data, body: parsed.body, plainText, tags });
  return { ...r, body: parsed.body };
}

export function countProblems(report: BlogReport): number {
  return Object.values(report.problems).flat().length;
}

/** One line per problem (plus an indented detail line when present). */
export function formatProblems(report: BlogReport): string[] {
  return Object.entries(report.problems).flatMap(([k, ps]) =>
    ps.flatMap((p) => [`  ${k} [${p.level}] ${p.field}: ${p.message}`, ...(p.detail ? [`    ${p.detail}`] : [])])
  );
}

const soft = (field: string, message: string): Problem => ({ level: "soft", field, message });
const BLOG_PATH = /^\/blog\/([^/?#]+)\/$/;

export async function buildBlogData(opts: {
  contentDir: string | null;
  publicDir: string;
}): Promise<{ data: BlogData; report: BlogReport }> {
  const report: BlogReport = { problems: {} };
  if (!opts.contentDir) return { data: structuredClone(EMPTY_BLOG), report };
  const contentDir = opts.contentDir;
  const add = (key: string, ps: Problem[]) => {
    if (ps.length) (report.problems[key] ??= []).push(...ps);
  };

  const postsDir = join(contentDir, "posts");
  if (!existsSync(postsDir)) {
    throw new Error("Blog content has no posts/ folder — refusing to build an empty blog");
  }

  // Tags (fall back to the last good tags.yml if the current one yields nothing).
  const tagsFile = join(contentDir, "tags.yml");
  let tags = new Map<string, TagDef>();
  let tagsBroken = false;
  const tagsExist = existsSync(tagsFile);
  let needFallback = !tagsExist;
  if (tagsExist) {
    const parsed = parseTags(readFileSync(tagsFile, "utf8"));
    tags = parsed.tags;
    add("_tags", parsed.problems);
    needFallback = parsed.problems.length > 0 && tags.size === 0;
  }
  if (needFallback) {
    tagsBroken = true;
    const prev = findLastGoodFile(contentDir, "tags.yml", (raw) => parseTags(raw).tags.size > 0);
    if (prev) {
      tags = parseTags(prev).tags;
      tagsBroken = false;
      add("_tags", [soft("tags.yml", tagsExist ? "tags.yml has a problem, so the previous tag list is still in use." : "tags.yml is missing, so the previous tag list is still in use.")]);
    } else if (!tagsExist) {
      add("_tags", [soft("tags.yml", "tags.yml is missing, so no tags are available.")]);
    }
  }

  // Post files.
  const files: string[] = [];
  for (const e of readdirSync(postsDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (e.name.startsWith(".")) continue;
    if (e.isFile() && e.name.endsWith(".md")) files.push(e.name);
    else add("_content", [soft("posts", `"${e.name}" in posts/ isn't a Markdown (.md) file and was ignored.`)]);
  }
  const postSlugs = new Set(files.map((f) => basename(f, ".md")));

  const { manifest, problems: imageProblems } = await processImages({ contentDir, publicDir: opts.publicDir });
  for (const [folder, ps] of Object.entries(imageProblems)) {
    if (postSlugs.has(folder)) add(folder, ps);
    else add("_images", ps.map((p) => ({ ...p, message: `${folder}: ${p.message}` })));
  }

  const ogDir = join(opts.publicDir, "images", "blog", "_og");
  mkdirSync(ogDir, { recursive: true });
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10); // 1 day of slack

  const built: Omit<BuiltPost, "related">[] = [];
  const redirects: BlogData["redirects"] = [];

  type Rendered = Awaited<ReturnType<typeof renderMarkdown>>;
  const render = async (body: string, m: PostMeta): Promise<{ rendered: Rendered } | { error: string }> => {
    try {
      return { rendered: await renderMarkdown(body, { images: manifest, hasCover: !!(m.cover && lookupImage(manifest, m.cover)) }) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  };
  const publishable = (m: PostMeta | null): m is PostMeta => !!m && !m.redirectTo && !m.draft;
  let renderAttempts = 0;
  let renderFailures = 0;
  let firstRenderError = "";
  let ogAttempts = 0;
  let ogFailures = 0;
  let firstOgError = "";

  for (const file of files) {
    const slug = basename(file, ".md");
    const curRaw = readFileSync(join(postsDir, file), "utf8");
    const cur = analyse(slug, curRaw, tags);
    add(slug, tagsBroken ? cur.problems.filter((p) => p.field !== "tags") : cur.problems);
    let { meta, body } = cur;
    let source: BuiltPost["source"] = "current";
    let rendered: Rendered | null = null;

    if (publishable(meta)) {
      renderAttempts++;
      const r = await render(body, meta);
      if ("rendered" in r) rendered = r.rendered;
      else {
        renderFailures++;
        firstRenderError ||= r.error;
        add(slug, [{ level: "hard", field: "body", message: "This post's text couldn't be processed. Check it for unusual content and publish again.", detail: r.error }]);
        meta = null;
      }
    }

    if (!meta) {
      for (const raw of historyVersions(contentDir, `posts/${slug}.md`, 25)) {
        if (raw === curRaw) continue;
        const a = analyse(slug, raw, tags);
        if (!a.meta) continue;
        if (publishable(a.meta)) {
          const r = await render(a.body, a.meta);
          if (!("rendered" in r)) continue;
          rendered = r.rendered;
          add(slug, [soft("post", "Your latest change has a problem, so the previous version is still live. Fix the problem above and publish again.")]);
        }
        meta = a.meta;
        body = a.body;
        source = "last-good";
        break;
      }
      if (!meta) continue;
    }

    if (meta.redirectTo) {
      redirects.push({ from: `/blog/${slug}/`, to: meta.redirectTo });
      continue;
    }
    if (meta.draft || !rendered) continue;

    add(slug, rendered.warnings);
    if (meta.date > tomorrow) {
      add(slug, [soft("date", `The publish date is in the future (${meta.date}). Posts go live immediately; did you mean a different date?`)]);
    }

    let cover: BuiltPost["cover"];
    if (meta.cover) {
      const img = lookupImage(manifest, meta.cover);
      if (img) cover = { ...img, alt: meta.coverAlt ?? "" };
      else add(slug, [soft("cover", `Cover photo not found: ${meta.cover}. Upload it again in the editor.`)]);
    }

    let ogImage = cover?.src;
    if (!ogImage) {
      const unsupported = ogUnsupportedChars(meta.title);
      if (unsupported.length) {
        add(slug, [soft("cover", `The share image can't show these characters from the title: ${unsupported.join(" ")}. Add a cover photo so the post looks right when shared.`)]);
      }
      ogAttempts++;
      try {
        const png = await renderOgImage({ title: meta.title, tagName: meta.tags[0] ? tags.get(meta.tags[0])?.name : undefined });
        writeFileSync(join(ogDir, `${slug}.png`), png);
        ogImage = `/images/blog/_og/${slug}.png`;
      } catch (err) {
        ogFailures++;
        firstOgError ||= err instanceof Error ? err.message : String(err);
        ogImage = "/images/blog/_og/_blog.png"; // generic blog card, always generated by prepare.ts
        add(slug, [soft("cover", "The share image couldn't be generated, so a default image is used. Add a cover photo to fix this.")]);
      }
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

  const systematic = (fails: number, total: number) => fails >= 2 && fails / total >= 0.5;
  if (systematic(renderFailures, renderAttempts)) {
    throw new Error(`Blog build aborted: ${renderFailures} of ${renderAttempts} posts failed to render — likely a code problem. First error: ${firstRenderError}`);
  }
  if (renderFailures > 0 && built.length === 0) {
    throw new Error(`Blog build aborted: ${renderFailures} of ${renderAttempts} posts failed to render and nothing is left to publish — likely a code problem. First error: ${firstRenderError}`);
  }
  if (systematic(ogFailures, ogAttempts)) {
    throw new Error(`Blog build aborted: ${ogFailures} of ${ogAttempts} share images failed to generate — likely a code problem. First error: ${firstOgError}`);
  }

  // Redirects: normalise, drop loops, flag dead targets, collapse chains.
  const live = new Set(built.map((b) => b.slug));
  const rmap = new Map<string, string>();
  for (const r of redirects) {
    const to = r.to.startsWith("/blog/") && !/[/?#]$/.test(r.to) ? `${r.to}/` : r.to;
    rmap.set(r.from, to);
  }
  const slugOf = (path: string) => path.replace(/^\/blog\//, "").replace(/\/$/, "");
  const inCycle = new Set<string>();
  for (const start of rmap.keys()) {
    const seen: string[] = [];
    let cur: string | undefined = start;
    while (cur !== undefined && !seen.includes(cur)) {
      seen.push(cur);
      cur = rmap.get(cur);
    }
    if (cur === undefined) continue;
    const cycle = seen.slice(seen.indexOf(cur));
    if (cycle.includes(start)) {
      inCycle.add(start);
      const names = [...cycle, cycle[0]].map(slugOf).join(" → ");
      add(slugOf(start), [soft("redirectTo", `This post redirects in a loop (${names}). The redirect was removed.`)]);
    }
  }
  const finalRedirects: BlogData["redirects"] = [];
  for (const [from, to] of rmap) {
    if (inCycle.has(from)) continue;
    let target = to;
    while (rmap.has(target) && !inCycle.has(target)) target = rmap.get(target)!;
    const m = BLOG_PATH.exec(target);
    if (inCycle.has(target)) {
      add(slugOf(from), [soft("redirectTo", `This post redirects to ${target}, which is part of a redirect loop and isn't published.`)]);
    } else if (m && !live.has(m[1])) {
      add(slugOf(from), [soft("redirectTo", `This post redirects to ${target}, which isn't published.`)]);
    }
    finalRedirects.push({ from, to: target });
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

  return { data: { enabled: true, posts, tags: tagPages, redirects: finalRedirects }, report };
}
