"use client";

import { useEffect } from "react";

const APP_STORE = "https://apps.apple.com/app/id6759912615";
const PLAY_STORE =
  "https://play.google.com/store/apps/details?id=io.lidr.app";

export default function DownloadRedirect() {
  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) {
      window.location.replace(APP_STORE);
    } else if (/Android/i.test(ua)) {
      window.location.replace(PLAY_STORE);
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <h1 style={{ marginBottom: "24px" }}>Download Lidr.io</h1>
      <p style={{ marginBottom: "32px", maxWidth: "480px" }}>
        Choose your platform to get started with Lidr.io — construction photo
        documentation made simple.
      </p>
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
        <a href={APP_STORE}>
          <img
            src="/icons/Apple-Pay.svg"
            alt="Download on the App Store"
            width={179}
            height={62}
          />
        </a>
        <a href={PLAY_STORE}>
          <img
            src="/icons/Google-Pay.svg"
            alt="Get it on Google Play"
            width={208}
            height={62}
          />
        </a>
      </div>
    </div>
  );
}
