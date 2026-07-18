"use client";

import { useEffect } from "react";

/**
 * The three reveal participation modes RevealManager understands (see the
 * component doc below). Every `reveal` prop / data-reveal attribute is typed
 * with this union so typos fail the build instead of silently never firing.
 */
export type RevealMode = "always" | "max1024" | "max767";

/**
 * Scroll-reveal runtime, mirroring the live site's AOS behavior.
 *
 * Elements with [data-reveal] start hidden from first paint via pure CSS
 * (opacity 0, scale 1.2, translate3d down 100px — matching AOS zoom-out-up).
 * No JS is needed for the hidden state, so there's no flash of content.
 *
 * On mount this component:
 *  1. Filters elements by their data-reveal mode vs current viewport width
 *  2. Adds .reveal-ready to enable CSS transitions
 *  3. After one frame (so the browser paints the hidden state with
 *     transitions now active), reveals above-the-fold elements by adding
 *     .reveal-visible, respecting data-reveal-delay for staggered entrance
 *  4. Listens for scroll to reveal below-fold elements as they enter
 *
 * Elements whose data-reveal mode doesn't match the current width get
 * .reveal-visible immediately (no animation, just shown).
 */
export function RevealManager() {
  useEffect(() => {
    const w = window.innerWidth;
    const all = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]")
    );

    // Elements that don't participate at this width — show immediately
    const participating: HTMLElement[] = [];
    for (const el of all) {
      const mode = el.getAttribute("data-reveal");
      const active =
        mode === "always" ||
        (mode === "max1024" && w <= 1024) ||
        (mode === "max767" && w <= 767);
      if (active) {
        participating.push(el);
      } else {
        el.classList.add("reveal-visible");
      }
    }
    if (!participating.length) return;

    // Enable transitions on participating elements
    for (const el of participating) {
      el.classList.add("reveal-ready");
    }

    const pending = new Set(participating);

    const reveal = (el: HTMLElement) => {
      const delay = parseInt(el.getAttribute("data-reveal-delay") || "0", 10);
      if (delay > 0) {
        setTimeout(() => el.classList.add("reveal-visible"), delay);
      } else {
        el.classList.add("reveal-visible");
      }
      pending.delete(el);
    };

    const check = () => {
      const line = window.scrollY + window.innerHeight - 120;
      for (const el of pending) {
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top < line) {
          reveal(el);
        }
      }
      if (!pending.size) window.removeEventListener("scroll", check);
    };

    // Wait one frame so the browser has painted the hidden+transitioned
    // state, then reveal above-fold elements with their staggered delays
    requestAnimationFrame(() => {
      check();
    });
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

  return null;
}
