import type { Metadata } from "next";
import localFont from "next/font/local";
import "../styles/tokens.css";
import "../styles/globals.css";

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
  title: "Lidr.io",
  description: "Lidr.io",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${amenti.variable} ${montserrat.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
