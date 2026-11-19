import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import { RULES } from "./rules";
import type { PostMeta, Problem, TagDef } from "./types";

const hard = (field: string, message: string): Problem => ({ level: "hard", field, message });
const soft = (field: string, message: string): Problem => ({ level: "soft", field, message });

export type ParsedFile =
  | { ok: true; data: Record<string, unknown>; body: string }
  | { ok: false; problem: Problem };

export function parsePostFile(raw: string): ParsedFile {
  try {
    // Parse front-matter with the `yaml` package (YAML 1.2, safe by default)
    // instead of gray-matter's bundled js-yaml 3.x, which has a known
    // prototype-pollution advisory. Passing options also disables
    // gray-matter's cache (we parse historical versions of the same file).
    const { data, content } = matter(raw, {
      engines: { yaml: (s: string) => (parseYaml(s) ?? {}) as object },
    });
    return { ok: true, data: data as Record<string, unknown>, body: content.trim() };
  } catch (err) {
    return {
      ok: false,
      problem: hard(
        "front-matter",
        `The post's settings block can't be read (${(err as Error).message.split("\n")[0]}). Open it in the editor and save it again.`
      ),
    };
  }
}

function toDateString(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && RULES.datePattern.test(v) && !Number.isNaN(Date.parse(v))) return v;
  return null;
}

export function excerpt(text: string, max: number = RULES.excerptLength): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(" ", max);
  return `${t.slice(0, cut > 0 ? cut : max).trim()}…`;
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
    p.push(hard("slug", `The file name "${slug}" must use only lowercase letters, numbers and hyphens.`));
  }
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) p.push(hard("title", "The post has no title."));
  const date = toDateString(data.date);
  if (!date) p.push(hard("date", "The publish date is missing or isn't a real date (YYYY-MM-DD)."));
  if (!input.body.trim()) p.push(hard("body", "The post has no text."));
  if (p.length > 0 || !date) return { meta: null, problems: p };

  const { title: tr, description: dr, tags: tg } = RULES;
  if (title.length < tr.min || title.length > tr.max) {
    p.push(soft("title", `The title is ${title.length} characters. Aim for ${tr.min}–${tr.max} so Google shows it in full.`));
  }

  let description = typeof data.description === "string" ? data.description.trim() : "";
  if (!description) {
    p.push(soft("description", `The description is empty, so the opening text is used instead. Write one (${dr.min}–${dr.max} characters) for Google results.`));
    description = excerpt(input.plainText);
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

  const rawTags = Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string") : [];
  const unknown = rawTags.filter((t) => !input.tags.has(t));
  let tags = rawTags.filter((t) => input.tags.has(t));
  if (unknown.length) {
    p.push(soft("tags", `These tags don't exist and were removed: ${unknown.join(", ")}. Pick from the tag list.`));
  }
  if (tags.length < tg.min) {
    p.push(soft("tags", "The post has no tags. Add 1–3 so readers can find related posts."));
  } else if (tags.length > tg.max) {
    p.push(soft("tags", `The post has ${tags.length} tags. Only the first ${tg.max} are used.`));
    tags = tags.slice(0, tg.max);
  }

  const cover = typeof data.cover === "string" && data.cover.trim() ? data.cover.trim() : undefined;
  let coverAlt = typeof data.coverAlt === "string" ? data.coverAlt.trim() : "";
  if (cover && !coverAlt) {
    p.push(soft("coverAlt", "The cover photo has no description (alt text), so the title is used. Describe what the photo shows."));
    coverAlt = title;
  }

  let redirectTo: string | undefined;
  if (data.redirectTo !== undefined && data.redirectTo !== "") {
    if (typeof data.redirectTo === "string" && data.redirectTo.startsWith("/") && !data.redirectTo.startsWith("//")) {
      redirectTo = data.redirectTo;
    } else p.push(soft("redirectTo", "The redirect must be a path on lidr.io starting with /. It was ignored."));
  }

  let canonical: string | undefined;
  if (data.canonical !== undefined && data.canonical !== "") {
    if (typeof data.canonical === "string" && data.canonical.startsWith("https://")) canonical = data.canonical;
    else p.push(soft("canonical", "The canonical URL must start with https://. It was ignored."));
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
      draft: data.draft === true,
      redirectTo,
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
  const list = (doc as { tags?: unknown })?.tags;
  if (!Array.isArray(list)) return { tags, problems };
  for (const entry of list) {
    const e = entry as Partial<TagDef>;
    if (typeof e?.slug === "string" && RULES.slugPattern.test(e.slug) && typeof e.name === "string" && e.name.trim()) {
      tags.set(e.slug, { slug: e.slug, name: e.name.trim(), description: typeof e.description === "string" ? e.description.trim() : "" });
    } else {
      problems.push(soft("tags.yml", `A tag is missing a name or has an invalid slug (${JSON.stringify(entry)}). It was skipped.`));
    }
  }
  return { tags, problems };
}
