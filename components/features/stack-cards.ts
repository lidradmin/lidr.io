/**
 * "Clarity From Every Capture" sticky-stack cards, text verbatim from the
 * live DOM (capture/dom/features.html, section#cfcSection — 8 cfc-card
 * articles). Image basenames map the live Shopify CDN files to
 * public/images (natural dimensions from the local webp files).
 */
export type StackCard = {
  title: string;
  desc: string;
  bullets: string[];
  /** public/images basename */
  img: string;
  w: number;
  h: number;
};

export const STACK_CARDS: StackCard[] = [
  {
    title: "Every Photo Time-Stamped",
    desc: "Keep photos, videos, and notes organized by project and stage. Helping your team work faster, stay compliant, and deliver confident updates to clients and stakeholders.",
    bullets: [
      "Automatic date, time & GPS on every photo",
      "Undeniable proof for inspections & claims",
      "Watermark-free images on paid plans",
      "Capture via in-app camera with location pin",
    ],
    img: "Group_171_1",
    w: 311,
    h: 614,
  },
  {
    title: "A Gallery For Every Project",
    desc: "Capture site images with automatic location and timestamp. All photos are stored in-app — not your camera roll — and sorted by project and stage automatically.",
    bullets: [
      "Project-based photo organisation",
      "Visual timeline of site progress",
      "Up to unlimited cloud storage on Pro",
      "Searchable & accessible from day one",
    ],
    img: "gridm1",
    w: 321,
    h: 609,
  },
  {
    title: "Mark Up Any Image",
    desc: "Highlight, label, and draw directly on images. Snap a photo of an issue, draw an arrow, tag a priority level, and sync it to your team — streamlining your entire punch-list process.",
    bullets: [
      "Draw, highlight & annotate on photos",
      "Add titles, descriptions & tags to images",
      "Intuitive, mobile-first markup tools",
      "Sync marked-up images to team instantly",
    ],
    img: "gridm2",
    w: 322,
    h: 606,
  },
  {
    title: "Add Your Team To Any Project",
    desc: "Invite collaborators, assign tasks, track progress, and get alerts. Subcontractor accountability has never been easier — the proof of progress is right there in the data.",
    bullets: [
      "Invite team members & free Viewers",
      "Assign people to projects & manage access",
      "Track who captured, reviewed & approved",
      "Real-time updates for clients & stakeholders",
    ],
    img: "gridm3",
    w: 348,
    h: 618,
  },
  {
    title: "Instant PDF Reports With Context",
    desc: "Combine photos, notes, and markups into professional reports instantly. What used to take hours of sorting and writing now happens in minutes — your clients will notice the difference.",
    bullets: [
      "One-tap professional PDF generation",
      "Unlimited photos per report on Pro",
      "Share reports securely by link",
      "Compliance-ready documentation records",
    ],
    img: "gridm4",
    w: 339,
    h: 611,
  },
  {
    title: "Every Photo Auto-Synced",
    desc: "Auto-sync to OneDrive and shared folders — your documentation is secure, organised, and searchable from day one. No more digging through folders or emails to find what you need.",
    bullets: [
      "Seamless OneDrive & shared folder sync",
      "Unlimited cloud backup on Pro plan",
      "Stored in-app, not cluttering your camera roll",
      "Integrates with your existing tools & platforms",
    ],
    img: "gridm5",
    w: 318,
    h: 614,
  },
  {
    title: "AI That Finds Everything",
    desc: "Ask questions, get guidance, and interpret project data instantly with Lidr's AI Project Assistant. Reduce disputes, resolve variations, and stay on top of every project detail.",
    bullets: [
      "AI-powered project chatbot & assistant",
      "Instantly locate any photo or report",
      "Interpret & summarise project data",
      "Available on Essential & Pro plans",
    ],
    img: "gridm6",
    w: 311,
    h: 614,
  },
  {
    title: "No Signal No Problem",
    desc: "Works seamlessly offline on remote sites — capture pinpoint coordinates and generate professional PDF reports even without a connection. Everything syncs the moment you're back online.",
    bullets: [
      "Full offline mode for remote job sites",
      "GPS coordinates captured without signal",
      "Auto-syncs when connection is restored",
      "Reliable documentation anywhere on site",
    ],
    img: "gridm7",
    w: 350,
    h: 618,
  },
];
