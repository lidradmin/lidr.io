import type { Metadata } from "next";
import { LegalLayout } from "../../components/LegalLayout/LegalLayout";
import { FairUsePolicyContent } from "../../content/legal/fair-use-policy";

export const metadata: Metadata = {
  title: "Fair Use Policy",
  description:
    "Lidr.io fair use policy — guidelines for responsible use of our construction documentation platform and storage resources.",
  alternates: { canonical: "https://lidr.io/fair-use-policy/" },
  openGraph: {
    title: "Fair Use Policy - Lidr.io",
    url: "https://lidr.io/fair-use-policy/",
    type: "article",
  },
};

export default function FairUsePolicy() {
  return (
    <LegalLayout title="Fair Use Policy">
      <FairUsePolicyContent />
    </LegalLayout>
  );
}
