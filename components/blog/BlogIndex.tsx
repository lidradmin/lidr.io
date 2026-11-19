import Link from "next/link";
import type { BuiltPost, TagPage } from "../../lib/blog/types";
import { DownloadCta } from "../DownloadCta/DownloadCta";
import { PostCard } from "./PostCard";
import styles from "./Blog.module.css";

type Props = {
  heading: string;
  intro: string;
  tags: TagPage[];
  activeTag?: string;
  featured?: BuiltPost;
  posts: BuiltPost[];
  page?: number;
  totalPages?: number;
};

const pageHref = (n: number) => (n === 1 ? "/blog/" : `/blog/page/${n}/`);

export function BlogIndex({ heading, intro, tags, activeTag, featured, posts, page = 1, totalPages = 1 }: Props) {
  const empty = !featured && posts.length === 0;
  return (
    <>
      <div className={styles.container}>
        <header className={styles.intro}>
          <h1 className={styles.heading}>{heading}</h1>
          <p className={styles.lead}>{intro}</p>
        </header>

        {tags.length > 0 && (
          <nav aria-label="Blog topics">
            <ul className={styles.chips}>
              <li>
                <Link href="/blog/" className={styles.chip} aria-current={!activeTag ? "page" : undefined}>
                  All
                </Link>
              </li>
              {tags.map((t) => (
                <li key={t.slug}>
                  <Link href={`/blog/tag/${t.slug}/`} className={styles.chip} aria-current={activeTag === t.slug ? "page" : undefined}>
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {empty ? (
          <p className={styles.empty}>No posts yet. Check back soon.</p>
        ) : (
          <>
            {featured && <PostCard post={featured} variant="featured" />}
            <div className={styles.grid}>
              {posts.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </>
        )}

        {totalPages > 1 && (
          <nav className={styles.pagination} aria-label="Pagination">
            {page > 1 ? <Link href={pageHref(page - 1)} rel="prev">Newer posts</Link> : <span />}
            <span>
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? <Link href={pageHref(page + 1)} rel="next">Older posts</Link> : <span />}
          </nav>
        )}
      </div>
      {/* reveal={{}} disables scroll-reveal: blog pages don't mount RevealManager */}
      <DownloadCta reveal={{}} />
    </>
  );
}
