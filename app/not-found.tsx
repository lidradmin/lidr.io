import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Page not found</h1>
      <p className={styles.text}>
        The page you are looking for doesn&rsquo;t exist or has been moved.
      </p>
      <Link href="/" className={styles.link}>
        Go back home
      </Link>
    </div>
  );
}
