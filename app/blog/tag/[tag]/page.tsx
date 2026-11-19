import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "../../../../components/blog/BlogIndex";
import { getTag, getTags, paramsOrPlaceholder, PLACEHOLDER, postsForTag } from "../../../../lib/blog/data";

type Props = { params: Promise<{ tag: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return paramsOrPlaceholder("tag", getTags().map((t) => t.slug));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const t = getTag(tag);
  if (!t) return {};
  const url = `https://lidr.io/blog/tag/${t.slug}/`;
  const description = t.description || `Lidr blog posts about ${t.name.toLowerCase()}.`;
  return { title: `${t.name}: Blog`, description, alternates: { canonical: url }, openGraph: { title: t.name, description, url, siteName: "Lidr.io" } };
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  if (tag === PLACEHOLDER) notFound();
  const t = getTag(tag);
  if (!t) notFound();
  return (
    <BlogIndex
      heading={t.name}
      intro={t.description || `Posts about ${t.name.toLowerCase()}.`}
      tags={getTags()}
      activeTag={t.slug}
      posts={postsForTag(t.slug)}
    />
  );
}
