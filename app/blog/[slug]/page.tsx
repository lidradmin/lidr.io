import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostArticle } from "../../../components/blog/PostArticle";
import styles from "../../../components/blog/Post.module.css";
import { getPost, getPosts, getRetired, getRetiredSlugs, getTag, getTags, paramsOrPlaceholder, PLACEHOLDER } from "../../../lib/blog/data";
import { absolute, blogPostingJsonLd, breadcrumbJsonLd, postUrl } from "../../../lib/blog/jsonld";
import { blogOpenGraph, blogTwitter, RSS_URL } from "../../../lib/blog/seo";
import type { BuiltPost, RetiredPost } from "../../../lib/blog/types";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  // Retired slugs keep a page: once live, a post's file must never disappear from
  // the deployment, or the CDN keeps serving the old copy.
  return paramsOrPlaceholder("slug", [...getPosts().map((p) => p.slug), ...getRetiredSlugs()]);
}

/** ogImage is the cover (its own size) or a generated 1200x630 card (per-post, or the generic blog card as fallback). */
function shareImage(post: BuiltPost) {
  const url = absolute(post.ogImage);
  const alt = post.cover?.alt || post.title;
  if (post.cover && post.ogImage === post.cover.src) return { url, width: post.cover.width, height: post.cover.height, alt };
  if (post.ogImage.startsWith("/images/blog/_og/")) return { url, width: 1200, height: 630, alt };
  return { url, alt };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) {
    const retired = getRetired(slug);
    if (!retired) return {};
    return {
      title: retired.redirectTo ? "This post has moved" : "This post is no longer available",
      robots: { index: false, follow: true },
      ...(retired.redirectTo ? { alternates: { canonical: absolute(retired.redirectTo) } } : {}),
    };
  }
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
  if (!post) {
    const retired = getRetired(slug);
    if (retired) return <RetiredArticle retired={retired} />;
    notFound();
  }
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

function RetiredArticle({ retired }: { retired: RetiredPost }) {
  const to = retired.redirectTo;
  return (
    <article className={styles.article}>
      {to && <meta httpEquiv="refresh" content={`0;url=${to}`} />}
      <h1 className={styles.title}>This post is no longer available</h1>
      <div className={styles.bar} aria-hidden="true" />
      {to ? (
        <p>
          This post has moved. <Link href={to}>Go to the new page</Link>
        </p>
      ) : (
        <p>
          It may have been removed or replaced. <Link href="/blog/">Back to the blog</Link>
        </p>
      )}
    </article>
  );
}
