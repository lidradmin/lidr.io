import Link from "next/link";
import { formatDate } from "../../lib/blog/format";
import type { BuiltPost } from "../../lib/blog/types";
import { BlogImage } from "./BlogImage";
import styles from "./Blog.module.css";

type Props = { post: BuiltPost; variant?: "card" | "featured"; headingLevel?: "h2" | "h3" };

const CARD_SIZES = "(min-width: 1024px) 380px, (min-width: 640px) 45vw, 90vw";
const FEATURED_SIZES = "(min-width: 1024px) 620px, 90vw";

export function PostCard({ post, variant = "card", headingLevel = "h2" }: Props) {
  const Heading = headingLevel;
  const featured = variant === "featured";
  return (
    <article className={featured ? styles.featured : styles.card}>
      <Link href={`/blog/${post.slug}/`} className={styles.cardLink}>
        {post.cover ? (
          <BlogImage image={post.cover} sizes={featured ? FEATURED_SIZES : CARD_SIZES} className={styles.cardMedia} eager={featured} />
        ) : (
          <div className={`${styles.cardMedia} ${styles.cardFallback}`} aria-hidden="true">
            <span>{post.title}</span>
          </div>
        )}
        <div className={styles.cardBody}>
          <Heading className={styles.cardTitle}>{post.title}</Heading>
          {featured && <p className={styles.cardDescription}>{post.description}</p>}
          <p className={styles.meta}>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>{post.readingMinutes} min read</span>
          </p>
        </div>
      </Link>
    </article>
  );
}
