/**
 * "Clarity From Every Capture" carousel slides. Titles verbatim from the
 * live DOM (capture/dom/home.html widgets 800f215 / 21a6ddd). The live
 * desktop and mobile carousels use different exports for two of the shots
 * (…1 suffix on desktop), preserved here. Dimensions = source pixels.
 */
export type Slide = {
  title: string;
  /** public/images basename, desktop variant */
  base: string;
  w: number;
  h: number;
  /** mobile/tablet variant, where the live site uses a different file */
  mobileBase?: string;
  mw?: number;
  mh?: number;
};

export const SLIDES: Slide[] = [
  { title: "Every Photo Time Stamped", base: "everyphototimestamped", w: 1051, h: 2071 },
  { title: "A Gallery For Every Project", base: "agalleryforeveryproject", w: 1105, h: 2070 },
  { title: "Mark Up Any Image", base: "markupanyimage", w: 1120, h: 2070 },
  { title: "Add Your Team To Any Project", base: "addyourteamtoanyproject", w: 1183, h: 2004 },
  { title: "Instant PDF Reports With Context", base: "instantpdfreportswithcontext", w: 1169, h: 2070 },
  { title: "Every Photo Auto Synced", base: "everyphotoautosynced", w: 1075, h: 2070 },
  { title: "AI That Finds Everything", base: "aithatfindseverything1", w: 1178, h: 2073 },
  { title: "No Signal No Problem", base: "nosignalnoproblem1", w: 1193, h: 2078 },
];
