import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { FairUsePolicyContent } from "../../content/legal/fair-use-policy";

export const metadata: Metadata = {
  title: "Fair Use Policy - Lidr.io",
};

export default function FairUsePolicy() {
  return (
    <LegalLayout title="Fair Use Policy">
      <FairUsePolicyContent />
    </LegalLayout>
  );
}
