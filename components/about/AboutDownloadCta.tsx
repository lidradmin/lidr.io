import styles from "./AboutDownloadCta.module.css";
import { AppStoreBadges } from "../AppStoreBadges/AppStoreBadges";

/**
 * About-page inline Download CTA — the gray card variant.
 * Live source: capture/dom/about.html section#lidr-download-sections
 * (a different component from the shared DownloadCta which has the laptop image).
 *
 * Live CSS (inline on the shortcode):
 *   .lidr-download-inner { max-width:98%; margin:auto; background:#F5F5F5;
 *                            padding:30px; border-radius:15px;
 *                            margin-top:50px; margin-bottom:30px;
 *                            display:flex; align-items:center }
 *   #lidr-download-copy { width:70% }
 *   h2.lidr-download-kicker { font-weight:normal; font-size:39px;
 *                               border-bottom:1px solid #dbdbdb;
 *                               width:fit-content; padding-bottom:5px;
 *                               margin-bottom:10px }
 *   p.lidr-download-tagline { font-size:16px; margin-bottom:7px }
 *   p.lidr-download-cta-text { margin-bottom:0; font-weight:700 }
 *   .lidr-download-buttons { display:flex; max-width:370px; margin:unset }
 *   .lidr-download-buttons a { display:block; margin:0 5px }
 * Text verbatim.
 */
export function AboutDownloadCta() {
  return (
    <section
      id="lidr-download-sections"
      aria-label="Download the Lidr.io app"
      className={styles.section}
    >
      <div className={styles.inner}>
        <div className={styles.copy}>
          <h2 className={styles.heading}>Download The Lidr.io App</h2>
          <p className={styles.tagline}>Transform Photo Documentation.</p>
          <p className={styles.cta}>Get 14 Day Free Trial.</p>
        </div>
        <AppStoreBadges
          className={styles.badges}
          imgClassName={styles.badgeImg}
        />
      </div>
    </section>
  );
}
