import type { Metadata } from "next";
import styles from "./page.module.css";
import { Hero } from "../components/home/Hero";
import { QrCta } from "../components/home/QrCta";
import { FeatureCarousel } from "../components/FeatureCarousel/FeatureCarousel";
import { BuiltForConfidence } from "../components/home/BuiltForConfidence";
import { PricingCards } from "../components/PricingCards/PricingCards";
import { Testimonials } from "../components/Testimonials/Testimonials";
import { DownloadCta } from "../components/DownloadCta/DownloadCta";
import { RevealManager } from "../components/Reveal/RevealManager";

export const metadata: Metadata = {
  title: "Smart, Scalable Solutions to Simplify Your Workflow | LIDR.IO",
  description:
    "LIDR.io streamlines your workflow with smart, secure, and scalable solutions. Discover tools designed to simplify data management, enhance collaboration, and drive productivity—tailored for businesses of all sizes.",
  alternates: { canonical: "https://lidr.io/" },
  openGraph: {
    title: "Smart, Scalable Solutions to Simplify Your Workflow | LIDR.IO",
    description:
      "LIDR.io streamlines your workflow with smart, secure, and scalable solutions. Discover tools designed to simplify data management, enhance collaboration, and drive productivity—tailored for businesses of all sizes.",
    url: "https://lidr.io/",
    siteName: "Lidr.io",
    locale: "en_US",
    type: "website",
  },
};

export default function Home() {
  return (
    <div className={styles.page}>
      <RevealManager />
      <Hero />
      <QrCta />
      {/* Live: Elementor container .elementor-element-5db0e7d wrapping every
          section below the QR CTA band (flex column, 20px gap, 10px padding). */}
      <div className={styles.sections}>
        <FeatureCarousel />
        <BuiltForConfidence />
        <PricingCards />
        <Testimonials />
        <DownloadCta />
      </div>
    </div>
  );
}
