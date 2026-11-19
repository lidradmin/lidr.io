import type { MetadataRoute } from "next";
import { getPosts, getTags } from "../lib/blog/data";

export const dynamic = "force-static";

const BASE = "https://lidr.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const posts = getPosts();
  const blog: MetadataRoute.Sitemap = posts.length
    ? [
        { url: `${BASE}/blog/`, lastModified: posts[0].updated ?? posts[0].date, changeFrequency: "weekly", priority: 0.7 },
        ...posts.map((p) => ({
          url: `${BASE}/blog/${p.slug}/`,
          lastModified: p.updated ?? p.date,
          changeFrequency: "monthly" as const,
          priority: 0.6,
        })),
        ...getTags().map((t) => ({ url: `${BASE}/blog/tag/${t.slug}/`, changeFrequency: "weekly" as const, priority: 0.4 })),
      ]
    : [];

  const core: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/about/`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/features/`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/pricing/`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/contact-us/`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    {
      url: `${BASE}/privacy-policy/`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/gdpr-policy/`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/terms-of-service/`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/fair-use-policy/`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/complaints-policy/`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  return core.concat(blog);
}
