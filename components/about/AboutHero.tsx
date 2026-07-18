import type { ReactNode } from "react";
import styles from "./AboutHero.module.css";
import { AppStoreBadges } from "../AppStoreBadges/AppStoreBadges";

/**
 * "Built by Builders" intro section — the about page hero.
 * Live source: capture/dom/about.html .mains__goodconmsin23 + .mains__rowcolumn
 * (Elementor widget 736dde4, shortcode inside container 8a86ec0 #shoftgradient).
 * Text verbatim. Image: /images/builtbybuilders.webp.
 */
export function AboutHero({ children }: { children?: ReactNode } = {}) {
  return (
    <section className={styles.section} aria-labelledby="about-hero-heading">
      <div className={styles.heading} data-reveal="always" data-reveal-delay="50">
        <h1 id="about-hero-heading">Built by Builders</h1>
      </div>
      <div className={styles.row}>
        <div className={styles.rowInner}>
        {/* Left column: app collage image + store badges */}
        <div className={styles.imageCol} data-reveal="always" data-reveal-delay="100">
          <div className={styles.imageWrap}>
            <div className={styles.imageInner}>
              <img
                src="/images/builtbybuilders.png"
                width={1268}
                height={1800}
                alt="Lidr.io app collage"
                loading="eager"
              />
              <div className={styles.badgeBar}>
                <AppStoreBadges className={styles.badges} imgClassName={styles.badgeImg} />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: three Q&A blocks */}
        <div className={styles.contentCol} data-reveal="always" data-reveal-delay="150">
          <div className={styles.qaBlock}>
            <h5>What is Lidr.io?</h5>
            <p>
              Lidr.io is a construction documentation and reporting platform
              designed to help teams capture, organize, and transform site photos
              and project data into structured, professional records. The platform
              enables field teams, project managers, and stakeholders to track
              progress, ensure compliance, and deliver clear, audit-ready reports
              through a simple, secure digital workflow.
            </p>
          </div>
          <div className={styles.qaBlock}>
            <h5>When was Lidr.io founded?</h5>
            <p>
              Lidr.io was founded to address the growing need for reliable,
              visual project documentation in modern construction environments.
              Built by professionals with firsthand experience in project
              management and site operations, the platform continues to evolve
              alongside the industry&apos;s increasing focus on transparency,
              accountability, and digital transformation.
            </p>
          </div>
          <div className={styles.qaBlock}>
            <h5>What features do we offer?</h5>
            <p>
              Lidr.io equips construction teams with essential tools, including
              photo and video capture, project organization, image annotations,
              PDF reports, team collaboration, AI assistance, secure cloud
              storage, integrations, and audit logs—all in one platform.
            </p>
          </div>
        </div>
        </div>{/* end rowInner */}
      </div>
      {/* On the live site, the ProjectNeedsGrid (.everything__youneed) sits
          INSIDE the hero container (#shoftgradient / 8a86ec0), so the hero
          background (construction-photo wash) covers the grid's margin-top
          gap. Passing children here preserves that nesting. */}
      {children}
    </section>
  );
}
