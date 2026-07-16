import { REVIEWS, type Review } from "../Testimonials/reviews";

/**
 * Features-page review cards (capture/dom/features.html, widget 90bebe7).
 * Same people, quotes and photos as the home carousel, but the live
 * features page credits DIFFERENT companies — roles verbatim below.
 */
const FEATURES_ROLES: Record<string, string> = {
  "Sarah Jenkins": "Project Director, Apex Build Group",
  "David Vance": "CEO, Vanguard Infrastructure",
  "Elena Rostova": "Operations Manager, Horizon Edge",
  "Marcus Thorne": "Lead Surveyor, Thorne Consulting",
  "Carlos Mendez": "VP of Construction",
  "Rachel Choi": "Site Superintendent, Matrix",
  "Jameson Blake": "CTO, BuildTech Global",
};

export const FEATURES_REVIEWS: Review[] = REVIEWS.map((r) => ({
  ...r,
  role: FEATURES_ROLES[r.name],
}));
