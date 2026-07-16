import styles from "./FeaturesHero.module.css";

/**
 * Features hero ("Features That Empower Your Workflow"), features-page only.
 * Live source: capture/dom/features.html #shoftgradient > .mains__goodcontainer
 * (Elementor container 79e035f, shortcode widget ea68014). Text verbatim.
 * The live page renders the heading as an <h3> and has no h1 — rebuilt as
 * the page's h1 with identical computed styles.
 * Both CTAs link to the App Store on the live page — kept verbatim.
 */
export function FeaturesHero() {
  return (
    <section className={styles.hero} aria-labelledby="features-hero-heading">
      <div className={styles.container}>
        <div className={styles.row}>
          <div className={styles.colText}>
            <div className={styles.copy}>
              <h1 id="features-hero-heading" className={styles.title}>
                Features That Empower Your Workflow
              </h1>
              <p className={styles.lead}>
                Discover a suite of intuitive tools designed to simplify
                complexity and boost productivity.
              </p>
              <div className={styles.ctas}>
                <a
                  href="https://apps.apple.com/app/id6759912615"
                  className={styles.btn}
                >
                  Download Now
                </a>
                <a
                  href="https://apps.apple.com/app/id6759912615"
                  className={styles.btn}
                >
                  Contact Us
                </a>
              </div>
            </div>
          </div>
          <div className={styles.colImages}>
            <div className={styles.images}>
              {/* Hero/LCP images — never lazy. */}
              <img
                src="/images/feature1.webp"
                srcSet="/images/feature1-half.webp 868w, /images/feature1.webp 1735w"
                sizes="(max-width: 801px) 50vw, 302px"
                width={1735}
                height={2931}
                alt="Lidr.io app project gallery screen"
                fetchPriority="high"
              />
              <img
                src="/images/features2.webp"
                srcSet="/images/features2-half.webp 842w, /images/features2.webp 1684w"
                sizes="(max-width: 801px) 50vw, 302px"
                width={1684}
                height={2931}
                alt="Lidr.io app photo capture screen"
                fetchPriority="high"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
