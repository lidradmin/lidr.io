"use client";

import { useRef, useState } from "react";
import styles from "./FeatureCarousel.module.css";
import { ArrowLeftIcon, ArrowRightIcon } from "../icons/Arrows";
import { SLIDES } from "./slides";

/**
 * "Clarity From Every Capture" carousel (HOME page only — the features page
 * builds the same-titled section as a position:sticky scroll-driven card
 * stack, a different mechanic; see components/features/).
 * Mirrors the live implementation exactly: a transform-driven strip on
 * desktop (Swiper on the live site) and a native scroll-snap strip with
 * arrow buttons on tablet/mobile — two DOM variants toggled by media query,
 * as live (Elementor widgets 800f215 / 21a6ddd).
 *
 * Client component: the arrows drive scroll/transform state. Initial render
 * is byte-stable (offset 0, prev disabled), matching the captured live DOM.
 */

const SLIDE_STEP = 290; // live: 280px slide + 10px margin

function slideImg(
  s: (typeof SLIDES)[number],
  variant: "desktop" | "mobile"
) {
  const base = variant === "mobile" && s.mobileBase ? s.mobileBase : s.base;
  const w = variant === "mobile" && s.mw ? s.mw : s.w;
  const h = variant === "mobile" && s.mh ? s.mh : s.h;
  return (
    <img
      src={`/images/${base}.webp`}
      srcSet={`/images/${base}-half.webp ${Math.round(w / 2)}w, /images/${base}.webp ${w}w`}
      sizes="260px"
      width={w}
      height={h}
      alt={s.title}
      loading="lazy"
    />
  );
}

export function FeatureCarousel() {
  // Desktop strip state
  const [offset, setOffset] = useState(0);
  const [maxed, setMaxed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Mobile strip state
  const [mIndex, setMIndex] = useState(0);
  const mCarouselRef = useRef<HTMLDivElement>(null);

  const slideDesktop = (dir: 1 | -1) => {
    const track = trackRef.current;
    const row = rowRef.current;
    if (!track || !row) return;
    const maxOffset = Math.max(0, row.scrollWidth - track.clientWidth);
    const next = Math.min(maxOffset, Math.max(0, offset + dir * SLIDE_STEP));
    setOffset(next);
    setMaxed(next >= maxOffset);
  };

  const slideMobile = (dir: 1 | -1) => {
    const carousel = mCarouselRef.current;
    if (!carousel) return;
    const slides = carousel.querySelectorAll(`.${styles.mSlide}`);
    const next = Math.min(slides.length - 1, Math.max(0, mIndex + dir));
    setMIndex(next);
    slides[next]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  return (
    <>
      {/* Desktop variant (live: .sjhort__desktop, hidden below 1025px) */}
      <section className={styles.desktop} aria-labelledby="clarity-heading">
        <div className={styles.dHeader}>
          <div className={styles.dRow}>
            <div>
              <h2 id="clarity-heading" className={styles.dHeading} data-reveal="always" data-reveal-delay="10">
                Clarity From Every Capture
              </h2>
              <p className={styles.dLede} data-reveal="always" data-reveal-delay="50">
                Helping your team work faster, stay compliant, and deliver
                confident updates to clients and stakeholders.
              </p>
            </div>
            <div className={styles.dArrows} data-reveal="always" data-reveal-delay="10">
              <button
                type="button"
                className={styles.dArrowBtn}
                aria-label="Previous slide"
                disabled={offset <= 0}
                onClick={() => slideDesktop(-1)}
              >
                <ArrowLeftIcon />
              </button>
              <button
                type="button"
                className={styles.dArrowBtn}
                aria-label="Next slide"
                disabled={maxed}
                onClick={() => slideDesktop(1)}
              >
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        </div>
        <div className={styles.dTrack} ref={trackRef}>
          <div
            className={styles.dSlides}
            ref={rowRef}
            style={{ transform: `translate3d(${-offset}px, 0px, 0px)` }}
          >
            {SLIDES.map((s, i) => (
              <div key={s.title} className={styles.dSlide} data-reveal="always" data-reveal-delay={50 + i * 50}>
                <div className={styles.dCard}>
                  <h3 className={styles.dCardTitle}>{s.title}</h3>
                  <div className={styles.dImgWrap}>
                    {slideImg(s, "desktop")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tablet/mobile variant (live: widget 21a6ddd, hidden at >=1025px) */}
      <section className={styles.mobile} aria-labelledby="clarity-heading-m">
        <div className={styles.mHeader}>
          <div className={styles.mRow}>
            <div>
              <h2 id="clarity-heading-m" className={styles.mHeading} data-reveal="always" data-reveal-delay="10">
                Clarity From Every Capture
              </h2>
              <p className={styles.mLede} data-reveal="always" data-reveal-delay="50">
                Helping your team work faster, stay compliant, and deliver
                confident updates to clients and stakeholders.
              </p>
            </div>
            <div className={styles.mArrows} data-reveal="always" data-reveal-delay="10">
              <button
                type="button"
                className={styles.mArrowBtn}
                aria-label="Previous slide"
                onClick={() => slideMobile(-1)}
              >
                <ArrowLeftIcon />
              </button>
              <button
                type="button"
                className={styles.mArrowBtn}
                aria-label="Next slide"
                onClick={() => slideMobile(1)}
              >
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        </div>
        <div className={styles.mCarousel} ref={mCarouselRef}>
          <div className={styles.mTrack}>
            {SLIDES.map((s, i) => (
              <div key={s.title} className={styles.mSlide} data-reveal="always" data-reveal-delay={50 + i * 50}>
                <div className={styles.mCard}>
                  <h3 className={styles.mCardTitle}>{s.title}</h3>
                  <div className={styles.mImgWrap}>{slideImg(s, "mobile")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
