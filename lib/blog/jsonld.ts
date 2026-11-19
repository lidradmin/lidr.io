import type { BuiltPost } from "./types";

export const SITE = "https://lidr.io";
export const LOGO_URL = `${SITE}/favicon-270x270.png`;
const ORG = { "@type": "Organization", name: "Lidr.io", url: SITE } as const;

export const postUrl = (slug: string) => `${SITE}/blog/${slug}/`;
export const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE}${path}`);

export function blogPostingJsonLd(post: BuiltPost) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: absolute(post.ogImage),
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    author: ORG,
    publisher: { ...ORG, logo: { "@type": "ImageObject", url: LOGO_URL } },
    mainEntityOfPage: { "@type": "WebPage", "@id": post.canonical ?? postUrl(post.slug) },
  };
}

export function breadcrumbJsonLd(post: BuiltPost, tag?: { slug: string; name: string }) {
  const items = [
    { name: "Blog", item: `${SITE}/blog/` },
    ...(tag ? [{ name: tag.name, item: `${SITE}/blog/tag/${tag.slug}/` }] : []),
    { name: post.title, item: postUrl(post.slug) },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, ...it })),
  };
}
