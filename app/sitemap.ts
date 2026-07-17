import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE = "https://lidr.io";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/about/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/features/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/pricing/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/contact-us/`, changeFrequency: "monthly", priority: 0.7 },
    {
      url: `${BASE}/privacy-policy/`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/gdpr-policy/`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/terms-of-service/`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/fair-use-policy/`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/complaints-policy/`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
