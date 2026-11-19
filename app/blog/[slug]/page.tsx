import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostArticle } from "../../../components/blog/PostArticle";
import { getPost, getPosts, getTag, getTags, paramsOrPlaceholder, PLACEHOLDER } from "../../../lib/blog/data";
import { absolute, blogPostingJsonLd, breadcrumbJsonLd, postUrl } from "../../../lib/blog/jsonld";
import { blogOpenGraph, blogTwitter, RSS_URL, SITE_FALLBACK_IMAGE } from "../../../lib/blog/seo";
import type { BuiltPost } from "../../../lib/blog/types";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return paramsOrPlaceholder("slug", getPosts().map((p) => p.slug));
}

/** ogImage is the cover (its own size), a generated 1200x630 card, or the site fallback image. */
function shareImage(post: BuiltPost) {
  const url = absolute(post.ogImage);
  const alt = post.cover?.alt || post.title;
  if (post.cover && post.ogImage === post.cover.src) return { url, width: post.cover.width, height: post.cover.height, alt };
  if (post.ogImage.startsWith("/images/blog/_og/")) return { url, width: 1200, height: 630, alt };
  if (url === SITE_FALLBACK_IMAGE.url) return { ...SITE_FALLBACK_IMAGE, alt };
  return { url, alt };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = post.canonical ?? postUrl(post.slug);
  const image = shareImage(post);
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url, types: { "application/rss+xml": RSS_URL } },
    openGraph: blogOpenGraph({
      type: "article",
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      tags: post.tags,
      images: [image],
    }),
    twitter: blogTwitter(post.title, post.description, image.url),
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  if (slug === PLACEHOLDER) notFound();
  const post = getPost(slug);
  if (!post) notFound();
  const related = post.related.map((s) => getPost(s)).filter((p): p is BuiltPost => !!p);
  const primaryTag = post.tags[0] ? getTag(post.tags[0]) : undefined;
  const jsonLd = [blogPostingJsonLd(post), breadcrumbJsonLd(post, primaryTag)];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PostArticle post={post} tags={getTags()} related={related} />
    </>
  );
}
