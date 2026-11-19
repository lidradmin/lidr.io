import type { BlogReport, Problem } from "../../lib/blog/types";

export type StrictFailure = { key: string; problem: Problem };

/**
 * Which problems make a strict (BLOG_STRICT=1) check fail.
 * Without `only`: every problem. With `only` (an author's scoped check): any
 * problem on that slug except "location" warnings (an author can't strip GPS
 * from someone's photo, so the skill tells the user instead), plus any HARD
 * problem anywhere, since that would keep the build from publishing cleanly.
 */
export function strictFailures(report: BlogReport, only?: string): StrictFailure[] {
  return Object.entries(report.problems).flatMap(([key, ps]) =>
    ps
      .filter((p) => only === undefined || p.level === "hard" || (key === only && p.field !== "location"))
      .map((problem) => ({ key, problem }))
  );
}

/** Split a report into the scoped slug's problems and everyone else's. */
export function splitForSlug(report: BlogReport, only: string): { yours: BlogReport; notYours: BlogReport } {
  const yours: BlogReport = { problems: {} };
  const notYours: BlogReport = { problems: {} };
  for (const [key, ps] of Object.entries(report.problems)) (key === only ? yours : notYours).problems[key] = ps;
  return { yours, notYours };
}
