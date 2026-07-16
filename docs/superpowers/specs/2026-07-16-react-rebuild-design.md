# Lidr.io — WordPress → React Rebuild Design

**Date:** 2026-07-16
**Status:** Approved approach A (clean rebuild from live ground truth), refined per review

## Goal

Replace the WordPress/Elementor site at lidr.io with a static React app that is
visually identical to the current live site, with none of the WordPress/Elementor
bloat. The live site (not the SiteGround export's database) is the ground truth,
since it serves the fully rendered output.

## Definition of "pixel-perfect"

Matching the rendered output of the live site within acceptable browser rendering
differences (sub-pixel font rendering, anti-aliasing, OS-specific font hinting),
verified by Playwright screenshot comparison at three breakpoints:

- Desktop: 1440px
- Tablet: 768px
- Mobile: 390px

All three breakpoints are in scope — mobile and tablet layouts (including the
mobile nav/hamburger menu) must match, not just desktop.

## Scope

### Pages (10) — URLs identical to WordPress, trailing slashes preserved

| Route | Source page |
|---|---|
| `/` | Home (Home 2026) |
| `/about/` | About |
| `/features/` | Features |
| `/pricing/` | Pricing |
| `/contact-us/` | Contact |
| `/privacy-policy/` | Privacy |
| `/gdpr-policy/` | GDPR |
| `/terms-of-service/` | Terms |
| `/fair-use-policy/` | Fair Use Policy |
| `/complaints-policy/` | Complaints Policy |

Plus a custom 404 page.

**Sign Up (`/sign-up/`) is dropped entirely** — removed from nav and not rebuilt.

### Out of scope

- WordPress admin, blog/feed endpoints, xmlrpc, wp-json
- Multilingual (wpLingua is installed but emits nothing on the live site)
- `/delete-account` and other stray files in the export

## Stack

- **Next.js (App Router)** with `output: 'export'` — every page pre-rendered to
  static HTML. TypeScript.
- **CSS Modules** per component + `styles/tokens.css` (design tokens as CSS
  custom properties) + `styles/globals.css` (reset, base typography). No
  Tailwind, no CSS-in-JS runtime.
- **Hosting:** host-agnostic static output; target Vercel/Netlify/Cloudflare
  Pages.

## Project structure

```
app/
  layout.tsx            # root layout: fonts, Header, Footer, skip link
  page.tsx              # Home
  about/page.tsx
  features/page.tsx
  pricing/page.tsx
  contact-us/page.tsx
  privacy-policy/page.tsx
  gdpr-policy/page.tsx
  terms-of-service/page.tsx
  fair-use-policy/page.tsx
  complaints-policy/page.tsx
  not-found.tsx
components/
  Header/               # nav + mobile menu
  Footer/
  Hero/
  CTA/
  FeatureCard/
  PricingCard/
  Button/
  ContactForm/
  LegalLayout/          # shared UI shell for the 5 policy pages
  ...                   # further shared sections as repetition emerges
content/
  legal/                # policy page text as content modules, not UI
    privacy.tsx
    gdpr.tsx
    terms.tsx
    fair-use.tsx
    complaints.tsx
styles/
  tokens.css
  globals.css
public/
  images/
  fonts/
  icons/
lib/
  seo.ts                # per-page metadata + JSON-LD builders
```

Each component: one directory, `ComponentName.tsx` + `ComponentName.module.css`.
**Clean, semantic class names throughout** — no Elementor class names
(`elementor-widget-*`, `e-con-*`, etc.) survive into the rebuild.

Legal pages are **content, not UI**: the policy text lives in `content/legal/`
modules rendered through the single `LegalLayout` shell — not baked into
components.

**Client/server component policy:** server components by default; `"use
client"` only where interaction requires it — the mobile menu toggle and the
contact form. Everything else ships as static HTML with minimal runtime JS.

## Method

1. **Capture ground truth.** For each of the 10 pages: full-page Playwright
   screenshots at all 3 breakpoints, a **serialized DOM snapshot taken after
   hydration and network idle** (some Elementor elements are JS-initialized),
   and the asset list actually requested (images, fonts, icons) **captured from
   production responses and verified against rendered usage** — not assumed to
   live under `/uploads`. Also crawl the live site to build a full URL
   inventory (pages, assets, canonicals). Stored in a `capture/` working
   directory (gitignored, kept for the duration of the project).
2. **Extract design tokens.** Read the live CSS to derive the token set: color
   palette, font families/sizes/weights/line-heights, spacing scale, radii,
   shadows, breakpoints. Computed styles are used **only to determine values**,
   which are then normalized into a logical scale (e.g. 53px/51px quirks become
   `--space-*: 56px` where visually equivalent) — we do not copy computed CSS
   verbatim, and Elementor's spacing quirks are deliberately regularized where
   the visual difference is imperceptible.
3. **Build shared shell** (tokens, globals, Header, Footer, layout), verify
   against captures.
4. **Build pages** one at a time: Home → Features → Pricing → About → Contact →
   5 legal pages (shared `LegalPage` shell).
5. **Verify.** Playwright compares rebuild vs. live captures per page per
   breakpoint; iterate until differences fall within the pixel-perfect
   definition above.

## Assets

- **Images:** only those actually used by the 10 pages, pulled from the live
  site/uploads. Pre-optimized at build-prep time with `sharp`: large JPEG/PNG →
  WebP (AVIF where it wins meaningfully), responsive sizes via
  `<picture>`/`srcset`, explicit `width`/`height` to prevent CLS. Note: Next
  `<Image>` does **not** optimize at build time under `output: 'export'`, so we
  pre-generate variants and use plain `<img>`/`<picture>`.
- **LCP:** LCP assets are identified through Lighthouse traces per page and
  **only confirmed LCP assets are selectively preloaded** (guessed preloads can
  compete with HTML/CSS downloads). LCP images are never lazy-loaded;
  below-fold images use `loading="lazy"`.
- **Fonts:** self-hosted, loaded exclusively via **`next/font/local`** for all
  fonts (automatic preload handling, no FOIT/FOUT, integrates with Next
  metadata — no hand-rolled `@font-face`, no mixed approaches). Amenti from the
  WP export; Google fonts (Manrope, DM Serif Text, Inter, and any others
  actually rendered) downloaded as woff2 and subset where safe. Only fonts
  critical above the fold are preloaded. Zero third-party font requests.
- Favicon set reproduced from the current site.
- **Licensing:** confirm usage rights for all migrated assets — stock
  photography, illustrations, icons, and fonts (Google fonts are OFL; **Amenti
  is a commercial font — owner to confirm the license permits self-hosted web
  embedding**). Flag anything unverifiable before launch.

## Contact form

Same visual form as the current FluentForm. Wired to **Web3Forms** (free tier,
no branding on submissions), scaffolded with a placeholder access key for the
owner to swap in. Swapping to Formspree later is a one-component change. Client-side validation matching current fields, accessible error
messages, success/failure states. No backend.

**Spam protection:** invisible honeypot field (Web3Forms `botcheck`) by
default. If spam volume warrants it post-launch, escalate to Cloudflare
Turnstile (natively supported by Web3Forms) — invisible, no user friction.

## SEO — parity checklist (per page)

- `<title>` and meta description — copied from current Yoast output
- Canonical URL
- Open Graph: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`,
  `og:locale`, `og:site_name`
- `twitter:card`
- **JSON-LD structured data** — reproduce the Yoast schema graph equivalents
  (WebSite, Organization, WebPage) via `lib/seo.ts`
- `sitemap.xml` and `robots.txt` generated in the static output

### Audited facts (2026-07-16, live site + export)

- **Analytics: none.** No GA/GTM/Plausible/Fathom/Meta/LinkedIn/Hotjar on the
  live site. Nothing to migrate. (Owner can add later; keep it out of scope.)
- **Cookie consent: none.** No consent plugin installed, none in output. The
  site sets no tracking cookies, and the rebuild adds none, so no banner is
  required. Nothing to migrate.
- **Search Console/Bing verification: no meta tags** in the HTML — ownership is
  DNS- or file-based. Domain is unchanged, so verification survives; flag to
  owner to confirm after cutover.
- **Redirects: none custom.** `.htaccess` contains only stock WordPress + HTTPS
  rules. URL parity (including trailing slashes) means no redirect map is
  needed. `/sign-up/` is dropped per owner decision; because the URL may live
  on in old emails, backlinks, browser history, and search indexes, the deploy
  config ships a **permanent 301 `/sign-up/ → /`** (host-level redirect rule)
  rather than a 404. Owner may downgrade this to an intentional 404 if
  preferred.

## Accessibility (explicit deliverable)

- Semantic landmarks: `header`, `nav`, `main`, `footer`; one `h1` per page,
  logical heading hierarchy (fixing Elementor's heading soup where present —
  visual appearance unchanged)
- Skip-to-content link
- Full keyboard navigation incl. mobile menu (focus trap, Escape to close)
- Visible focus states
- `aria-label`s on icon-only controls; `aria-expanded` on the menu toggle
- Meaningful `alt` text on content images, empty `alt` on decorative ones
- Form inputs with associated `<label>`s and announced validation errors
- Color contrast audited; where the current design fails WCAG AA, flag it
  rather than silently change it

## Performance targets (measured on the static build, Lighthouse)

- Performance ≥ 95
- Accessibility = 100
- Best Practices = 100
- SEO = 100

## Error handling

- Contact form: network/service failure shows an inline, accessible error with
  a fallback `mailto:` link; success shows confirmation state.
- 404 page styled to match the site.

## Testing / verification

1. **Visual:** Playwright screenshot diff, rebuild vs. live capture, 10 pages ×
   3 breakpoints. **Pass thresholds:** pixel difference < 1% of page area; no
   structural differences (missing/moved elements); differences attributable to
   font anti-aliasing/hinting resolved by manual review, not by loosening the
   threshold.
2. **Browser matrix:** Chromium is the primary engine for pixel diffing (same
   engine for live capture and rebuild, so diffs measure our work, not engine
   variance). Firefox and WebKit each get a functional pass plus manual visual
   spot-check of every page at all 3 breakpoints — watching flexbox, font,
   form-control, and SVG rendering differences.
3. **URL crawl comparison:** crawl the live site (pre-launch) and the static
   build, diff the URL inventories — missing pages, broken assets, unexpected
   URLs, canonical mismatches. Catches what screenshots can't.
4. **Functional:** nav links, mobile menu open/close, contact form validation
   and submission (mocked service), all internal links resolve.
5. **Quality gates:** Lighthouse CI against the targets above; `next build`
   with zero type errors.

## Acceptance criteria

- All 10 pages visually match live site at 3 breakpoints per the pixel-perfect
  definition and thresholds above
- Zero Elementor/WordPress artifacts in the codebase or shipped output — no
  Elementor **class names, CSS selectors, JS dependencies, inline styles, or
  DOM structure**
- Static export deploys as plain files; no server required
- SEO parity checklist complete for every page; URL crawl comparison clean
- Lighthouse targets met
- Contact form works end-to-end with a real service key, honeypot active
- `/sign-up/ → /` 301 present in deploy config
- Asset licensing confirmed (or flagged) for everything shipped
