import styles from "./EverythingGrid.module.css";
import {
  disputesIcon,
  timeSavingsIcon,
  transparencyIcon,
  complianceIcon,
  accountabilityIcon,
  standardsIcon,
} from "./everything-icons";

const CARDS = [
  {
    icon: disputesIcon,
    title: "Reduced Disputes",
    text: "Helps resolve variations, delays, and payment claims with confidence.",
  },
  {
    icon: timeSavingsIcon,
    title: "Time Savings",
    text: "Cut hours of manual report writing with automated, structured documentation.",
  },
  {
    icon: transparencyIcon,
    title: "Client Transparency",
    text: "Give clients clear, professional updates that build trust and reduce follow-up.",
  },
  {
    icon: complianceIcon,
    title: "Compliance Readiness",
    text: "Keep records organized and accessible for internal reviews & regulatory checks.",
  },
  {
    icon: accountabilityIcon,
    title: "Stronger Accountability",
    text: "Track who captured, reviewed, and approved each record to improve responsibility.",
  },
  {
    icon: standardsIcon,
    title: "Consistent Standards",
    text: "Ensure every site follows the same documentation process for repeatable results.",
  },
];

/**
 * "Everything Your Project Needs, In One Place" six-card benefit grid,
 * features-page only. Live source: capture/dom/features.html
 * .bigmains__min23 (same shortcode widget 2eba7e0 as the sticky stack —
 * the page composes them back to back with no section gap). Text verbatim.
 */
export function EverythingGrid() {
  return (
    <section className={styles.section} aria-labelledby="everything-heading">
      <h2 id="everything-heading" className={styles.heading} data-reveal="always" data-reveal-delay="10">
        Everything Your Project Needs, In One Place
      </h2>
      <div className={styles.grid}>
        {CARDS.map((c, i) => (
          <div key={c.title} className={styles.col} data-reveal="always" data-reveal-delay={10 + i * 50}>
            <div className={styles.card}>
              <div
                className={styles.icon}
                aria-hidden="true"
                // Static trusted SVG copied verbatim from the live DOM.
                dangerouslySetInnerHTML={{ __html: c.icon }}
              />
              <h3 className={styles.cardTitle}>{c.title}</h3>
              <p className={styles.cardText}>{c.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
