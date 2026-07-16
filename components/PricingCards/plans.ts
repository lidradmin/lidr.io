/**
 * Pricing plans, text verbatim from the live DOM
 * (capture/dom/home.html, Elementor widget a14d1eb).
 */
export type Plan = {
  name: string;
  price: string;
  per: string;
  description: string;
  included: string[];
  /** collapsed behind the "See All Features" toggle, as live */
  extra: string[];
  cta: string;
};

export const PLANS: Plan[] = [
  {
    name: "Free",
    price: "£0.00/",
    per: "forever",
    description: "Get started with basic photo management",
    included: [
      "Up to 2 projects",
      "On-device storage only",
      "Photo & video capture (date, time, GPS, location)",
      "Photo markup & tags",
      "Join shared projects as a Viewer",
    ],
    extra: ["Lidr Watermark on photos"],
    cta: "Download Now",
  },
  {
    name: "Essential",
    price: "£5.99/",
    per: "month",
    description: "For individual professionals who need more",
    included: [
      "Up to 7 projects",
      "5GB cloud storage per month",
      "Stored in-app, not your camera roll",
      "Auto-sync to OneDrive & shared folders",
      "Photo & video capture (date, time, GPS, location)",
    ],
    extra: [
      "Photo markup & tags",
      "Add titles & descriptions to images",
      "PDF report generation",
      "Share photos or reports by link",
      "Watermark-free images",
      "AI-powered chatbot",
      "Invite collaborators and free Viewers",
    ],
    cta: "Get 14 Days Free Trial",
  },
  {
    name: "Pro",
    price: "£7.99/",
    per: "month",
    description: "For high volume projects",
    included: [
      "Unlimited projects",
      "Unlimited cloud storage",
      "Unlimited backup",
      "Stored in-app, not your camera roll",
      "Auto-sync to OneDrive & shared folders",
      "Photo & video capture (date, time, GPS, location)",
    ],
    extra: [
      "Photo markup & tags",
      "Unlimited photos per report",
      "Share photos or reports by link",
      "Watermark-free images",
      "AI-powered chatbot",
      "Invite collaborators and free Viewers",
    ],
    cta: "Get 14 Days Free Trial",
  },
  {
    name: "Business",
    price: "Custom/",
    per: "month",
    description: "For companies managing teams",
    included: [
      "Everything in Pro, plus",
      "Business admin portal",
      "Assign subscriptions to team members",
      "Assign people to projects and manage access",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    extra: ["Custom onboarding", "Advanced analytics", "Priority API access"],
    cta: "Get 14 Days Free Trial",
  },
];
