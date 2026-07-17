import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { TermsOfServiceContent } from "../../content/legal/terms-of-service";

export const metadata: Metadata = {
  title: "Lidr Terms of Service - User Agreement and Policies",
  description:
    "Lidr terms of service. Covers subscriptions, data backups, user content ownership, liability limitations, and your rights.",
  alternates: { canonical: "https://lidr.io/terms-of-service/" },
  openGraph: {
    title: "Lidr Terms of Service - User Agreement and Policies",
    description:
      "Lidr terms of service. Covers subscriptions, data backups, user content ownership, liability limitations, and your rights.",
    url: "https://lidr.io/terms-of-service/",
    siteName: "Lidr.io",
    locale: "en_US",
    type: "article",
  },
};

export default function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service">
      <TermsOfServiceContent />
    </LegalLayout>
  );
}
