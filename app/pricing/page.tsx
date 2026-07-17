import type { Metadata } from "next";
import styles from "./page.module.css";
import { PricingCards } from "../../components/PricingCards/PricingCards";
import { Faq } from "../../components/pricing/Faq";
import { RevealManager } from "../../components/Reveal/RevealManager";

export const metadata: Metadata = {
  // live: capture/meta/pricing.json (no meta description on the live page)
  title: "Pricing - Lidr.io",
};

export default function Pricing() {
  return (
    <div className={styles.page}>
      <RevealManager />
      {/* Live: Elementor container 79e035f (#shoftgradient) — the mountains
          photo + white wash + app-collage arcs band behind the cards. */}
      <div className={styles.pricingBand}>
        {/* Measured reveal set for PRICING (from the reference captures):
            the heading and every card sit inside the first viewport at
            1440 (tops ≤ 281 < 780), so nothing re-arms on desktop. At 768
            the load-time AOS line is 904: Pro (~1215) and Business (~1975)
            start below it and re-arm. At 390 the line is 724: Essential
            (~772), Pro and Business re-arm; Free and the heading always
            fire at load. */}
        <PricingCards
          variant="pricing"
          intro={null}
          headingAs="h1"
          cardReveal={[undefined, "max767", "max1024", "max1024"]}
        />
      </div>
      {/* Live: Elementor container 8a8f2ef — white FAQ band. */}
      <Faq />
    </div>
  );
}
