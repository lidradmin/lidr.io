"use client";

import { useState } from "react";
import styles from "./PricingCards.module.css";
import type { Plan } from "./plans";

/** Chevron used by the live "See All Features" toggle (path verbatim). */
function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      className={styles.seeAllIcon}
      aria-hidden="true"
    >
      <path d="M15.4,9.88,10.81,5.29a1,1,0,0,0-1.41,0,1,1,0,0,0,0,1.42L14,11.29a1,1,0,0,1,0,1.42L9.4,17.29a1,1,0,0,0,1.41,1.42l4.59-4.59A3,3,0,0,0,15.4,9.88Z" />
    </svg>
  );
}

function FeatureItem({ text, extra }: { text: string; extra?: boolean }) {
  return (
    <li className={extra ? `${styles.item} ${styles.extra}` : styles.item}>
      <b className={styles.bullet}>
        <img src="/icons/bullets.svg" alt="" width={14} height={14} />
      </b>
      <p>{text}</p>
    </li>
  );
}

/**
 * Single pricing card with the live "See All Features" expander (the extra
 * features render collapsed, exactly like the captured initial state).
 */
export function PricingCard({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? `${styles.card} ${styles.cardOpen}` : styles.card}>
      <h3 className={styles.planName}>{plan.name}</h3>
      <p className={styles.price}>
        {plan.price}
        <span className={styles.per}>{plan.per}</span>
      </p>
      <p className={styles.planDesc}>{plan.description}</p>
      <div className={styles.included}>
        <h4 className={styles.includedTitle}>What&apos;s Included:</h4>
        <ul className={styles.list}>
          {plan.included.map((f) => (
            <FeatureItem key={f} text={f} />
          ))}
          {plan.extra.map((f) => (
            <FeatureItem key={f} text={f} extra />
          ))}
        </ul>
      </div>
      <div className={styles.seeAll}>
        <button
          type="button"
          className={styles.seeAllBtn}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "See Less " : "See All Features "}
          <ChevronIcon />
        </button>
      </div>
      <a href="/sign-up/" className={styles.cta}>
        {plan.cta}
      </a>
    </div>
  );
}
