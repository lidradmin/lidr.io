import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { ComplaintsPolicyContent } from "../../content/legal/complaints-policy";

export const metadata: Metadata = {
  title: "Complaints Policy - Lidr.io",
  alternates: { canonical: "https://lidr.io/complaints-policy/" },
  openGraph: {
    title: "Complaints Policy - Lidr.io",
    url: "https://lidr.io/complaints-policy/",
    siteName: "Lidr.io",
    locale: "en_US",
    type: "article",
  },
};

export default function ComplaintsPolicy() {
  return (
    <LegalLayout title="Complaints Policy">
      <ComplaintsPolicyContent />
    </LegalLayout>
  );
}
