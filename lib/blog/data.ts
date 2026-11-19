import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BlogData, BuiltPost, RetiredPost, TagPage } from "./types";

/** Param used when a dynamic route has nothing to build; removed by scripts/blog/finalize.ts. */
export const PLACEHOLDER = "__empty";

// Cached per process; in `next dev` a rebuilt data.json needs a server restart.
let cache: BlogData | null = null;

/** Reads the output of `npm run blog:prepare`. Fails loudly if prepare didn't run. */
export function getBlogData(): BlogData {
  if (cache) return cache;
  try {
    // process.cwd() is the project root for `next build`/`next dev`.
    cache = JSON.parse(readFileSync(join(process.cwd(), ".blog/data.json"), "utf8")) as BlogData;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(".blog/data.json is missing. Run `npm run build` (not `next build`) so `npm run blog:prepare` runs first.");
    }
    throw new Error("Failed to read or parse .blog/data.json", { cause: err });
  }
  return cache;
}

export const getPosts = (): BuiltPost[] => getBlogData().posts;
export const hasPosts = (): boolean => getPosts().length > 0;
export const getPost = (slug: string): BuiltPost | undefined => getPosts().find((p) => p.slug === slug);
export const getTags = (): TagPage[] => getBlogData().tags;
export const getTag = (slug: string): TagPage | undefined => getTags().find((t) => t.slug === slug);
/** Retired slugs (never a live post's). Data from before `retired` existed has none. */
const retired = (): RetiredPost[] => (getBlogData().retired ?? []).filter((r) => !getPost(r.slug));
export const getRetired = (slug: string): RetiredPost | undefined => retired().find((r) => r.slug === slug);
export const getRetiredSlugs = (): string[] => retired().map((r) => r.slug);
export const postsForTag = (slug: string): BuiltPost[] => getPosts().filter((p) => p.tags.includes(slug));

/** generateStaticParams helper: never return [] (fails under output: export). */
export function paramsOrPlaceholder<K extends string>(key: K, values: string[]): Record<K, string>[] {
  const list = values.length ? values : [PLACEHOLDER];
  return list.map((v) => ({ [key]: v }) as Record<K, string>);
}
