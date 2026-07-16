"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

const normalize = (p: string) => p.replace(/\/+$/, "") || "/";

/**
 * Desktop nav links. Client component only for usePathname(): the live site
 * colors the current page's link brand green (and it needs aria-current).
 */
export function NavList({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <ul className={styles.navList}>
      {items.map((item) => {
        const current = normalize(pathname) === normalize(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={current ? styles.navLinkActive : undefined}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
