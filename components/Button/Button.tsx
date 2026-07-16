import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary";

/**
 * Discriminated union: with `href` the component renders an <a> (internal
 * hrefs via next/link) and accepts anchor attributes (target, rel, ...);
 * without it, a native <button> accepting button attributes (onClick, type,
 * disabled, ...). Note: the live header/footer links carry no
 * target="_blank", so external links here deliberately open in the same tab.
 */
type AnchorButtonProps = {
  href: string;
  variant?: Variant;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

type NativeButtonProps = {
  href?: undefined;
  variant?: Variant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export type ButtonProps = AnchorButtonProps | NativeButtonProps;

function classes(variant: Variant, className?: string) {
  return [styles.button, styles[variant], className].filter(Boolean).join(" ");
}

/**
 * Shared pill button, matching the live site's two CTA styles
 * (verified from computed styles on the live header, 2026-07-16):
 * - primary: dark vertical gradient, white text (e.g. "Download App")
 * - secondary: white pill, black text, gradient on hover (e.g. "Login")
 */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { href, variant = "primary", className, ...anchorProps } = props;
    const cls = classes(variant, className);
    // Internal links go through next/link; external (app/store) links are plain <a>.
    if (href.startsWith("/")) {
      return <Link href={href} className={cls} {...anchorProps} />;
    }
    return <a href={href} className={cls} {...anchorProps} />;
  }

  const { variant = "primary", className, type, ...buttonProps } = props;
  return (
    <button
      type={type ?? "button"}
      className={classes(variant, className)}
      {...buttonProps}
    />
  );
}
