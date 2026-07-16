import styles from "./DownloadCta.module.css";
import { AppStoreBadges } from "../AppStoreBadges/AppStoreBadges";
import type { RevealMode } from "../Reveal/RevealManager";

/** Per-block reveal modes for the five revealable blocks in this section. */
export type DownloadCtaReveal = {
  heading?: RevealMode;
  sub?: RevealMode;
  offer?: RevealMode;
  badges?: RevealMode;
  image?: RevealMode;
};

/**
 * On HOME, all five blocks re-arm their AOS reveal after load at every
 * breakpoint — the reference captures show them blurred-out until scrolled
 * into view (see RevealManager). Other pages pass their own measured set
 * (the whole object replaces this default; omitted keys = no reveal).
 */
const HOME_REVEAL: DownloadCtaReveal = {
  heading: "always",
  sub: "always",
  offer: "always",
  badges: "always",
  image: "always",
};

/**
 * Bottom "Download The Lidr.io App" section with the laptop mockup
 * (shared: home + features pages). Live source: capture/dom/home.html
 * .othermains__classcontatent (Elementor widget 808938e). Text verbatim.
 */
export function DownloadCta({
  reveal = HOME_REVEAL,
}: {
  reveal?: DownloadCtaReveal;
} = {}) {
  return (
    <section className={styles.section} aria-labelledby="download-heading">
      <div className={styles.container}>
        <div className={styles.copy}>
          <div className={styles.copyInner}>
            <h2
              id="download-heading"
              className={styles.heading}
              data-reveal={reveal.heading}
            >
              Download The Lidr.io App
            </h2>
            <p className={styles.sub} data-reveal={reveal.sub}>
              Transform Photo Documentation.
            </p>
            <p className={styles.offer} data-reveal={reveal.offer}>
              Get 14 Day Free Trial.
            </p>
            <AppStoreBadges
              className={styles.badges}
              imgClassName={styles.badgeImg}
              reveal={reveal.badges}
            />
          </div>
        </div>
        <div className={styles.image} data-reveal={reveal.image}>
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
