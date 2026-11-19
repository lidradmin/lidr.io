import Link from "next/link";
import { formatDate } from "../../lib/blog/format";
import type { BuiltPost, TagPage } from "../../lib/blog/types";
import { AppStoreBadges } from "../AppStoreBadges/AppStoreBadges";
import prose from "../Prose/Prose.module.css";
import { BlogImage } from "./BlogImage";
import { PostCard } from "./PostCard";
import styles from "./Post.module.css";

type Props = { post: BuiltPost; tags: TagPage[]; related: BuiltPost[] };

export function PostArticle({ post, tags, related }: Props) {
  const postTags = post.tags.map((s) => tags.find((t) => t.slug === s)).filter((t): t is TagPage => !!t);
  const primary = postTags[0];
  return (
    <>
      <article className={styles.article}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <ol>
            <li><Link href="/blog/">Blog</Link></li>
            {primary && <li><Link href={`/blog/tag/${primary.slug}/`}>{primary.name}</Link></li>}
          </ol>
        </nav>
        <header className={styles.header}>
          <h1 className={styles.title}>{post.title}</h1>
          <div className={styles.bar} aria-hidden="true" />
          <div className={styles.meta}>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            {post.updated && (
              <span>
                Updated <time dateTime={post.updated}>{formatDate(post.updated)}</time>
              </span>
            )}
            <span>{post.readingMinutes} min read</span>
            {postTags.length > 0 && (
              <ul className={styles.tags} aria-label="Topics">
                {postTags.map((t) => (
                  <li key={t.slug}><Link href={`/blog/tag/${t.slug}/`}>{t.name}</Link></li>
                ))}
              </ul>
            )}
          </div>
        </header>
        {post.cover && <BlogImage image={post.cover} sizes="(min-width: 760px) 728px, 100vw" className={styles.cover} eager priority />}
        <div className={`${prose.prose} ${prose.rich}`} dangerouslySetInnerHTML={{ __html: post.html }} />
        <aside className={styles.cta} aria-label="Get the app">
          <p className={styles.ctaTitle}>Try Lidr on your next site</p>
          <p>Capture, organise and report on site photos from your phone.</p>
          <AppStoreBadges className={styles.ctaBadges} />
        </aside>
      </article>
      {related.length > 0 && primary && (
        <section className={styles.related} aria-labelledby="related-heading">
          <h2 id="related-heading" className={styles.relatedHeading}>More on {primary.name.toLowerCase()}</h2>
          <div className={styles.relatedGrid}>
            {related.map((p) => <PostCard
                key={p.slug}
                post={p}
                headingLevel="h3"
                tagName={p.tags[0] ? tags.find((t) => t.slug === p.tags[0])?.name : undefined}
              />)}
          </div>
        </section>
      )}
    </>
  );
}
