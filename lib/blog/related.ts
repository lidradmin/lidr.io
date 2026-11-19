type Relatable = { slug: string; date: string; tags: string[] };

/** For each post: up to 3 other posts sharing ≥1 tag, most shared first, then newest. */
export function computeRelated(posts: Relatable[], limit = 3): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const post of posts) {
    const own = new Set(post.tags);
    const scored = posts
      .filter((o) => o.slug !== post.slug)
      .map((o) => ({ o, shared: o.tags.filter((t) => own.has(t)).length }))
      .filter((s) => s.shared > 0)
      .sort((a, b) => b.shared - a.shared || b.o.date.localeCompare(a.o.date) || a.o.slug.localeCompare(b.o.slug));
    out.set(post.slug, scored.slice(0, limit).map((s) => s.o.slug));
  }
  return out;
}
