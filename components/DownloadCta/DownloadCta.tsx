import styles from "./DownloadCta.module.css";
import { AppStoreBadges } from "../AppStoreBadges/AppStoreBadges";

/**
 * Bottom "Download The Lidr.io App" section with the laptop mockup
 * (shared: home + features pages). Live source: capture/dom/home.html
 * .othermains__classcontatent (Elementor widget 808938e). Text verbatim.
 */
export function DownloadCta() {
  return (
    <section className={styles.section} aria-labelledby="download-heading">
      <div className={styles.container}>
        <div className={styles.copy}>
          <div className={styles.copyInner}>
            <h2 id="download-heading" className={styles.heading}>
              Download The Lidr.io App
            </h2>
            <p className={styles.sub}>Transform Photo Documentation.</p>
            <p className={styles.offer}>Get 14 Day Free Trial.</p>
            <AppStoreBadges
              className={styles.badges}
              imgClassName={styles.badgeImg}
            />
          </div>
        </div>
        <div className={styles.image}>
          <img
            src="/images/lidrlaptop.webp"
            srcSet="/images/lidrlaptop-half.webp 1859w, /images/lidrlaptop.webp 3718w"
            sizes="(max-width: 801px) 100vw, 767px"
            width={3718}
            height={2514}
            alt="Laptop and phone running the Lidr.io dashboard"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
