import styles from "./PricingCards.module.css";
import { PricingCardList } from "./PricingCardList";

/**
 * "Clear Pricing" section (shared: home + pricing pages).
 * Live source: capture/dom/home.html .pricing__modals (widget a14d1eb).
 * Text verbatim.
 */
export function PricingCards() {
  return (
    <section className={styles.section} aria-labelledby="pricing-heading">
      <div className={styles.intro}>
        <h2 id="pricing-heading" className={styles.introTitle}>
          Clear Pricing. Built for Construction Teams.
        </h2>
        <p className={styles.introText}>
          Simple, transparent plans designed to scale from single projects to
          enterprise operations — no hidden fees or long-term contracts.
        </p>
      </div>
      <PricingCardList />
    </section>
  );
}
