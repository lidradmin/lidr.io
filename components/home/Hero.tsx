import styles from "./Hero.module.css";
import { captureIcon, annotateIcon, approveIcon } from "./hero-icons";

const FEATURES = [
  {
    icon: captureIcon,
    title: "Capture & Organize",
    text: "Take photos and auto-sort by project and date.",
  },
  {
    icon: annotateIcon,
    title: "Annotate & Add Details",
    text: "Mark up images and add quick notes.",
  },
  {
    icon: approveIcon,
    title: "Approve & Share",
    text: "Generate a PDF and share securely.",
  },
];

/**
 * Home hero ("Capture. Organise. Report. …"), home-only.
 * Live source: capture/dom/home.html #shoftgradient > .big__clipimage
 * (Elementor widget 5f00b6f). Text verbatim; layout/typography verified
 * against computed styles of the captured DOM at 1440/768/390.
 */
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.clip}>
        <div className={styles.content}>
          <h1 id="hero-heading" className={styles.title}>
            Capture. Organise. Report. Built for Photo Management
          </h1>
          <p className={styles.subtitle}>
            Turn everyday job site photos into secure, professional project
            records your team and clients can rely on.
          </p>
          <div className={styles.buttons}>
            <a href="/sign-up/" className={`${styles.btn} ${styles.btnPrimary}`}>
              Get Started
            </a>
            <a
              href="/features/"
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              Explore Features
            </a>
          </div>
          <div className={styles.features}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.card}>
                <div
                  className={styles.icon}
                  aria-hidden="true"
                  // Static trusted SVG copied verbatim from the live DOM
                  // (filter/gradient markup — see hero-icons.ts).
                  dangerouslySetInnerHTML={{ __html: f.icon }}
                />
                <p className={styles.cardTitle}>{f.title}</p>
                <p className={styles.cardDesc}>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.image}>
          <img
            src="/images/Group-198.webp"
            srcSet="/images/Group-198-half.webp 1481w, /images/Group-198.webp 2962w"
            sizes="(max-width: 801px) 85vw, 606px"
            width={2962}
            height={4320}
            alt="Hand holding a phone running the Lidr.io app"
            // Hero/LCP image — never lazy.
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  );
}
