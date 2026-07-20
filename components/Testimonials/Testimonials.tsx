"use client";

import { useRef, useState } from "react";
import styles from "./Testimonials.module.css";
import { ArrowLeftIcon, ArrowRightIcon } from "../icons/Arrows";
import { REVIEWS, type Review } from "./reviews";
import type { RevealMode } from "../Reveal/RevealManager";

/** Quote glyph, paths verbatim from the live DOM (widget 24f904c). */
function QuoteIcon() {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.quoteSvg}
      aria-hidden="true"
    >
      <path d="M 92.43 197.34 C 116.46 158.99 153.22 129.65 194.15 110.97 C 200.56 120.19 206.95 129.43 213.32 138.68 C 183.31 155.01 155.62 177.82 139.37 208.38 C 131.10 223.81 125.99 240.82 123.73 258.15 C 136.72 250.60 152.48 249.82 167.03 252.11 C 186.10 254.76 204.30 264.50 216.38 279.60 C 228.84 294.92 234.39 315.45 231.95 334.99 C 230.24 348.35 224.74 361.04 217.08 372.04 C 206.45 388.10 188.10 398.28 169.12 400.40 C 144.59 403.62 118.72 395.33 100.87 378.15 C 89.43 365.97 79.86 351.81 74.12 336.04 C 68.67 321.34 66.50 305.61 66.19 289.99 C 65.24 257.35 75.11 224.88 92.43 197.34 Z" />
      <path d="M 305.96 197.03 C 330.01 158.84 366.68 129.56 407.53 110.98 C 413.89 120.20 420.23 129.44 426.68 138.60 C 400.87 152.85 376.74 171.44 360.11 196.10 C 347.56 214.53 339.90 236.05 337.06 258.11 C 350.25 250.53 366.17 249.81 380.88 252.17 C 399.71 254.93 417.63 264.58 429.61 279.46 C 441.74 294.29 447.33 314.05 445.51 333.06 C 444.20 346.01 439.30 358.44 432.24 369.32 C 427.22 377.03 421.29 384.38 413.55 389.51 C 399.97 398.72 383.05 401.66 366.89 400.92 C 347.59 399.77 328.61 391.83 314.55 378.49 C 302.85 366.18 293.14 351.76 287.34 335.74 C 280.95 318.29 279.11 299.50 279.56 281.02 C 280.40 251.27 290.15 222.13 305.96 197.03 Z" />
    </svg>
  );
}

/**
 * "Trusted by Peoples Across the World" review carousel (shared: home +
 * features pages). Live source: capture/dom/home.html .rating__tabcontent
 * (widget 24f904c) — a native horizontal scroller with arrow buttons.
 * Client component: the arrows drive the scroller. Initial render matches
 * the captured state (scroll 0, prev disabled).
 */
export function Testimonials({
  reveal = "max1024",
  reviews = REVIEWS,
  variant = "home",
}: {
  /**
   * Section-level reveal mode (see RevealManager). Default = the set
   * measured on HOME (whole band re-arms below 1025px); other pages pass
   * their own measured mode.
   */
  reveal?: RevealMode;
  /**
   * Review cards. Default = the home page's set; the features page passes
   * its own (same quotes/people, different live company names).
   */
  reviews?: Review[];
  /**
   * Live-widget metrics variant. The FEATURES page renders this band as a
   * real Swiper with different metrics than home's custom scroller:
   * 10px slide gap (home 15px), 300px slides below 802px (home 400/280),
   * no phone-centering track padding, content-height cards (home: full
   * height), and thin 45px/35px arrow buttons (home: 44px, 2px border).
   */
  variant?: "home" | "features";
} = {}) {
  const [index, setIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const slideTo = (next: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const slides = viewport.querySelectorAll<HTMLElement>(
      `.${styles.slide}`
    );
    const clamped = Math.min(slides.length - 1, Math.max(0, next));
    setIndex(clamped);
    const slide = slides[clamped];
    let offset =
      slide.getBoundingClientRect().left -
      viewport.getBoundingClientRect().left +
      viewport.scrollLeft;
    // live behavior: home's scroller centers the target slide on phones
    // (the features Swiper aligns slides to the container edge)
    if (variant === "home" && window.innerWidth <= 767) {
      offset = offset - viewport.offsetWidth / 2 + slide.offsetWidth / 2;
    }
    viewport.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
  };

  return (
    // data-reveal: on the live site the reviews band re-arms its AOS reveal
    // (home: below 1025px) — those references show it hidden until scrolled
    // into view (see RevealManager).
    <section
      className={
        variant === "features"
          ? `${styles.section} ${styles.features}`
          : styles.section
      }
      aria-labelledby="reviews-heading"
      data-reveal={reveal}
      data-reveal-delay="10"
    >
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <h2 id="reviews-heading" className={styles.heading}>
            Trusted by Peoples Across the World
          </h2>
          <div className={styles.arrows}>
            <button
              type="button"
              className={styles.arrowBtn}
              aria-label="Previous review"
              disabled={index <= 0}
              onClick={() => slideTo(index - 1)}
            >
              <ArrowLeftIcon />
            </button>
            <button
              type="button"
              className={styles.arrowBtn}
              aria-label="Next review"
              disabled={index >= reviews.length - 1}
              onClick={() => slideTo(index + 1)}
            >
              <ArrowRightIcon />
            </button>
          </div>
        </div>
      </div>
      <div className={styles.viewport} ref={viewportRef} tabIndex={0} role="region" aria-label="Testimonials">
        <div className={styles.track}>
          {reviews.map((r) => (
            <div key={r.name} className={styles.slide}>
              <div className={styles.card}>
                <div className={styles.quote}>
                  <QuoteIcon />
                </div>
                <p className={styles.text}>{r.quote}</p>
                <div className={styles.author}>
                  <div className={styles.avatar}>
                    <img
                      src={`/images/${r.img}.webp`}
                      width={r.w}
                      height={r.h}
                      alt={r.name}
                      loading="lazy"
                    />
                  </div>
                  <div className={styles.meta}>
                    <p className={styles.name}>{r.name}</p>
                    <p className={styles.role}>{r.role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
