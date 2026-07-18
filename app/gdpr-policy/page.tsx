import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { GdprPolicyContent } from "../../content/legal/gdpr-policy";

export const metadata: Metadata = {
  title: "GDPR Policy",
  description:
    "How Lidr.io complies with the General Data Protection Regulation — your rights, our data processing practices, and how to contact our DPO.",
  alternates: { canonical: "https://lidr.io/gdpr-policy/" },
  openGraph: {
    title: "GDPR Policy - Lidr.io",
    url: "https://lidr.io/gdpr-policy/",
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
