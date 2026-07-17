import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { PrivacyPolicyContent } from "../../content/legal/privacy-policy";

export const metadata: Metadata = {
  title: "Lidr Privacy Policy - How We Protect Your Data",
  description:
    "Lidr privacy policy. How we collect, use, and protect your photos, location data, and account information. EU-hosted, GDPR compliant.",
};

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy">
      <PrivacyPolicyContent />
    </LegalLayout>
  );
}
