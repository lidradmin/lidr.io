import styles from "./QrCta.module.css";
import { AppStoreBadges } from "../AppStoreBadges/AppStoreBadges";

/**
 * Dark "Download The Lidr.io App" band with the scan-to-download phone
 * collage, home-only. Live source: capture/dom/home.html
 * section#lidr-download-section (Elementor widget f3dfde5). Text verbatim.
 */
export function QrCta() {
  return (
    <section className={styles.section} aria-labelledby="qr-cta-heading">
      <div className={styles.wrapper}>
        <div className={styles.banners} data-reveal="always" data-reveal-delay="50">
          <img
            src="/images/scantodownload.webp"
            srcSet="/images/scantodownload-half.webp 1268w, /images/scantodownload.webp 2536w"
            sizes="(max-width: 801px) 50vw, 450px"
            width={2536}
            height={2888}
            alt="Lidr.io app screens with a scan-to-download QR code"
          />
        </div>
        <div className={styles.content}>
          <h2 id="qr-cta-heading" className={styles.heading} data-reveal="always" data-reveal-delay="50">
            Download The Lidr.io App
          </h2>
          <p className={styles.sub} data-reveal="always" data-reveal-delay="100">Transform Photo Documentation.</p>
          <p className={styles.offer} data-reveal="always" data-reveal-delay="120">Get 14 Day Free Trial.</p>
          <AppStoreBadges
            className={styles.badges}
            imgClassName={styles.badgeImg}
          />
        </div>
      </div>
    </section>
  );
}
