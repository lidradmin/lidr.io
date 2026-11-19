/** A problem found in a post. "hard" = the post can't be published as-is. */
export type Problem = {
  level: "hard" | "soft";
  field: string;
  message: string;
  /** Raw technical detail (e.g. parser message), not shown to authors by default. */
  detail?: string;
};

export type TagDef = { slug: string; name: string; description: string };

/** Validated front-matter. */
export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  updated?: string; // YYYY-MM-DD
  tags: string[]; // tag slugs, all known
  cover?: string; // e.g. /images/blog/<slug>/cover.jpg
  coverAlt?: string;
  draft: boolean;
  redirectTo?: string;
  canonical?: string;
};

export type ImageRef = {
  src: string; // JPEG fallback, 1600w max
  srcset: string; // WebP srcset
  width: number;
  height: number;
  alt: string;
};

export type BuiltPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags: string[];
  cover?: ImageRef;
  html: string;
  readingMinutes: number;
  related: string[]; // slugs
  canonical?: string;
  ogImage: string; // site-relative path
  source: "current" | "last-good";
};

export type TagPage = TagDef & { count: number };

export type BlogData = {
  enabled: boolean;
  posts: BuiltPost[]; // newest first
  tags: TagPage[]; // only tags with count > 0
  redirects: { from: string; to: string }[];
};

/** Problems per post slug ("_tags" / "_content" for non-post issues). */
export type BlogReport = { problems: Record<string, Problem[]> };

export const EMPTY_BLOG: BlogData = {
  enabled: false,
  posts: [],
  tags: [],
  redirects: [],
};
