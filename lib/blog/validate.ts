import { parse as parseYaml } from "yaml";
import { RULES } from "./rules";
import type { PostMeta, Problem, TagDef } from "./types";

const hard = (field: string, message: string, detail?: string): Problem =>
  detail ? { level: "hard", field, message, detail } : { level: "hard", field, message };
const soft = (field: string, message: string): Problem => ({ level: "soft", field, message });

const WRONG_FORMAT =
  "The settings at the top of the post are in the wrong format. Open it in lidr.io/admin and Publish again.";
const REDIRECT_PATTERN = /^\/(?:[a-z0-9-]+\/)*(?:[a-z0-9-]+\/?)?$/;
const OWN_HOSTS = ["lidr.io", "www.lidr.io"];

export type ParsedFile =
  | { ok: true; data: Record<string, unknown>; body: string }
  | { ok: false; problem: Problem };

/**
 * Parses `---` delimited YAML front-matter ourselves. We deliberately do NOT
 * use gray-matter: it ships JS/JSON engines (`---js` runs eval) that would
 * execute code from content during the build.
 */
export function parsePostFile(raw: string): ParsedFile {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r\n|\n/);
  const first = lines[0].trimEnd();
  if (!first.startsWith("---")) {
    return { ok: false, problem: hard("front-matter", "The post has no settings block (title and date) at the top. Open it in lidr.io/admin and Publish again.") };
  }
  if (first !== "---") {
    return { ok: false, problem: hard("front-matter", WRONG_FORMAT, `Opening line is "${first}", expected "---"`) };
  }
  const close = lines.findIndex((l, i) => i > 0 && l.trimEnd() === "---");
  if (close === -1) {
    return { ok: false, problem: hard("front-matter", WRONG_FORMAT, "No closing --- line") };
  }
  const fmText = lines.slice(1, close).join("\n");
  if (fmText.length > 32 * 1024) {
    return {
      ok: false,
      problem: hard("front-matter", "The settings at the top of the post are too long. Open it in lidr.io/admin and Publish again.", `${fmText.length} characters`),
    };
  }
  let data: unknown;
  try {
    data = parseYaml(lines.slice(1, close).join("\n"), { uniqueKeys: true });
  } catch (err) {
    const e = err as { code?: string; message?: string; linePos?: { line: number }[] };
    const detail = (e.message ?? "").split("\n")[0];
    if (e.code === "DUPLICATE_KEY") {
      const line = e.linePos?.[0]?.line;
      const key = line ? /^\s*["']?([^:"']+)["']?\s*:/.exec(lines[line] ?? "")?.[1]?.trim() : undefined;
      return {
        ok: false,
        problem: hard("front-matter", key ? `The setting '${key}' appears twice at the top of the post. Delete one.` : "A setting appears twice at the top of the post. Delete one.", detail),
      };
    }
    return {
      ok: false,
      problem: hard("front-matter", "Something in the settings at the top of the post is in the wrong format. Open it in lidr.io/admin and Publish again.", detail),
    };
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, problem: hard("front-matter", WRONG_FORMAT) };
  }
  return { ok: true, data: data as Record<string, unknown>, body: lines.slice(close + 1).join("\n").trim() };
}

function toDateString(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return toDateString(v.toISOString().slice(0, 10));
  if (typeof v === "string" && RULES.datePattern.test(v)) {
    const d = new Date(`${v}T00:00:00Z`);
    const year = d.getUTCFullYear();
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && year >= 2000 && year <= 2100) return v;
  }
  return null;
}

/** YAML reads `title: 1984` as a number; accept scalars as text. */
function str(v: unknown): string {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v).trim() : "";
}

export function excerpt(text: string, max: number = RULES.excerptLength): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(" ", max);
  return `${t.slice(0, cut > 0 ? cut : max).replace(/[\s.,;:!?\-–—]+$/, "")}…`;
}

export function validatePost(input: {
  slug: string;
  data: Record<string, unknown>;
  body: string;
  plainText: string;
  tags: Map<string, TagDef>;
}): { meta: PostMeta | null; problems: Problem[] } {
  const { slug, data } = input;
  const p: Problem[] = [];

  if (!RULES.slugPattern.test(slug)) {
    p.push(hard("slug", `The file name "${slug}" must use only lowercase letters, numbers and hyphens. The file name can't be changed in the editor; contact the site owner.`));
  }
  const title = str(data.title);
  const date = toDateString(data.date);

  // A retired post that redirects elsewhere only needs a valid slug and
  // shouldn't nag its author, even if it was emptied.
  let redirectTo: string | undefined;
  let redirectBad = false;
  if (data.redirectTo !== undefined && data.redirectTo !== null && data.redirectTo !== "") {
    const r = data.redirectTo;
    if (typeof r === "string" && REDIRECT_PATTERN.test(r) && r.replace(/\/$/, "") !== `/blog/${slug}`) {
      redirectTo = r;
    } else redirectBad = true;
  }
  if (redirectTo && p.length === 0) {
    return {
      meta: { slug, title: title || slug, description: "", date: date ?? "", tags: [], draft: false, redirectTo },
      problems: [],
    };
  }

  if (!title) p.push(hard("title", "The post has no title."));
  if (!date) p.push(hard("date", "The publish date is missing or isn't a real date (for example 2026-11-12). Pick a date in the editor."));
  if (!input.body.trim()) p.push(hard("body", "The post has no text."));
  if (p.length > 0 || !date) return { meta: null, problems: p };

  const { title: tr, description: dr, tags: tg } = RULES;
  if (title.length < tr.min || title.length > tr.max) {
    p.push(soft("title", `The title is ${title.length} characters. Aim for ${tr.min}–${tr.max} so Google shows it in full.`));
  }

  let description = str(data.description);
  if (!description) {
    p.push(soft("description", `The description is empty, so the opening text is used instead. Write one (${dr.min}–${dr.max} characters) for Google results.`));
    description = excerpt(input.plainText) || title;
  } else if (description.length > dr.max) {
    p.push(soft("description", `The description is ${description.length} characters. Google cuts it off after about ${dr.max}. Shorten it.`));
  } else if (description.length < dr.min) {
    p.push(soft("description", `The description is only ${description.length} characters. Aim for ${dr.min}–${dr.max} so Google has enough to show.`));
  }

  let updated: string | undefined;
  if (data.updated !== undefined && data.updated !== null && data.updated !== "") {
    const u = toDateString(data.updated);
    if (!u || u < date) {
      p.push(soft("updated", "The 'updated' date isn't valid or is earlier than the publish date, so it was ignored."));
    } else updated = u;
  }

  let rawTags: string[] = [];
  let tagsBadFormat = false;
  if (Array.isArray(data.tags)) {
    rawTags = data.tags.map(str);
  } else if (typeof data.tags === "string") {
    rawTags = data.tags.split(",");
  } else if (data.tags !== undefined && data.tags !== null) {
    tagsBadFormat = true;
  }
  rawTags = [...new Set(rawTags.map((t) => t.trim()).filter(Boolean))];
  const unknown = rawTags.filter((t) => !input.tags.has(t));
  let tags = rawTags.filter((t) => input.tags.has(t));
  if (tagsBadFormat) {
    p.push(soft("tags", "The tags are in the wrong format, so the post has no tags. Pick tags from the list in the editor."));
  } else {
    if (unknown.length) {
      p.push(soft("tags", `These tags don't exist and were removed: ${unknown.join(", ")}. Pick from the tag list.`));
    }
    if (tags.length < tg.min) {
      p.push(soft("tags", rawTags.length > 0
        ? "None of the tags exist, so the post now has no tags. Add 1–3 so readers can find related posts."
        : "The post has no tags. Add 1–3 so readers can find related posts."));
    } else if (tags.length > tg.max) {
      p.push(soft("tags", `The post has ${tags.length} tags. Only the first ${tg.max} are used.`));
      tags = tags.slice(0, tg.max);
    }
  }

  const cover = str(data.cover) || undefined;
  let coverAlt = str(data.coverAlt);
  if (cover && !coverAlt) {
    p.push(soft("coverAlt", "The cover photo has no description (alt text), so the title is used. Describe what the photo shows."));
    coverAlt = title;
  }

  if (redirectBad) {
    p.push(soft("redirectTo", "The redirect must be a path on lidr.io such as /blog/other/, and not this post's own address. It was ignored."));
  }

  let canonical: string | undefined;
  if (data.canonical !== undefined && data.canonical !== null && data.canonical !== "") {
    let url: URL | null = null;
    if (typeof data.canonical === "string") {
      try {
        url = new URL(data.canonical.trim());
      } catch {
        url = null;
      }
    }
    if (url && url.protocol === "https:" && url.hostname) {
      canonical = url.href;
      if (!OWN_HOSTS.includes(url.hostname)) {
        p.push(soft("canonical", `This post tells Google its original is on ${url.hostname}. If that's not intended, remove the canonical setting.`));
      }
    } else p.push(soft("canonical", "The canonical URL must start with https:// and be a real address. It was ignored."));
  }

  // Fail safe: anything that isn't clearly "off" hides the post.
  let draft = false;
  const d = data.draft;
  if (typeof d === "boolean") draft = d;
  else if (d === 0) draft = false;
  else if (d === 1) draft = true;
  else if (d !== undefined && d !== null && d !== "") {
    const v = typeof d === "string" ? d.trim().toLowerCase() : "";
    if (["true", "yes", "on"].includes(v)) draft = true;
    else if (["false", "no", "off"].includes(v)) draft = false;
    else {
      draft = true;
      p.push(soft("draft", "The 'draft' setting should be on or off. It was treated as on (hidden)."));
    }
  }

  return {
    meta: {
      slug,
      title,
      description,
      date,
      updated,
      tags,
      cover,
      coverAlt: cover ? coverAlt : undefined,
      draft,
      redirectTo: undefined,
      canonical,
    },
    problems: p,
  };
}

export function parseTags(yamlText: string): { tags: Map<string, TagDef>; problems: Problem[] } {
  const tags = new Map<string, TagDef>();
  const problems: Problem[] = [];
  let doc: unknown;
  try {
    doc = parseYaml(yamlText);
  } catch {
    return { tags, problems: [soft("tags.yml", "The tag list can't be read. Open Tags in the editor and save it again.")] };
  }
  const list = doc && typeof doc === "object" && !Array.isArray(doc) ? (doc as { tags?: unknown }).tags : undefined;
  if (!Array.isArray(list)) {
    problems.push(soft("tags.yml", "The tag list is empty or in the wrong format, so no tags are available. Open Tags in the editor and add some."));
    return { tags, problems };
  }
  for (const entry of list) {
    const e = entry as Partial<TagDef>;
    if (typeof e?.slug === "string" && RULES.slugPattern.test(e.slug) && typeof e.name === "string" && e.name.trim()) {
      if (tags.has(e.slug)) {
        problems.push(soft("tags.yml", `The tag "${e.slug}" appears twice. The first one is used.`));
        continue;
      }
      tags.set(e.slug, { slug: e.slug, name: e.name.trim(), description: typeof e.description === "string" ? e.description.trim() : "" });
    } else {
      problems.push(soft("tags.yml", `A tag is missing a name or has an invalid slug (${JSON.stringify(entry)}). It was skipped.`));
    }
  }
  return { tags, problems };
}
