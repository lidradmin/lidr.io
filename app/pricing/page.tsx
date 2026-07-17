import type { Metadata } from "next";
import styles from "./page.module.css";
import { PricingCards } from "../../components/PricingCards/PricingCards";
import { Faq } from "../../components/pricing/Faq";
import { RevealManager } from "../../components/Reveal/RevealManager";

export const metadata: Metadata = {
  title: "Pricing - Lidr.io",
  alternates: { canonical: "https://lidr.io/pricing/" },
  openGraph: {
    title: "Pricing - Lidr.io",
    url: "https://lidr.io/pricing/",
    siteName: "Lidr.io",
    locale: "en_US",
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
        {/* Measured reveal set for PRICING (from the reference captures):
            EMPTY. Every card renders crisp in every chunk of
            pricing-{desktop,tablet,mobile}.png — even the below-fold ones
            whose scroll-active background fades are frozen mid-flight —
            so no card participates in the scroll reveal on this page
            (unlike home, where Essential/Pro/Business re-arm). */}
        <PricingCards
          variant="pricing"
          intro={null}
          headingAs="h1"
          cardReveal={[]}
        />
      </div>
      {/* Live: Elementor container 8a8f2ef — white FAQ band. */}
      <Faq />
    </div>
  );
}
