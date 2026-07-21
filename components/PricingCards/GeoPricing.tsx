"use client";

import { useEffect } from "react";
import { GEO_PRICES } from "./geo-pricing";
import styles from "./PricingCards.module.css";

export function GeoPricing() {
  useEffect(() => {
    async function detectAndApply() {
      let code = sessionStorage.getItem("lidr_country");

      if (!code) {
        try {
          const res = await fetch("https://ipinfo.io/json?token=b59177c4dec374");
          const data = await res.json();
          code = ((data.country as string) || "").trim().toUpperCase();
          if (code.length === 2 && GEO_PRICES[code]) {
            sessionStorage.setItem("lidr_country", code);
          } else {
            code = "US";
          }
        } catch {
          code = "US";
        }
      }

      const prices = GEO_PRICES[code] || GEO_PRICES["US"];
      const [essentialPrice, proPrice] = prices;
      const freePrice = essentialPrice.replace(/[\d.,\s]+$/, "") + "0.00";

      const cards = document.querySelectorAll<HTMLElement>(`.${styles.card}`);
      cards.forEach((card) => {
        const nameEl = card.querySelector<HTMLElement>(`.${styles.planName}`);
        if (!nameEl) return;
        const tier = nameEl.textContent?.trim().toLowerCase();

        let newPrice: string | null = null;
        if (tier === "free") newPrice = freePrice;
        else if (tier === "essential") newPrice = essentialPrice;
        else if (tier === "pro") newPrice = proPrice;

        if (newPrice) {
          const priceEl = card.querySelector<HTMLElement>(`.${styles.price}`);
          if (!priceEl) return;
          const perEl = priceEl.querySelector<HTMLElement>(`.${styles.per}`);
          const perHtml = perEl ? perEl.outerHTML : "";
          priceEl.innerHTML = `${newPrice}/` + perHtml;
        }
      });
    }

    detectAndApply();
  }, []);

  return null;
}
