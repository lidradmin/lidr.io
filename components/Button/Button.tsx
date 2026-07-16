import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Button.module.css";

type ButtonProps = {
  /** Renders an <a> (internal hrefs via next/link) instead of a <button>. */
  href?: string;
  variant?: "primary" | "secondary";
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
};

/**
 * Shared pill button, matching the live site's two CTA styles
 * (verified from computed styles on the live header, 2026-07-16):
 * - primary: dark vertical gradient, white text (e.g. "Download App")
 * - secondary: white pill, black text, gradient on hover (e.g. "Login")
 */
export function Button({
  href,
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonProps) {
  const cls = [styles.button, styles[variant], className]
    .filter(Boolean)
    .join(" ");

  if (href) {
    // Internal links go through next/link; external (app/store) links are plain <a>.
    if (href.startsWith("/")) {
      return (
        <Link href={href} className={cls} {...rest}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
