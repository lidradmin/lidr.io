import type { Metadata } from "next";
import { BlogIndex } from "../../components/blog/BlogIndex";
import { getPosts, getTags, hasPosts } from "../../lib/blog/data";
import { pageCount, pageSlice } from "../../lib/blog/paginate";
import { blogOpenGraph, blogTwitter, RSS_URL } from "../../lib/blog/seo";

const TITLE = "Blog: Site Photo and Reporting Guides";
const DESCRIPTION = "Practical guides for construction teams on capturing, organising and reporting site photos.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "https://lidr.io/blog/",
    types: { "application/rss+xml": RSS_URL },
  },
  openGraph: blogOpenGraph({ title: TITLE, description: DESCRIPTION, url: "https://lidr.io/blog/" }),
  twitter: blogTwitter(TITLE, DESCRIPTION),
  // An empty blog shouldn't be indexed.
  robots: hasPosts() ? undefined : { index: false, follow: true },
};

export default function BlogPage() {
  const posts = getPosts();
  const { featured, items } = pageSlice(posts, 1);
  return (
    <BlogIndex
      heading="Blog"
      intro="Guides for site teams on photo records and reporting."
      tags={getTags()}
      featured={featured}
      posts={items}
      page={1}
      totalPages={pageCount(posts.length)}
    />
  );
}
