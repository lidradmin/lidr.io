"use client";

import { useEffect, useRef } from "react";
import styles from "./ClarityStack.module.css";
import { STACK_CARDS } from "./stack-cards";

/**
 * "Clarity From Every Capture" scroll-driven sticky card stack,
 * features-page only (the home page's same-titled section is a Swiper
 * carousel — a different mechanic, see components/FeatureCarousel).
 *
 * Live source: capture/dom/features.html section#cfcSection + its inline
 * script. Mechanic transcribed 1:1:
 *   - the scroll area is sized to cards × 500px + viewport height, so each
 *     card owns 500px of scroll travel (the JS sets an inline height at
 *     every width; below 802px the stylesheet unsets it with !important and
 *     the cards render as a plain stacked list — exactly as live);
 *   - a sticky frame (top: 20%) pins the heading + card stack while the
 *     area scrolls; ghost layers behind the stack fake the card deck;
 *   - on scroll, floor(scrolled / 500) picks the active card; the previous
 *     one gets an exit state. Above the area the live script records
 *     current = -1 but deliberately leaves the last card's classes alone —
 *     kept as-is. Class swaps happen outside React state on purpose: the
 *     live page mutates classLists directly and this must stay in lockstep
 *     with scroll events during the chunked reference capture.
 *
 * The live nav dots are built by that script but carry an inline
 * display:none (never rendered on any breakpoint) — omitted here.
 */
const STEP_PX = 500; // live: STEP_PX

export function ClarityStack() {
  const areaRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const area = areaRef.current;
    const stack = stackRef.current;
    if (!area || !stack) return;
    const cards = Array.from(
      stack.querySelectorAll<HTMLElement>(`.${styles.card}`)
    );
    const total = cards.length;

    // live: area.style.height = total * STEP_PX + window.innerHeight
    const size = () => {
      area.style.height = `${total * STEP_PX + window.innerHeight}px`;
    };
    size();

    let current = -1;
    const activate = (idx: number) => {
      if (idx === current) return;
      cards.forEach((c, i) => {
        c.classList.remove(styles.cardActive, styles.cardExit);
        if (i === idx) c.classList.add(styles.cardActive);
        else if (i === current) c.classList.add(styles.cardExit);
      });
      current = idx;
    };
    const onScroll = () => {
      const scrolled = -area.getBoundingClientRect().top;
      if (scrolled < 0) {
        current = -1; // live: resets the index without clearing classes
        return;
      }
      activate(Math.min(total - 1, Math.max(0, Math.floor(scrolled / STEP_PX))));
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", size);
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", size);
    };
  }, []);

  return (
    <section className={styles.section} aria-label="Clarity From Every Capture">
      <div className={styles.scrollArea} ref={areaRef}>
        <div className={styles.stickyFrame}>
          <h2 className={styles.heading}>Clarity From Every Capture</h2>
          <div className={styles.stack} ref={stackRef}>
            {/* live: decorative ghost layers behind the deck */}
            <div className={`${styles.ghost} ${styles.ghost3}`} aria-hidden="true" />
            <div className={`${styles.ghost} ${styles.ghost2}`} aria-hidden="true" />
            <div className={`${styles.ghost} ${styles.ghost1}`} aria-hidden="true" />
            {STACK_CARDS.map((card) => (
              <article
                key={card.title}
                className={styles.card}
                aria-label={card.title}
              >
                <div className={styles.phoneWrap} aria-hidden="true">
                  <img
                    src={`/images/${card.img}.webp`}
                    width={card.w}
                    height={card.h}
                    alt={card.title}
                    loading="lazy"
                  />
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{card.title}</h3>
                  <p className={styles.cardDesc}>{card.desc}</p>
                  <ul className={styles.bullets}>
                    {card.bullets.map((b) => (
                      <li key={b}>
                        <img
                          src="/icons/icon_a2dd44fe-28c9-4097-aff8-023c347e664e.svg"
                          width={20}
                          height={20}
                          alt=""
                          loading="lazy"
                        />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className={styles.cardFooter}>
                    <a
                      className={styles.btn}
                      href="https://apps.apple.com/app/id6759912615"
                    >
                      Download Now
                    </a>
                    <div className={styles.meta}>
                      <span className={styles.metaIcon} aria-hidden="true">
                        <img
                          src="/icons/Group_195_7bfd169b-47f4-4c15-b810-4fec57dd1142.svg"
                          width={26}
                          height={23}
                          alt=""
                          loading="lazy"
                        />
                      </span>
                      <div className={styles.metaBar}>
                        <span className={styles.stars} aria-label="5 stars">
                          ★★★★★
                        </span>
                        <span>200,000+ Users</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      {/* live: .cfc-footer-space — desktop-only spacer below the deck */}
      <div className={styles.footerSpace} />
    </section>
  );
}
