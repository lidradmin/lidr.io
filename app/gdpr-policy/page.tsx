import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { GdprPolicyContent } from "../../content/legal/gdpr-policy";

export const metadata: Metadata = {
  title: "GDPR Policy - Lidr.io",
  alternates: { canonical: "https://lidr.io/gdpr-policy/" },
  openGraph: {
    title: "GDPR Policy - Lidr.io",
    url: "https://lidr.io/gdpr-policy/",
    siteName: "Lidr.io",
    locale: "en_US",
    type: "article",
  },
};

export default function GdprPolicy() {
  return (
    <LegalLayout title="GDPR Policy">
      <GdprPolicyContent />
    </LegalLayout>
  );
}
