# Lidr.io

Pixel-perfect static rebuild of [lidr.io](https://lidr.io) — WordPress to Next.js App Router with `output: 'export'`.

## Quick start

```bash
npm install
npm run dev          # dev server on localhost:3000
npm run build        # static export to out/
```

## Verification

```bash
npm run build                              # build static export
npm run test:visual                        # 30 visual pixel-diff tests (10 pages x 3 breakpoints)
npx playwright test                        # a11y, functional, contact-form (3 browsers)
node scripts/crawl-compare.mjs             # URL crawl: live vs static build
npx lhci autorun                           # Lighthouse CI gates
```

### Visual testing

Reference screenshots live in `capture/screens/` (gitignored). To regenerate:

```bash
npm run build
node scripts/capture/capture-screens.mjs   # re-capture from local build
npm run test:visual                        # should be 30/30 pass
```

## Pages

| Path | Title |
|------|-------|
| `/` | Smart, Scalable Solutions to Simplify Your Workflow |
| `/about/` | About |
| `/features/` | Features |
| `/pricing/` | Pricing |
| `/contact-us/` | Contact Us |
| `/privacy-policy/` | Privacy Policy |
| `/gdpr-policy/` | GDPR Policy |
| `/terms-of-service/` | Terms of Service |
| `/fair-use-policy/` | Fair Use Policy |
| `/complaints-policy/` | Complaints Policy |

## Contact form

Uses [Web3Forms](https://web3forms.com/). Replace the placeholder access key in `components/ContactForm/ContactForm.tsx`:

```
REPLACE_WITH_REAL_ACCESS_KEY
```

## Deploy

### Vercel

`vercel.json` includes 301 redirects for `/sign-up/` to `/`.

### Netlify / Cloudflare Pages

`public/_redirects` provides the same 301 redirects.

## Post-cutover checklist

- [ ] Replace Web3Forms access key placeholder
- [ ] Update Google Search Console with new sitemap URL
- [ ] Submit `sitemap.xml` to search engines
- [ ] Verify Amenti font license covers production use
- [ ] Configure custom domain DNS
- [ ] Set up SSL certificate (auto on Vercel/Netlify)
- [ ] Monitor 404s after launch for any missed redirects

## Stack

- Next.js 16 (App Router, Turbopack, static export)
- CSS Modules with design tokens (`styles/tokens.css`)
- Playwright for visual regression, a11y, and functional testing
- Lighthouse CI for performance gates
