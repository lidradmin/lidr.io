import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE = "https://lidr.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  return [
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
}
