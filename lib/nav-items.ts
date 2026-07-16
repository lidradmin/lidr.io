/**
 * Main site navigation, shared by the Header nav / mobile menu and the
 * Footer "Quick Links" column (identical on the live site).
 */
export type NavItem = { href: string; label: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/about/", label: "About Us" },
  { href: "/features/", label: "Features" },
  { href: "/pricing/", label: "Pricing" },
  { href: "/contact-us/", label: "Contact" },
];
