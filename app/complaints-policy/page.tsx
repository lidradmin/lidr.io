import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { ComplaintsPolicyContent } from "../../content/legal/complaints-policy";

export const metadata: Metadata = {
  title: "Complaints Policy - Lidr.io",
};

export default function ComplaintsPolicy() {
  return (
    <LegalLayout title="Complaints Policy">
      <ComplaintsPolicyContent />
    </LegalLayout>
  );
}
