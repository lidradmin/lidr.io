import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "../../../../components/blog/BlogIndex";
import { getPosts, getTags, paramsOrPlaceholder, PLACEHOLDER } from "../../../../lib/blog/data";
import { pageCount, pageSlice } from "../../../../lib/blog/paginate";

type Props = { params: Promise<{ n: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  const total = pageCount(getPosts().length);
  return paramsOrPlaceholder("n", Array.from({ length: Math.max(0, total - 1) }, (_, i) => String(i + 2)));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { n } = await params;
  if (n === PLACEHOLDER) return {};
  const url = `https://lidr.io/blog/page/${n}/`;
  return { title: `Blog: Page ${n}`, alternates: { canonical: url }, openGraph: { url, siteName: "Lidr.io" } };
}

export default async function BlogPageN({ params }: Props) {
  const { n } = await params;
  if (n === PLACEHOLDER) notFound();
  const page = Number(n);
  const posts = getPosts();
  return (
    <BlogIndex
      heading="Blog"
      intro={`Page ${page} of our guides for site teams.`}
      tags={getTags()}
      posts={pageSlice(posts, page).items}
      page={page}
      totalPages={pageCount(posts.length)}
    />
  );
}
