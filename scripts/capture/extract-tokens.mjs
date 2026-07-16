/**
 * extract-tokens.mjs — reads computed styles from the live site for
 * representative elements and writes capture/tokens-report.json.
 *
 * The report INFORMS styles/tokens.css; values are normalized there,
 * never copied verbatim (e.g. Elementor 53px/51px paddings become one
 * logical token where visually equivalent).
 *
 * Extensions beyond the base spec:
 *  - samples several pages (home under-represents h3/tables/forms)
 *  - per-page container widths (main content column)
 *  - rendered font-family usage census (which families/weights/sizes
 *    actually paint visible text, with example text + element counts)
 *  - link color, section vertical paddings, common border-radii/shadows
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const PAGES = [
  { slug: "home", url: "https://lidr.io/" },
  { slug: "about", url: "https://lidr.io/about/" },
  { slug: "features", url: "https://lidr.io/features/" },
  { slug: "pricing", url: "https://lidr.io/pricing/" },
  { slug: "contact-us", url: "https://lidr.io/contact-us/" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const report = { pages: {}, fontCensus: {}, colorsUsed: {} };

for (const { slug, url } of PAGES) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  // let lazy CSS/fonts settle
  await page.waitForTimeout(1500);

  const pageReport = await page.evaluate(() => {
    const pick = (el, props) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const out = Object.fromEntries(
        props.map((p) => [p, cs.getPropertyValue(p)])
      );
      out._text = (el.textContent || "").trim().slice(0, 60);
      out._sel =
        el.tagName.toLowerCase() +
        (el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "");
      return out;
    };
    const typo = [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "letter-spacing",
      "color",
    ];
    const box = [
      "background-color",
      "border-radius",
      "box-shadow",
      "padding",
      "border",
    ];

    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
    };
    const hasOwnText = (el) =>
      [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 0
      );

    // ---- colors used (visible elements only) ----
    const colors = new Set();
    document.querySelectorAll("body *").forEach((el) => {
      if (!visible(el)) return;
      const cs = getComputedStyle(el);
      [cs.color, cs.backgroundColor, cs.borderTopColor].forEach((c) => {
        if (c && c !== "rgba(0, 0, 0, 0)") colors.add(c);
      });
    });

    // ---- rendered font census: family/size/weight of visible text ----
    const census = {};
    document.querySelectorAll("body *").forEach((el) => {
      if (!visible(el) || !hasOwnText(el)) return;
      const cs = getComputedStyle(el);
      const key = `${cs.fontFamily} | ${cs.fontWeight} | ${cs.fontSize}`;
      if (!census[key]) census[key] = { count: 0, examples: [] };
      census[key].count++;
      if (census[key].examples.length < 2) {
        const t = (el.textContent || "").trim().slice(0, 40);
        census[key].examples.push(`<${el.tagName.toLowerCase()}> ${t}`);
      }
    });

    // ---- representative elements ----
    const firstVisible = (sel) =>
      [...document.querySelectorAll(sel)].find((el) => visible(el)) || null;

    const buttons = [...document.querySelectorAll(
      'a[class*="button"], button, .elementor-button, .ct-button, [class*="btn"]'
    )]
      .filter(visible)
      .slice(0, 4)
      .map((el) => pick(el, [...typo, ...box]));

    // ---- container widths: widest repeated content-column widths ----
    const widthTally = {};
    document
      .querySelectorAll(
        ".e-con, .e-con-inner, .elementor-container, .ct-container, .entry-content > *, main > *, [class*='container']"
      )
      .forEach((el) => {
        if (!visible(el)) return;
        const w = Math.round(el.getBoundingClientRect().width);
        if (w > 600 && w < 1440) widthTally[w] = (widthTally[w] || 0) + 1;
      });

    // ---- section vertical paddings (top-level sections) ----
    const sectionPads = {};
    document
      .querySelectorAll("section, .e-con.e-parent, .elementor-section, [data-elementor-type] > .e-con")
      .forEach((el) => {
        if (!visible(el)) return;
        const cs = getComputedStyle(el);
        const key = `${cs.paddingTop} / ${cs.paddingBottom}`;
        sectionPads[key] = (sectionPads[key] || 0) + 1;
      });

    // ---- radii & shadows in use ----
    const radii = {};
    const shadows = {};
    document.querySelectorAll("body *").forEach((el) => {
      if (!visible(el)) return;
      const cs = getComputedStyle(el);
      if (cs.borderRadius && cs.borderRadius !== "0px")
        radii[cs.borderRadius] = (radii[cs.borderRadius] || 0) + 1;
      if (cs.boxShadow && cs.boxShadow !== "none")
        shadows[cs.boxShadow] = (shadows[cs.boxShadow] || 0) + 1;
    });

    return {
      body: pick(document.body, typo),
      h1: pick(firstVisible("h1"), typo),
      h2: pick(firstVisible("h2"), typo),
      h3: pick(firstVisible("h3"), typo),
      h4: pick(firstVisible("h4"), typo),
      h5: pick(firstVisible("h5"), typo),
      h6: pick(firstVisible("h6"), typo),
      p: pick(firstVisible("main p, .entry-content p, p"), typo),
      a: pick(firstVisible("main p a, .entry-content a, nav a"), typo),
      li: pick(firstVisible("main li, .entry-content li"), typo),
      buttons,
      containerWidths: Object.fromEntries(
        Object.entries(widthTally).sort((a, b) => b[1] - a[1]).slice(0, 10)
      ),
      sectionPaddings: Object.fromEntries(
        Object.entries(sectionPads).sort((a, b) => b[1] - a[1]).slice(0, 12)
      ),
      radii: Object.fromEntries(
        Object.entries(radii).sort((a, b) => b[1] - a[1]).slice(0, 12)
      ),
      shadows: Object.fromEntries(
        Object.entries(shadows).sort((a, b) => b[1] - a[1]).slice(0, 8)
      ),
      colorsUsed: [...colors],
      fontCensus: Object.fromEntries(
        Object.entries(census).sort((a, b) => b[1].count - a[1].count)
      ),
    };
  });

  // merge global tallies
  pageReport.colorsUsed.forEach((c) => {
    report.colorsUsed[c] = (report.colorsUsed[c] || 0) + 1;
  });
  for (const [k, v] of Object.entries(pageReport.fontCensus)) {
    if (!report.fontCensus[k]) report.fontCensus[k] = { count: 0, examples: [] };
    report.fontCensus[k].count += v.count;
    for (const ex of v.examples)
      if (report.fontCensus[k].examples.length < 3)
        report.fontCensus[k].examples.push(`[${slug}] ${ex}`);
  }
  delete pageReport.fontCensus;
  delete pageReport.colorsUsed;
  report.pages[slug] = pageReport;
  console.log(`sampled ${slug}`);
}

report.fontCensus = Object.fromEntries(
  Object.entries(report.fontCensus).sort((a, b) => b[1].count - a[1].count)
);
report.colorsUsed = Object.fromEntries(
  Object.entries(report.colorsUsed).sort((a, b) => b[1] - a[1])
);

mkdirSync("capture", { recursive: true });
writeFileSync("capture/tokens-report.json", JSON.stringify(report, null, 2));
console.log("tokens report written to capture/tokens-report.json");
await browser.close();
