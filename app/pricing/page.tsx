import type { Metadata } from "next";
import styles from "./page.module.css";
import { PricingCards } from "../../components/PricingCards/PricingCards";
import { Faq } from "../../components/pricing/Faq";
import { RevealManager } from "../../components/Reveal/RevealManager";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for construction teams of every size. Start with a 14-day free trial — no credit card required.",
  alternates: { canonical: "https://lidr.io/pricing/" },
  openGraph: {
    title: "Pricing - Lidr.io",
    description:
      "Simple, transparent pricing for construction teams of every size. Start with a 14-day free trial — no credit card required.",
    url: "https://lidr.io/pricing/",
    type: "article",
  },
};

export default function Pricing() {
  return (
    <div className={styles.page}>
      <RevealManager />
      {/* Live: Elementor container 79e035f (#shoftgradient) — the mountains
          photo + white wash + app-collage arcs band behind the cards. */}
      <div className={styles.pricingBand}>
        <PricingCards
          variant="pricing"
          intro={null}
          headingAs="h1"
          cardReveal={["always", "always", "always", "always"]}
          cardRevealDelays={[50, 100, 200, 400]}
        />
      </div>
      {/* Live: Elementor container 8a8f2ef — white FAQ band. */}
      <Faq />
    </div>
  );
}
