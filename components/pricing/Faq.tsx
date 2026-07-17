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
 * "Commonly Asked Questions" accordion + app-mockup visual, pricing-page
 * only. Live source: capture/dom/pricing.html section#lidr-faq-section
 * (Elementor container 8a8f2ef, shortcode widget fa15939). Text verbatim.
 *
 * Behavior transcribed from the live inline script: single-open accordion —
 * opening an item closes the others; clicking the open item closes it
 * (leaving none open). The first item is open initially, exactly like the
 * captured state.
 */
export function Faq() {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <section
      className={styles.section}
      aria-label="Frequently asked questions"
    >
      <h2 className={styles.heading}>Commonly Asked Questions</h2>
      <div className={styles.inner}>
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
          <div className={styles.mockup}>
            <img
              src="/images/pricingimg2.webp"
              srcSet="/images/pricingimg2-half.webp 843w, /images/pricingimg2.webp 1686w"
              sizes="340px"
              width={1686}
              height={2204}
              alt="Hand holding a phone showing the Lidr.io app login screen"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
