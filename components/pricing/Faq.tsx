"use client";

import { useState } from "react";
import styles from "./Faq.module.css";
import { FAQS } from "./faq-data";

/** Plus glyph used by every FAQ trigger (path verbatim from the live DOM). */
function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path d="M23,11H13V1a1,1,0,0,0-1-1h0a1,1,0,0,0-1,1V11H1a1,1,0,0,0-1,1H0a1,1,0,0,0,1,1H11V23a1,1,0,0,0,1,1h0a1,1,0,0,0,1-1V13H23a1,1,0,0,0,1-1h0A1,1,0,0,0,23,11Z" />
    </svg>
  );
}

/**
 * "Commonly Asked Questions" accordion + app-mockup visual.
 * Live source: capture/dom/pricing.html + capture/dom/about.html
 * (same shortcode, same FAQ text, different visual image).
 *
 * Behavior transcribed from the live inline script: single-open accordion —
 * opening an item closes the others; clicking the open item closes it
 * (leaving none open). The first item is open initially, exactly like the
 * captured state.
 *
 * variant="pricing" (default): pricingimg2 bottom-pinned (pricing page)
 * variant="about": aboutusimhg2 centered with 60px padding (about page)
 */
export function Faq({ variant = "pricing" }: { variant?: "pricing" | "about" } = {}) {
  const [openIdx, setOpenIdx] = useState(0);

  /* wp-custom-css (lines 29281-29300 in capture/dom/about.html) overrides
     the shortcode inline CSS and makes BOTH the about and pricing FAQ
     visuals render with the same bottom-pinned, 340px, translateX(4.5%)
     layout. Only the image source differs. */
  const mockupImg =
    variant === "about" ? (
      <img
        src="/images/aboutusimhg2.png"
        width={1099}
        height={2168}
        alt="Phone showing the Lidr.io app on a construction site"
        loading="lazy"
      />
    ) : (
      <img
        src="/images/pricingimg2.webp"
        srcSet="/images/pricingimg2-half.webp 843w, /images/pricingimg2.webp 1686w"
        sizes="340px"
        width={1686}
        height={2204}
        alt="Hand holding a phone showing the Lidr.io app login screen"
        loading="lazy"
      />
    );

  const mockup = <div className={styles.mockup}>{mockupImg}</div>;

  const sectionCls =
    variant === "about"
      ? `${styles.section} ${styles.sectionAbout}`
      : styles.section;

  return (
    <section
      className={sectionCls}
      aria-label="Frequently asked questions"
    >
      <h2 className={styles.heading} data-reveal="always" data-reveal-delay="10">Commonly Asked Questions</h2>
      <div className={styles.inner} data-reveal="always" data-reveal-delay="50">
        <div className={styles.left}>
          <ul className={styles.list}>
            {FAQS.map((faq, i) => {
              const open = i === openIdx;
              return (
                <li
                  key={faq.question}
                  className={open ? `${styles.item} ${styles.open}` : styles.item}
                >
                  <button
                    type="button"
                    className={styles.trigger}
                    aria-expanded={open}
                    aria-controls={`faq-panel-${i + 1}`}
                    onClick={() => setOpenIdx(open ? -1 : i)}
                  >
                    {faq.question}
                    <span className={styles.icon}>
                      <PlusIcon />
                    </span>
                  </button>
                  <div
                    className={styles.panel}
                    id={`faq-panel-${i + 1}`}
                    role="region"
                  >
                    <p className={styles.answer}>{faq.answer}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={styles.visual}>
          <div className={styles.badge}>
            <img
              src="/icons/Group_195.svg"
              width={79}
              height={70}
              alt=""
              loading="lazy"
            />
          </div>
          {mockup}
        </div>
      </div>
    </section>
  );
}
