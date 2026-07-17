import type { Metadata } from "next";
import styles from "./page.module.css";
import { AboutHero } from "../../components/about/AboutHero";
import { ProjectNeedsGrid } from "../../components/about/ProjectNeedsGrid";
import { Faq } from "../../components/pricing/Faq";
import { AboutDownloadCta } from "../../components/about/AboutDownloadCta";
import { RevealManager } from "../../components/Reveal/RevealManager";

export const metadata: Metadata = {
  title: "About - Lidr.io",
  alternates: { canonical: "https://lidr.io/about/" },
  openGraph: {
    title: "About - Lidr.io",
    url: "https://lidr.io/about/",
    siteName: "Lidr.io",
    locale: "en_US",
    type: "article",
  },
};

export default function About() {
  return (
    <div className={styles.page}>
      <RevealManager />
      {/* Live: Elementor container 8a86ec0 #shoftgradient — single-widget
          white container; margin-top:-80px handled in AboutHero.module.css. */}
      <AboutHero>
        <ProjectNeedsGrid />
      </AboutHero>
      {/* FAQ — same questions/structure as the pricing page FAQ section. */}
      <Faq variant="about" />
      <AboutDownloadCta />
    </div>
  );
}
