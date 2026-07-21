import type { Metadata } from "next";
import localFont from "next/font/local";
import "../styles/tokens.css";
import "../styles/globals.css";
import { Header } from "../components/Header/Header";
import { Footer } from "../components/Footer/Footer";
import { GoogleAnalytics } from "../components/Analytics/GoogleAnalytics";
import { CookieConsent } from "../components/CookieConsent/CookieConsent";

// Heading face. Live site loads Amenti 500 + 700 (see app/fonts/SOURCES.md);
// computed weights 300/400 also resolve to the 500 face, as on the live site.
const amenti = localFont({
  src: [
    { path: "./fonts/Amenti-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Amenti-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-amenti",
  display: "swap",
});

// Body face. Variable font (wght axis), latin subset — covers the
// 400/500/600/700 weights the live pages render.
const montserrat = localFont({
  src: [
    {
      path: "./fonts/Montserrat-Variable-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lidr.io — Construction Photo Documentation & Reporting",
    template: "%s | Lidr.io",
  },
  description:
    "Lidr.io helps construction teams capture, organise, and report on site photos with GPS tagging, annotations, and one-click PDF reports.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "msapplication-TileImage",
        url: "/favicon-270x270.png",
      },
    ],
  },
  openGraph: {
    siteName: "Lidr.io",
    locale: "en_US",
    images: [
      {
        url: "https://lidr.io/images/Group-198.webp",
        width: 2962,
        height: 4320,
        alt: "Lidr.io app screenshot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${amenti.variable} ${montserrat.variable}`}>
      <head>
        <link rel="dns-prefetch" href="https://api.web3forms.com" />
        <link rel="preconnect" href="https://api.web3forms.com" />
        <link rel="dns-prefetch" href="https://ipinfo.io" />
        <link rel="preconnect" href="https://ipinfo.io" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: "Lidr.io",
                  url: "https://lidr.io",
                  logo: "https://lidr.io/images/Group-198.webp",
                  sameAs: [
                    "https://www.facebook.com/lidr.io",
                    "https://www.linkedin.com/company/lidr-io",
                    "https://www.tiktok.com/@lidr.io",
                  ],
                },
                {
                  "@type": "WebSite",
                  name: "Lidr.io",
                  url: "https://lidr.io",
                },
                {
                  "@type": "SoftwareApplication",
                  name: "Lidr.io",
                  operatingSystem: "iOS, Android",
                  applicationCategory: "BusinessApplication",
                  offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "GBP",
                  },
                  downloadUrl: "https://apps.apple.com/app/id6759912615",
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        <GoogleAnalytics />
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <CookieConsent />
      </body>
    </html>
  );
}
