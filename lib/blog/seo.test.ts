import { expect, test } from "vitest";
import { BLOG_OG_IMAGE, blogOpenGraph, blogTwitter, RSS_URL } from "./seo";

test("RSS_URL is the absolute feed URL", () => {
  expect(RSS_URL).toBe("https://lidr.io/blog/rss.xml");
});

test("blogOpenGraph fills in the site defaults", () => {
  expect(blogOpenGraph({ title: "T", url: "https://lidr.io/blog/" })).toEqual({
    siteName: "Lidr.io",
    locale: "en_US",
    type: "website",
    images: [BLOG_OG_IMAGE],
    title: "T",
    url: "https://lidr.io/blog/",
  });
});

test("blogOpenGraph lets the page override defaults", () => {
  const img = { url: "https://lidr.io/x.png", width: 10, height: 10 };
  const og = blogOpenGraph({ type: "article", images: [img] }) as Record<string, unknown>;
  expect(og.type).toBe("article");
  expect(og.images).toEqual([img]);
  expect(og.siteName).toBe("Lidr.io");
});

test("blogTwitter defaults to the blog share image", () => {
  expect(blogTwitter("T", "D")).toEqual({ card: "summary_large_image", title: "T", description: "D", images: [BLOG_OG_IMAGE.url] });
  expect(blogTwitter("T", "D", "https://lidr.io/y.png").images).toEqual(["https://lidr.io/y.png"]);
});
