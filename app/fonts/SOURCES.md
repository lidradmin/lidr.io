# Font sources

Self-hosted font files in this directory, where each came from, and its
license status.

> **Note on `capture/raw-assets/manifest.json`:** the URL→filename manifest
> written by `scripts/capture/harvest-assets.mjs` is an ephemeral audit
> artifact under gitignored `capture/` — it is NOT present in a fresh
> checkout. Regenerate it with `node scripts/capture/harvest-assets.mjs`
> if you need the live-URL→local-file mapping.
>
> **Image naming convention:** optimized images live at
> `public/images/<original-basename>.webp`; sources wider than 800px also
> get a `<original-basename>-half.webp` at 50% width for `srcset` use
> (see `scripts/optimize-images.mjs`).

## Amenti (commercial — flag for owner license confirmation)

| File                 | Weight | Source                                                                                   |
| -------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `Amenti-Bold.woff2`   | 700    | `https://cdn.shopify.com/s/files/1/0527/7587/8825/files/Amenti-Bold.woff2` (captured live request, `capture/assets.json` → `home`) |
| `Amenti-Medium.woff2` | 500    | `https://cdn.shopify.com/s/files/1/0527/7587/8825/files/Amenti-Medium.woff2` (captured live request, `capture/assets.json` → `home`) |

Both are under 20KB, well below the 100KB subsetting threshold, so neither
was subsetted — used as downloaded.

**License status: commercial, unconfirmed.** Amenti is not a Google/OFL font.
The live site loads it from `cdn.shopify.com` (not from lidr.io's own
WordPress export — `wp-content` on the WP export at
`/Users/conor.mullan/Downloads/allarchive/public_html/wp-content` was
searched and contains no Amenti files at all), suggesting it was purchased/
licensed separately and is currently hosted on a Shopify asset CDN unrelated
to this rebuild. **Before shipping self-hosted Amenti in production, confirm
with the site owner that the license permits self-hosting/redistribution
via the new Next.js app**, and get the original purchase/license
documentation if possible.

Locally available (not copied into this repo, but noted here in case the
owner confirms license and wants the full family added later): a complete
Amenti family (Thin/Light/Regular/Medium/Bold/Black + variable, in both
.ttf and .otf) exists at:
- `/Users/conor.mullan/Downloads/Amenti-Font/`
- `/Users/conor.mullan/Downloads/LidrBrandguides/fonts/amenti.zip`
- `/Users/conor.mullan/Downloads/Lidr Brandguides/fonts/amenti.zip`

### Coverage gap

The live site's CSS declares `@font-face` rules for **three** Amenti
weights — Black (900), Medium (500), Bold (700) — and uses
`font-family: 'Amenti', Inter, serif !important` on all headings
(`h1`–`h6`). Only Bold and Medium were actually requested by a browser
while capturing the 10 pages in scope (`capture/assets.json`), meaning no
visible heading across those pages renders at font-weight 900. Amenti
**Black (900) is therefore not self-hosted here** — no woff2 for it was
ever served during capture, so there was nothing in `capture/raw-assets/`
to collect. Amenti **Regular (400)** is also not declared as a distinct
`@font-face` src anywhere in the captured CSS (headings fall back through
the `Inter, serif` chain for weight 400), so there is no 400-weight Amenti
woff2 to harvest either.

If a later page/component needs weight 900 or 400 Amenti, pull
`Amenti-Black.woff2` from `https://cdn.shopify.com/s/files/1/0527/7587/8825/files/Amenti-Black.woff2`
directly (URL confirmed present in the site's CSS, just never fetched
during our capture), or convert `Amenti-Black.ttf`/`Amenti-Regular.ttf`
from the local brand-guide source above using a woff2 compressor
(e.g. `fonttools`'s `fonttools varLib.instancer` / `woff2_compress`, not
installed in this environment).

## Montserrat (self-hosted) — OFL

| File                              | Weights                 | Source |
| --------------------------------- | ----------------------- | ------ |
| `Montserrat-Variable-latin.woff2` | variable `wght` 100–900 | `https://fonts.gstatic.com/s/montserrat/v31/JTUSjIg1_i6t8kCHKm459WlhyyTh89Y.woff2` (latin subset, fetched 2026-07-16 via the css2 API `https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap` with a Chrome 126 User-Agent) |

**License: SIL Open Font License (OFL)** — free to self-host and
redistribute.

Montserrat is the site's true body font: the computed `body` font stack is
`Montserrat, -apple-system, system-ui, …` and the rendered-text census
(`capture/tokens-report.json` → `fontCensus`) shows Montserrat painting the
vast majority of visible body text at weights **400 / 500 / 600 / 700**.
During live capture the browser fetched exactly four Montserrat static-ttf
instances (weights 400/500/600/700 — mapped via the css2 API); the css2 API
serves a single variable woff2 covering all four for modern browsers, so
one file is hosted here. Verified in a headless browser that the file
renders distinct weights (variable axis works). Only the latin subset is
hosted — the captured pages are English-only (latin covers U+0000–00FF,
incl. `£` used on pricing).

Loaded via `next/font/local` in `app/layout.tsx` as `--font-montserrat`
(no `next/font/google`, per the no-build-time-third-party-dependency
requirement).

## Families declared but never rendered (NOT self-hosted)

The live CSS declares/imports many additional families — **Lora, Mulish,
Inter, Inter Tight, Archivo, Manrope, Oswald, EB Garamond, Clash Display,
Cabinet Grotesk, DM Serif Text…** — but `capture/assets.json` (all 10
pages × 3 viewports) shows **no font binary was ever fetched** for any of
them, and the rendered-text census across home/about/features/pricing/
contact-us found zero visible text computed to these families. A browser
only fetches a font when visible text needs it, so these families render
nothing on the pages in scope. They are deliberately **not** self-hosted.

Notes:

- **Lora**: 26 `font-family: 'Lora' !important` rules exist in inline page
  CSS, but they match no visible element — no Lora binary appears in
  `capture/assets.json` and no rendered text computes to Lora.
- **Inter**: appears in the heading fallback chain
  (`'Amenti', Inter, serif`) — kept as a fallback name in
  `--font-heading` (styles/tokens.css) but never loaded, matching live
  behavior (live also never fetches an Inter binary since Amenti always
  resolves).
- If a later task adds a page/component whose text genuinely renders one
  of these families, self-host it then (all the Google families are OFL;
  Clash Display / Cabinet Grotesk are Fontshare-licensed).

## Clash Display (Fontshare)

Loaded from `api.fontshare.com/v2/css?f[]=clash-display@...` — used
`!important` for some headings. Fontshare fonts are free for commercial
use under Fontshare's own license (not OFL, but permissive/free). Not
copied into `app/fonts/` in this task; no font binary for it appeared in
`capture/assets.json` for any of the 10 captured pages (the CSS was
requested, but by the time of capture no element on these pages actually
rendered visible text in the Clash Display family, so the browser never
fetched the underlying woff2). Flag for a later task if a page that does
use Clash Display text is added.
