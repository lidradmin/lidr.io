import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { PrivacyPolicyContent } from "../../content/legal/privacy-policy";

export const metadata: Metadata = {
  title: "Lidr Privacy Policy - How We Protect Your Data",
  description:
    "Lidr privacy policy. How we collect, use, and protect your photos, location data, and account information. EU-hosted, GDPR compliant.",
  alternates: { canonical: "https://lidr.io/privacy-policy/" },
  openGraph: {
    title: "Lidr Privacy Policy - How We Protect Your Data",
    description:
      "Lidr privacy policy. How we collect, use, and protect your photos, location data, and account information. EU-hosted, GDPR compliant.",
    url: "https://lidr.io/privacy-policy/",
    siteName: "Lidr.io",
    locale: "en_US",
    type: "article",
  },
};

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy">
      <PrivacyPolicyContent />
    </LegalLayout>
  );
}
