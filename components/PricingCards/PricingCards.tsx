import styles from "./PricingCards.module.css";
import { PricingCardList } from "./PricingCardList";
import type { RevealMode } from "../Reveal/RevealManager";

/**
 * "Clear Pricing" section (shared: home + pricing pages).
 * Live source: capture/dom/home.html .pricing__modals (widget a14d1eb).
 * Text verbatim.
 *
 * `intro` defaults to the home page's paragraph; the pricing page renders
 * the heading WITHOUT it (capture/dom/pricing.html has no "Simple,
 * transparent plans…" copy), so it passes `intro={null}`.
 * `cardReveal` forwards a page-measured per-card reveal set to
 * PricingCardList (default = home's set, see that file).
 */
export function PricingCards({
  intro = (
    <p className={styles.introText}>
      Simple, transparent plans designed to scale from single projects to
      enterprise operations — no hidden fees or long-term contracts.
    </p>
  ),
  cardReveal,
}: {
  intro?: React.ReactNode;
  cardReveal?: (RevealMode | undefined)[];
} = {}) {
  return (
    <section className={styles.section} aria-labelledby="pricing-heading">
      <div className={styles.intro}>
        <h2 id="pricing-heading" className={styles.introTitle}>
          Clear Pricing. Built for Construction Teams.
        </h2>
        {intro}
      </div>
      <PricingCardList reveal={cardReveal} />
    </section>
  );
}
