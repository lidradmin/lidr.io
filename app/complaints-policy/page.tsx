import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { ComplaintsPolicyContent } from "../../content/legal/complaints-policy";

export const metadata: Metadata = {
  title: "Complaints Policy",
  description:
    "How to raise a complaint with Lidr.io — our process for handling feedback, escalation steps, and resolution timelines.",
  alternates: { canonical: "https://lidr.io/complaints-policy/" },
  openGraph: {
    title: "Complaints Policy - Lidr.io",
    url: "https://lidr.io/complaints-policy/",
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
