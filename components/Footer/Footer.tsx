import Link from "next/link";
import styles from "./Footer.module.css";
import { NAV_ITEMS } from "../../lib/nav-items";

// Live footer "Quick Links" mirror the main nav exactly.
const QUICK_LINKS = NAV_ITEMS;

const LEGAL_LINKS = [
  { href: "/privacy-policy/", label: "Privacy Policy" },
  { href: "/terms-of-service/", label: "Terms of Service" },
  { href: "/complaints-policy/", label: "Complaints Policy" },
  { href: "/fair-use-policy/", label: "Fair Use Policy" },
  { href: "/gdpr-policy/", label: "GDPR Policy" },
];

/** Envelope icon, verbatim from the live footer contact links. */
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.5,2H4.5C2.019,2,0,4.019,0,6.5v11c0,2.481,2.019,4.5,4.5,4.5h15c2.481,0,4.5-2.019,4.5-4.5V6.5c0-2.481-2.019-4.5-4.5-4.5ZM4.5,3h15c1.084,0,2.043,.506,2.686,1.283l-7.691,7.692c-.662,.661-1.557,1.025-2.497,1.025-.914-.017-1.826-.36-2.492-1.025L1.814,4.283c.643-.777,1.601-1.283,2.686-1.283Zm18.5,14.5c0,1.93-1.57,3.5-3.5,3.5H4.5c-1.93,0-3.5-1.57-3.5-3.5V6.5c0-.477,.097-.931,.271-1.346l7.528,7.528c.851,.851,1.98,1.318,3.177,1.318s2.375-.467,3.226-1.318l7.528-7.528c.174,.415,.271,.869,.271,1.346v11Z" />
    </svg>
  );
}

/* Social icons, verbatim from the live footer. */
const SOCIALS = [
  {
    href: "https://www.facebook.com/share/1EGWq54tgg/?mibextid=wwXIfr",
    label: "Facebook",
    path: "M20,10.1c0-5.5-4.5-10-10-10S0,4.5,0,10.1c0,5,3.7,9.1,8.4,9.9v-7H5.9v-2.9h2.5V7.9C8.4,5.4,9.9,4,12.2,4c1.1,0,2.2,0.2,2.2,0.2v2.5h-1.3c-1.2,0-1.6,0.8-1.6,1.6v1.9h2.8L13.9,13h-2.3v7C16.3,19.2,20,15.1,20,10.1z",
  },
  {
    href: "https://www.linkedin.com/company/lidrio",
    label: "LinkedIn",
    path: "M18.6,0H1.4C0.6,0,0,0.6,0,1.4v17.1C0,19.4,0.6,20,1.4,20h17.1c0.8,0,1.4-0.6,1.4-1.4V1.4C20,0.6,19.4,0,18.6,0z M6,17.1h-3V7.6h3L6,17.1L6,17.1zM4.6,6.3c-1,0-1.7-0.8-1.7-1.7s0.8-1.7,1.7-1.7c0.9,0,1.7,0.8,1.7,1.7C6.3,5.5,5.5,6.3,4.6,6.3z M17.2,17.1h-3v-4.6c0-1.1,0-2.5-1.5-2.5c-1.5,0-1.8,1.2-1.8,2.5v4.7h-3V7.6h2.8v1.3h0c0.4-0.8,1.4-1.5,2.8-1.5c3,0,3.6,2,3.6,4.5V17.1z",
  },
  {
    href: "https://www.tiktok.com/@lidr.io?_r=1&_t=ZS-97jfMOCpy8A",
    label: "TikTok",
    path: "M18.2 4.5c-2.3-.2-4.1-1.9-4.4-4.2V0h-3.4v13.8c0 1.4-1.2 2.6-2.8 2.6-1.4 0-2.6-1.1-2.6-2.6s1.1-2.6 2.6-2.6h.2l.5.1V7.5h-.7c-3.4 0-6.2 2.8-6.2 6.2S4.2 20 7.7 20s6.2-2.8 6.2-6.2v-7c1.1 1.1 2.4 1.6 3.9 1.6h.8V4.6l-.4-.1z",
  },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.top}`}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local SVG; project pre-optimizes assets and uses plain <img> (next.config images.unoptimized) */}
          <img src="/icons/footer_logo.svg" alt="Lidr.io" width={150} height={60} />
        </div>
        <div className={styles.socials}>
          {SOCIALS.map((s) => (
            <a key={s.label} href={s.href} aria-label={s.label}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d={s.path} />
              </svg>
            </a>
          ))}
        </div>
      </div>

      <div className={`${styles.container} ${styles.columns}`}>
        <div className={styles.column}>
          <h3 className={styles.columnTitle}>Contact</h3>
          <ul className={styles.contactList}>
            <li>
              <a href="mailto:info@lidr.io">
                <MailIcon /> info@lidr.io
              </a>
            </li>
            <li>
              <a href="mailto:support@lidr.io">
                <MailIcon /> support@lidr.io
              </a>
            </li>
          </ul>
        </div>
        <nav className={styles.column} aria-label="Footer quick links">
          <h3 className={styles.columnTitle}>Quick Links</h3>
          <ul className={styles.menu}>
            {QUICK_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav className={styles.column} aria-label="Legal">
          <h3 className={styles.columnTitle}>Legal</h3>
          <ul className={styles.menu}>
            {LEGAL_LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className={styles.bottom}>
        <p className={styles.copyright}>© 2026 Lidr. All rights reserved.</p>
      </div>
    </footer>
  );
}
