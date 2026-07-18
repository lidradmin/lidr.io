"use client";

import { useEffect } from "react";

/**
 * The three reveal participation modes RevealManager understands (see the
 * component doc below). Every `reveal` prop / data-reveal attribute is typed
 * with this union so typos fail the build instead of silently never firing.
 */
export type RevealMode = "always" | "max1024" | "max767";

/**
 * Scroll-reveal runtime, mirroring the live site's AOS behavior as actually
 * captured (AOS.init({ once: true }) + the site's custom
 * `.aos-init { filter: blur(10px) }` hidden state).
 *
 * On the live site, AOS computes element positions at DOMContentLoaded —
 * before the lazy images inflate the page — so a breakpoint-dependent set of
 * below-fold elements never fires during normal browsing and re-reveals on
 * scroll. The reference screenshots (chunked scroll-and-stitch) bake those
 * reveal states in: an element is hidden (blurred/transparent) until its top
 * enters the viewport minus AOS's default 120px offset, then snaps (or, for
 * pricing cards, fades over their 0.5s transition) to its final state.
 *
 * Elements opt in via data-reveal:
 *   "always"  — hidden until scrolled into view at every width
 *   "max1024" — participates only at widths <= 1024px
 *   "max767"  — participates only at widths <= 767px
 * (the per-width sets were measured on the live site at 1440/768/390).
 *
 * The hidden state lives in styles/globals.css (.reveal-pending) with
 * !important + class specificity so it interacts with the visual-test
 * "freeze" stylesheet exactly like the live site's rules do.
 */
export function RevealManager() {
  useEffect(() => {
    const w = window.innerWidth;
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]")
    ).filter((el) => {
      const mode = el.getAttribute("data-reveal");
      if (mode === "always") return true;
      if (mode === "max1024") return w <= 1024;
      if (mode === "max767") return w <= 767;
      return false;
    });
    if (!els.length) return;

    const pending = new Set<HTMLElement>();
    for (const el of els) {
      el.classList.add("reveal-pending");
      pending.add(el);
    }

    const check = () => {
      const line = window.scrollY + window.innerHeight - 120;
      for (const el of pending) {
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top < line) {
          const delay = parseInt(el.getAttribute("data-reveal-delay") || "0", 10);
          if (delay > 0) {
            setTimeout(() => el.classList.remove("reveal-pending"), delay);
          } else {
            el.classList.remove("reveal-pending");
          }
          pending.delete(el);
        }
      }
      if (!pending.size) window.removeEventListener("scroll", check);
    };

    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);

  return null;
}
