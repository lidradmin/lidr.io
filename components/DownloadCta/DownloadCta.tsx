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
            {/* data-reveal: on the live site these five blocks are the ones
                whose AOS reveal re-arms after load at every breakpoint —
                the reference captures show them blurred-out until scrolled
                into view (see RevealManager). */}
            <h2
              id="download-heading"
              className={styles.heading}
              data-reveal="always"
            >
              Download The Lidr.io App
            </h2>
            <p className={styles.sub} data-reveal="always">
              Transform Photo Documentation.
            </p>
            <p className={styles.offer} data-reveal="always">
              Get 14 Day Free Trial.
            </p>
            <AppStoreBadges
              className={styles.badges}
              imgClassName={styles.badgeImg}
              reveal="always"
            />
          </div>
        </div>
        <div className={styles.image} data-reveal="always">
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
