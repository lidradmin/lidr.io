"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

/**
 * Mobile header controls (<1000px): hamburger trigger + full-screen menu
 * panel, replicating the live offcanvas (white glass overlay, top-right
 * close button, large links). Accessible: aria-expanded, Escape to close,
 * Tab focus-trap while open, focus restored to the trigger on close.
 */
export function MobileMenu({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close on any route change (covers back/forward navigation while open).
  // State-adjustment-during-render pattern per react.dev
  // ("You Might Not Need an Effect") rather than a setState-in-effect.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const toggle = toggleRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the panel (its close button).
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        // The panel only contains links + the close button; extend this
        // selector if other focusable elements are ever added.
        const f = panelRef.current.querySelectorAll<HTMLElement>("a, button");
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [open]);

  return (
    <div className={styles.mobileMenu}>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className={styles.menuToggle}
      >
        {/* Hamburger icon, verbatim from the live trigger SVG */}
        <svg
          className={styles.burger}
          width="18"
          height="18"
          viewBox="0 0 18 14"
          aria-hidden="true"
        >
          <rect y="0" width="18" height="1.7" rx="1" />
          <rect y="6.15" width="18" height="1.7" rx="1" />
          <rect y="12.3" width="18" height="1.7" rx="1" />
        </svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          className={styles.menuPanel}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <button
            type="button"
            className={styles.menuClose}
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            {/* Close (X) icon, verbatim from the live offcanvas */}
            <svg width="12" height="12" viewBox="0 0 15 15" aria-hidden="true">
              <path d="M1 15a1 1 0 01-.71-.29 1 1 0 010-1.41l5.8-5.8-5.8-5.8A1 1 0 011.7.29l5.8 5.8 5.8-5.8a1 1 0 011.41 1.41l-5.8 5.8 5.8 5.8a1 1 0 01-1.41 1.41l-5.8-5.8-5.8 5.8A1 1 0 011 15z" />
            </svg>
          </button>
          <nav aria-label="Main menu">
            <ul className={styles.menuList}>
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
