import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BlogData, BuiltPost, TagPage } from "./types";

/** Param used when a dynamic route has nothing to build; removed by scripts/blog/finalize.ts. */
export const PLACEHOLDER = "__empty";

let cache: BlogData | null = null;

/** Reads the output of `npm run blog:prepare`. Fails loudly if prepare didn't run. */
export function getBlogData(): BlogData {
  if (cache) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), ".blog/data.json"), "utf8")) as BlogData;
  } catch {
    throw new Error(".blog/data.json is missing. Run `npm run build` (not `next build`) so `npm run blog:prepare` runs first.");
  }
  return cache;
}

export const getPosts = (): BuiltPost[] => getBlogData().posts;
export const hasPosts = (): boolean => getPosts().length > 0;
export const getPost = (slug: string): BuiltPost | undefined => getPosts().find((p) => p.slug === slug);
export const getTags = (): TagPage[] => getBlogData().tags;
export const getTag = (slug: string): TagPage | undefined => getTags().find((t) => t.slug === slug);
export const postsForTag = (slug: string): BuiltPost[] => getPosts().filter((p) => p.tags.includes(slug));

/** generateStaticParams helper: never return [] (fails under output: export). */
export function paramsOrPlaceholder<K extends string>(key: K, values: string[]): Record<K, string>[] {
  const list = values.length ? values : [PLACEHOLDER];
  return list.map((v) => ({ [key]: v }) as Record<K, string>);
}
