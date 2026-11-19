import Link from "next/link";
import { formatDate } from "../../lib/blog/format";
import type { BuiltPost } from "../../lib/blog/types";
import { BlogImage } from "./BlogImage";
import styles from "./Blog.module.css";

type Props = {
  post: BuiltPost;
  variant?: "card" | "featured";
  headingLevel?: "h2" | "h3";
  /** Load the cover immediately (above-the-fold cards). Featured cards are always eager + high priority. */
  eager?: boolean;
  /** Primary topic name, shown on the no-cover fallback block. */
  tagName?: string;
};

const CARD_SIZES = "(min-width: 1024px) 400px, (min-width: 640px) 45vw, 90vw";
const FEATURED_SIZES = "(min-width: 1024px) 620px, (min-width: 900px) 48vw, 90vw";

/**
 * Card with a single link on the title; `.cardLink::after` stretches it over
 * the whole card so the card is clickable while the accessible name stays
 * just the title.
 */
export function PostCard({ post, variant = "card", headingLevel = "h2", eager, tagName }: Props) {
  const Heading = headingLevel;
  const featured = variant === "featured";
  return (
    <article className={featured ? `${styles.card} ${styles.featured}` : styles.card}>
      {post.cover ? (
        <BlogImage
          image={post.cover}
          sizes={featured ? FEATURED_SIZES : CARD_SIZES}
          className={styles.cardMedia}
          eager={featured || eager}
          priority={featured}
          decorative
        />
      ) : (
        <div className={`${styles.cardMedia} ${styles.cardFallback}`} aria-hidden="true">
          <span className={styles.cardFallbackBar} />
          <span>{tagName ?? "Lidr.io"}</span>
        </div>
      )}
      <div className={styles.cardBody}>
        <Heading className={styles.cardTitle}>
          <Link href={`/blog/${post.slug}/`} className={styles.cardLink}>
            {post.title}
          </Link>
        </Heading>
        {featured && <p className={styles.cardDescription}>{post.description}</p>}
        <p className={styles.meta}>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>{post.readingMinutes} min read</span>
        </p>
      </div>
    </article>
  );
}
