/**
 * Single source of truth for blog content rules. Used by the build-time
 * validator (lib/blog/validate.ts) and, in Plan 2, to generate the CMS
 * field config. Change limits here only.
 */
export const RULES = {
  title: { min: 10, max: 70 },
  description: { min: 50, max: 160 },
  tags: { min: 1, max: 3 },
  slugPattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  datePattern: /^\d{4}-\d{2}-\d{2}$/,
  imageExtensions: ["jpg", "jpeg", "png", "webp"],
  maxImageBytes: 15 * 1024 * 1024,
  excerptLength: 155,
  wordsPerMinute: 200,
} as const;
