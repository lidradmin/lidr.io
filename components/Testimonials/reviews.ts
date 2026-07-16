/**
 * Testimonial cards, text verbatim from the live DOM
 * (capture/dom/home.html, Elementor widget 24f904c).
 */
export type Review = {
  quote: string;
  name: string;
  role: string;
  /** public/images basename */
  img: string;
  w: number;
  h: number;
};

export const REVIEWS: Review[] = [
  {
    quote:
      "We used to waste hours trying to map photos back to specific site locations. Now, the automated geolocation tags do all the heavy lifting for us. It's saved our field engineers countless headaches.",
    name: "Sarah Jenkins",
    role: "Project Director, Ridgeline Developments",
    img: "females-1-modified",
    w: 533,
    h: 533,
  },
  {
    quote:
      "For insurance compliance and dispute resolution, this tool is pure gold. Having undeniable proof of date, time, and location stamped directly on our audit photos has protected us from three false claims this quarter alone.",
    name: "David Vance",
    role: "CEO, Northgate Civil Engineering",
    img: "males-1-modified",
    w: 406,
    h: 406,
  },
  {
    quote:
      "The transition from field capture to office reporting used to be a messy bottleneck. With everything instantly organized by project and stage, our stakeholders stay updated in real-time.",
    name: "Elena Rostova",
    role: "Operations Manager, Clearwater Projects",
    img: "females-2-modified",
    w: 533,
    h: 533,
  },
  {
    quote:
      "As a solo inspector, efficiency is everything. This app works seamlessly offline on remote sites, captures pinpoint coordinates, and generates professional PDF reports before I even get back to my truck.",
    name: "Marcus Thorne",
    role: "Lead Surveyor, Bridgepoint Associates",
    img: "males-2-modified",
    w: 312,
    h: 312,
  },
  {
    quote:
      "Subcontractor accountability has completely turned around since we deployed this across our teams. No more 'he said, she said' regarding progress milestone completions—the proof is right there in the data.",
    name: "Carlos Mendez",
    role: "VP of Construction, Sterling Site Services",
    img: "males-3-modified",
    w: 374,
    h: 374,
  },
  {
    quote:
      "The markup tool is incredibly intuitive. Being able to snap a photo of an issue, draw an arrow on it, tag it with a priority level, and sync it to the team instantly has streamlined our entire punch-list process.",
    name: "Rachel Choi",
    role: "Site Superintendent, Ironoak Construction",
    img: "females-3-modified",
    w: 533,
    h: 533,
  },
  {
    quote:
      "We integrated this app directly into our existing OneDrive setup, and the auto-sync feature works flawlessly. Our documentation is secure, organized, and searchable from day one.",
    name: "Jameson Blake",
    role: "CTO, Greystone Digital",
    img: "males-4-modified",
    w: 397,
    h: 397,
  },
];
