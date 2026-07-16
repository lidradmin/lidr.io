import type { Metadata } from "next";
import styles from "./page.module.css";
import { FeaturesHero } from "../../components/features/FeaturesHero";
import { ClarityStack } from "../../components/features/ClarityStack";
import { EverythingGrid } from "../../components/features/EverythingGrid";
import { Testimonials } from "../../components/Testimonials/Testimonials";
import { FEATURES_REVIEWS } from "../../components/features/features-reviews";
import { DownloadCta } from "../../components/DownloadCta/DownloadCta";
import { RevealManager } from "../../components/Reveal/RevealManager";

export const metadata: Metadata = {
  // live: capture/meta/features.json (no meta description on the live page)
  title: "Features - Lidr.io",
};

export default function Features() {
  return (
    <div className={styles.page}>
      <RevealManager />
      <FeaturesHero />
      {/* Live: Elementor container 940a559 wrapping every section below the
          hero (flex column, 20px gap, 10px padding). */}
      <div className={styles.sections}>
        {/* Live: the sticky stack + benefit grid share one shortcode widget
            (2eba7e0) — grouped so the container gap doesn't split them. */}
        <div>
          <ClarityStack />
          <EverythingGrid />
        </div>
        {/* Measured reveal sets for FEATURES (from the reference captures):
            the reviews band re-arms at every breakpoint, but its top always
            clears the AOS trigger line by the chunk that shows it, so
            "always" reproduces the references at all three widths. The
            download CTA is the opposite: the live captures show all five
            blocks CRISP in every chunk (AOS fired off offsets cached before
            the lazy images inflated the page), so on this page they must
            not participate at all — unlike home, where all five re-arm. */}
        <Testimonials
          reveal="always"
          reviews={FEATURES_REVIEWS}
          variant="features"
        />
        <DownloadCta reveal={{}} />
      </div>
    </div>
  );
}
