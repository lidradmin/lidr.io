"use client";

import { useEffect, useState } from "react";
import styles from "./CookieConsent.module.css";

type Consent = "pending" | "accepted" | "declined";

export function CookieConsent() {
  const [consent, setConsent] = useState<Consent>("accepted");

  useEffect(() => {
    const stored = localStorage.getItem("cookie-consent");
    if (stored === "accepted" || stored === "declined") {
      setConsent(stored);
    } else {
      setConsent("pending");
    }
  }, []);

  function respond(value: "accepted" | "declined") {
    localStorage.setItem("cookie-consent", value);
    setConsent(value);
    window.dispatchEvent(new Event("cookie-consent-change"));
  }

  if (consent !== "pending") return null;

  return (
    <div className={styles.banner} role="region" aria-label="Cookie consent">
      <div className={styles.inner}>
        <p className={styles.text}>
          We use cookies to analyse site traffic and improve your experience. By
          clicking &ldquo;Accept&rdquo;, you consent to our use of analytics
          cookies. See our{" "}
          <a href="/gdpr-policy">GDPR Policy</a> for details.
        </p>
        <div className={styles.buttons}>
          <button
            className={styles.accept}
            onClick={() => respond("accepted")}
          >
            Accept
          </button>
          <button
            className={styles.decline}
            onClick={() => respond("declined")}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
