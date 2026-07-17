/**
 * Pricing-page FAQ, text verbatim from the live DOM
 * (capture/dom/pricing.html, section#lidr-faq-section).
 * The first item is open in the captured initial state.
 */
export type FaqEntry = { question: string; answer: string };

export const FAQS: FaqEntry[] = [
  {
    question: "How is your pricing structured?",
    answer:
      "Our pricing is feature-based, meaning you pay only for the tools and services you actually use. There are no hidden fees or mandatory add-ons.",
  },
  {
    question: "Do you offer a free trial?",
    answer:
      "Yes — every new account gets a 14-day free trial with full access to all features. No credit card required to get started.",
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer:
      "Absolutely. You can change your plan at any time from your account settings. Changes take effect at the start of your next billing cycle.",
  },
  {
    question: "Are there any hidden costs?",
    answer:
      "None. The price you see is the price you pay. We never charge for onboarding, customer support, or feature updates.",
  },
  {
    question: "Can multiple users share one account?",
    answer:
      "Team plans support multiple seats with role-based access. Each member gets their own login while sharing the same workspace and projects.",
  },
  {
    question: "Do you offer discounts for annual payments?",
    answer:
      "Yes, annual billing saves you up to 20% compared to monthly. You can switch to annual billing from the billing section of your dashboard.",
  },
  {
    question: "What happens if I stop using the service?",
    answer:
      "You can cancel anytime. Your data remains accessible for 30 days after cancellation, giving you time to export everything before it's removed.",
  },
];
