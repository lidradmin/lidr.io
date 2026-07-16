"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PricingCards.module.css";
import { PricingCard } from "./PricingCard";
import { PLANS } from "./plans";
import type { RevealMode } from "../Reveal/RevealManager";

/**
 * Card strip + the live site's mobile scroll highlight: below 801px an
 * IntersectionObserver marks the most-visible card (ratio > 0.3) with a
 * "scroll-active" state (dark slate card, white text). Logic transcribed
 * from the live inline script (capture/dom/home.html, widget a14d1eb).
 *
 * data-reveal modes mirror the live AOS reveal sets, measured per breakpoint
 * on each page (the sets differ page to page because AOS positions depend on
 * the surrounding layout). Default = the HOME page's measured set:
 * Essential/Pro re-arm below 768px, Business below 1025px, Free never.
 * Other pages pass their own measured set (one entry per card, in order).
 */
const HOME_REVEAL: (RevealMode | undefined)[] = [
  undefined,
  "max767",
  "max767",
  "max1024",
];

export function PricingCardList({
  reveal = HOME_REVEAL,
}: {
  /** per-card reveal modes, in PLANS order (see RevealManager) */
  reveal?: (RevealMode | undefined)[];
} = {}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    if (window.innerWidth > 800) return; // live: mobile/tablet only
    const list = listRef.current;
    if (!list) return;
    const cards = Array.from(list.children) as HTMLElement[];
    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target, entry.intersectionRatio);
        }
        let maxRatio = 0;
        let maxCard: Element | null = null;
        ratios.forEach((ratio, card) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            maxCard = card;
          }
        });
        setActiveIdx(
          maxRatio > 0.3 && maxCard ? cards.indexOf(maxCard as HTMLElement) : -1
        );
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0] }
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.cards} ref={listRef}>
      {PLANS.map((plan, i) => (
        <PricingCard
          key={plan.name}
          plan={plan}
          reveal={reveal[i]}
          scrollActive={i === activeIdx}
        />
      ))}
    </div>
  );
}
