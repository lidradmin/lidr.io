import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { GdprPolicyContent } from "../../content/legal/gdpr-policy";

export const metadata: Metadata = {
  title: "GDPR Policy - Lidr.io",
};

export default function GdprPolicy() {
  return (
    <LegalLayout title="GDPR Policy">
      <GdprPolicyContent />
    </LegalLayout>
  );
}
