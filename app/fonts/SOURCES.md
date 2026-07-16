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

## Google Fonts (Mulish, Inter, Inter Tight, Lora, Montserrat) — OFL

The live site loads these dynamically via Google Fonts `@import`/`<link>`
(`fonts.googleapis.com/css2?family=...`), which in turn references
`fonts.gstatic.com` font binaries. All Google Fonts are licensed under the
SIL Open Font License (OFL) — free to self-host and redistribute.

None of these were copied into `app/fonts/` in this task. During capture,
the only font binaries actually requested for these families came back as
plain `.ttf` (not `.woff2`) from `fonts.gstatic.com` — an artifact of the
capture browser's format negotiation, not a reflection of what Google
actually serves modern browsers (Google Fonts serve woff2 as the primary
format). Rather than harvest and hand-manage stale/incorrectly-negotiated
`.ttf` copies, the recommended path for later tasks is to self-host these
via `next/font/google`, which fetches the correct woff2 subsets at build
time and inlines them with zero runtime request to Google. See
`capture/raw-assets/*.ttf` (gitignored) if a manual reference copy of the
Montserrat/Lora glyphs-as-requested is ever needed for comparison.

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
