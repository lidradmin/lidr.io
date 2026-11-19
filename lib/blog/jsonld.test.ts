import { expect, test } from "vitest";
import { blogPostingJsonLd, breadcrumbJsonLd } from "./jsonld";
import type { BuiltPost } from "./types";

const post: BuiltPost = {
  slug: "p", title: "T", description: "D", date: "2026-11-10", updated: "2026-11-15", tags: ["reporting"],
  html: "", readingMinutes: 1, related: [], ogImage: "/images/blog/_og/p.png", source: "current",
};

test("BlogPosting uses absolute URLs and the organisation as author", () => {
  expect(blogPostingJsonLd(post)).toEqual({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: "T",
    description: "D",
    image: "https://lidr.io/images/blog/_og/p.png",
    datePublished: "2026-11-10",
    dateModified: "2026-11-15",
    author: { "@type": "Organization", name: "Lidr.io", url: "https://lidr.io" },
    publisher: { "@type": "Organization", name: "Lidr.io", url: "https://lidr.io", logo: { "@type": "ImageObject", url: "https://lidr.io/favicon-270x270.png" } },
    mainEntityOfPage: { "@type": "WebPage", "@id": "https://lidr.io/blog/p/" },
  });
});

test("breadcrumb: Blog > Tag > Post", () => {
  const b = breadcrumbJsonLd(post, { slug: "reporting", name: "Reporting" });
  expect(b.itemListElement.map((i: { name: string }) => i.name)).toEqual(["Blog", "Reporting", "T"]);
});

test("canonical overrides the page URL", () => {
  const j = blogPostingJsonLd({ ...post, canonical: "https://example.com/orig" });
  expect(j.mainEntityOfPage).toEqual({ "@type": "WebPage", "@id": "https://example.com/orig" });
});

test("dateModified falls back to date", () => {
  expect(blogPostingJsonLd({ ...post, updated: undefined }).dateModified).toBe("2026-11-10");
});

test("absolute image URLs pass through", () => {
  expect(blogPostingJsonLd({ ...post, ogImage: "https://cdn.example.com/x.png" }).image).toBe("https://cdn.example.com/x.png");
});

test("breadcrumb without a tag has 2 items with positions and URLs", () => {
  const b = breadcrumbJsonLd(post);
  expect(b.itemListElement).toEqual([
    { "@type": "ListItem", position: 1, name: "Blog", item: "https://lidr.io/blog/" },
    { "@type": "ListItem", position: 2, name: "T", item: "https://lidr.io/blog/p/" },
  ]);
});
