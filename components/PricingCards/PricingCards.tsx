import styles from "./PricingCards.module.css";
import { PricingCardList } from "./PricingCardList";
import { GeoPricing } from "./GeoPricing";
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
 * `variant="pricing"` adds the live pricing page's extra widget class
 * (.pricing__modals.pricingpagemainss) overrides — see the module CSS.
 * `headingAs` lets the pricing page promote the section heading to its h1
 * (the live pricing page has no h1 at all; this heading is its visual
 * page title). Styling is identical either way.
 */
export function PricingCards({
  intro = (
    <p className={styles.introText}>
      Simple, transparent plans designed to scale from single projects to
      enterprise operations — no hidden fees or long-term contracts.
    </p>
  ),
  cardReveal,
  cardRevealDelays,
  variant = "home",
  headingAs: Heading = "h2",
}: {
  intro?: React.ReactNode;
  cardReveal?: (RevealMode | undefined)[];
  cardRevealDelays?: number[];
  variant?: "home" | "pricing";
  headingAs?: "h1" | "h2";
} = {}) {
  const cls =
    variant === "pricing"
      ? `${styles.section} ${styles.pricingVariant}`
      : styles.section;
  return (
    <section className={cls} aria-labelledby="pricing-heading">
      <div className={styles.intro} data-reveal="always" data-reveal-delay="10">
        <Heading id="pricing-heading" className={styles.introTitle}>
          Clear Pricing. Built for Construction Teams.
        </Heading>
        {intro}
      </div>
      <PricingCardList reveal={cardReveal} revealDelays={cardRevealDelays} cardNameAs={Heading === "h1" ? "h2" : "h3"} />
      <GeoPricing />
    </section>
  );
}
