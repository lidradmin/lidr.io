import styles from "./BuiltForConfidence.module.css";
import {
  organizationIcon,
  planFasterIcon,
  integrationsIcon,
  collaborationIcon,
} from "./bfc-icons";

const CARDS = [
  {
    icon: organizationIcon,
    title: "Project Organization",
    text: "Keep photos, videos, and notes organized by project and stage.",
  },
  {
    icon: planFasterIcon,
    title: "Plan Faster",
    text: "Organize tasks and keep projects moving.",
  },
  {
    icon: integrationsIcon,
    title: "Integrations",
    text: "Connect seamlessly with your existing tools and platforms.",
  },
  {
    icon: collaborationIcon,
    title: "Collaboration",
    text: "Invite your team to join projects, share updates, and stay aligned.",
  },
];

/**
 * "Built for Confidence" dark card band, home-only.
 * Live source: capture/dom/home.html section#bfc-section (widget 8c76568).
 * Text verbatim.
 */
export function BuiltForConfidence() {
  return (
    <section className={styles.section} aria-labelledby="bfc-heading">
      <h2 id="bfc-heading" className={styles.title}>
        Built for Confidence
      </h2>
      <div className={styles.grid}>
        {CARDS.map((c) => (
          <div key={c.title} className={styles.card}>
            <div
              className={styles.iconWrap}
              aria-hidden="true"
              // Static trusted SVG copied verbatim from the live DOM.
              dangerouslySetInnerHTML={{ __html: c.icon }}
            />
            <h3 className={styles.cardTitle}>{c.title}</h3>
            <p className={styles.cardText}>{c.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
