# Visual-gate methodology fix — working state

UNTRACKED scratch spec. Do NOT commit; delete when the task is done.
Branch: `rebuild`. Task: remove harness-tuned calibration, root-cause freeze
fix, re-capture references, pass gate ×2.

## Done (committed, validated)

- [x] **84a775c** `fix(capture): high-specificity freeze selector` —
  `html:not(#\9):not(#\9):not(#\9) *` (specificity (3,0,1)) replaces the
  (0,0,0) `*` freeze in BOTH `scripts/capture/capture.mjs` settle() and
  `tests/visual/visual.spec.ts`. Empirically verified in Chromium:
  class-level `transition:.5s !important` now computes to `0s` under the
  freeze (old selector left it at 0.5s). `scripts/capture/screenshot.mjs`
  injects only scroll-behavior CSS — no freeze there, unchanged.
- [x] **3b0f07e** `revert(pricing): remove harness-calibrated timing machinery`
  - `components/PricingCards/PricingCardList.tsx`: MutationObserver on
    document.head / 768–800px deferred initial highlight / 78ms apply /
    2.5s fallback ALL DELETED. Now a plain 1:1 transcription of the live
    inline script (innerWidth>800 bail, ratios Map, maxRatio>0.3, immediate
    classList toggle, same threshold list). tsc + eslint clean.
  - `components/PricingCards/PricingCards.module.css`: fabricated
    pricing-variant `transition: 0.35s !important` REMOVED (base `.card`
    0.5s !important rule applies; live pricing.html declares the same
    0.3s-then-0.5s !important pair → later wins → 0.5s). Home `.card`
    comment rewritten with true provenance.
  - Verified: `grep -rn 'MutationObserver|deferInitial|0.35s' components/ app/` → no hits.
- [x] **f691f9a** `fix(capture): wait for lazy-loaded images to settle per chunk`
  (state-based img currentSrc/complete signature wait in captureFullPage).
  Fixed the run-3 home-tablet blur-up transient; did NOT fix features-desktop.
- [x] **10008d8** `fix(capture): stable-frame chunk shots` (screenshot until
  two consecutive frames byte-identical, max 8 retries). Did NOT fix
  features-desktop either — see diagnosis.
- [x] References re-captured 5× post-freeze-fix. Runs saved in scratchpad
  (see paths below). Old pre-fix refs for features/pricing saved too.
  Qualitative change vs old refs: pricing-mobile 15.5% / pricing-tablet
  16.9% changed — cards were frozen MID-FADE (e.g. 124,127,134 greys),
  now exact rest states (#3F444E = 63,68,78 highlighted card, pure white
  others). pricing-desktop identical (highlight is ≤800px only).

## Current capture/ state

`capture/` currently holds **run 5**, whose `features-desktop.png` has the
bottom "Download The Lidr.io App" laptop image in the WRONG (un-revealed)
state. Before the gate, either re-capture until the revealed state lands
deterministically (preferred, see fix below) or restore run 2's PNG set.

## PAUSED HERE (user request) — exact working state

- ROOT CAUSE FOUND for the bistability: the live WP theme sets
  `html { scroll-behavior: smooth }`. settle()'s programmatic scrolls
  (pre-scroll, and my new bottom-quiesce) run BEFORE any
  scroll-behavior:auto override, so every scrollTo() glides: the
  "return to top" was measured still mid-flight (scrollY≈557), and the
  first quiesce waitForFunction evaluated mid-glide (elements below the
  transient viewport are exempt) → passed early → reveal never fired →
  bistable captures. Verified on live: once revealed, the element STAYS
  revealed after scrolling back to top (AOS once:true, no re-arm on
  features desktop), so bottom-quiesce is the right fix once the scroll
  is instant.
- UNCOMMITTED working-tree changes in `scripts/capture/capture.mjs`:
  (1) settle() now injects `html{scroll-behavior:auto!important}` FIRST;
  (2) bottom-quiesce waitForFunction (added earlier, uncommitted) now
  requires `scrollY >= maxScroll - 2` before judging pending
  `[data-aos].aos-init:not(.aos-animate)` elements (AOS offset 120).
  Validate via probe before committing.
- PROBE RESULT (validated): 3× features-desktop through the patched
  settle → **1543 / 1543 / 1543 px vs run2** (identical every run —
  deterministic, and in the revealed state; the un-revealed state was
  ~66,410 px). Earlier probe WITHOUT the smooth-scroll fix gave
  66419 / 7 / 66419 (bistable) — that's what exposed the root cause.
  Probe PNGs: scratchpad/fd-settle-probe-{1,2,3}.png.
- On resume, before committing: (a) confirm the three probe PNGs are
  0 px from EACH OTHER (they were each compared only against run2);
  (b) locate the constant 1543-px delta vs run2 (likely genuine live
  drift since run2 or the sub-threshold gradient noise band — check at
  pixelmatch threshold 0.15 too). Then commit the settle() changes
  (scroll-behavior override + at-bottom quiesce guard) and proceed
  with "Remaining steps" (2 full captures, identity check, gate ×2).

## Diagnosis detail: features-desktop bistability (~66,410 px, 0.36–0.57%)

Two stable states across runs: bottom `.right__image` (laptop mockup,
`data-aos="zoom-out-up" data-aos-delay="300"`) revealed vs un-revealed.
- run1 ≡ run4 ≡ run5 ≡ probes 1–3: UN-revealed (image offset ~115px lower)
- run2 ≡ old reference: REVEALED
- Live ground truth (real stepped user scroll, no freeze, checked twice):
  settles `aos-animate`, opacity 1, no transform → **REVEALED is correct**.
- Live AOS config: `AOS.init({ once: true, disable: 'mobile' })`.
- Key probe result (3× driving the real captureFullPage against live):
  final PNG = un-revealed, but `aos-animate` IS present immediately AFTER
  capture returns → the class lands AFTER the last chunk's screenshot.
- Leading hypothesis: AOS v2 honours `data-aos-delay="300"` in **JS**
  (setTimeout before adding `aos-animate`), so the class lands ~300–400ms
  after the trigger scroll — after the stable-frame pair (150ms apart)
  already passed. Freeze CSS can't help; it's not a transition.
- Also unexplained: capture.mjs pre-scroll's `scrollTo(0,0)` leaves
  scrollY≈557–600 (scroll anchoring?), and the pre-scroll's 120ms bottom
  dwell means the bottom element usually does NOT reveal during pre-scroll.
- home-tablet r2-vs-r4 top-band "diff" (27k px @threshold 0) is sub-gate
  noise: 0 px at pixelmatch threshold 0.15. Ignore.

### Planned deterministic fix (coordinator-approved direction)

Fix the PIPELINE so state is forced deterministic, symmetrically (both
pipelines share settle-ish flow): in `capture.mjs` settle() (and mirror the
idea in the harness if needed — harness has no pre-scroll today), after the
pre-scroll, scroll to the BOTTOM and hold until reveal state quiesces
(state-based: e.g. wait until no `[data-aos]:not(.aos-animate)` whose
trigger is above max-scroll remains / or generic: viewport frame stable at
bottom with a longer confirm window), THEN return to top and chunk. With
live `once:true`, bottom-revealed persists through the chunk pass → no race.
NB: the harness side (rebuild RevealManager) is position-based + synchronous
→ already deterministic; verify rebuild reveals the DownloadCta image at
max scroll on features desktop (it passed 0.08% vs the revealed old ref, so
it does). Alternative simpler variant: lengthen pre-scroll bottom dwell into
a state-based wait. Avoid bare timing constants.

## Remaining steps

- [ ] Implement + commit the deterministic bottom-quiesce fix in settle()
      (capture.mjs). Consider whether visual.spec.ts needs the same
      (it doesn't pre-scroll; rebuild reveal is synchronous — likely no).
- [ ] Re-capture 2× (background, ~10 min each; poll output file). Verify the
      two runs pixel-identical (scratchpad/compare-runs.mjs). Check
      features-desktop matches run2/old-ref (revealed). Keep final run.
- [ ] `npm run test:visual` ×2 → need "9 passed" both times. If home/features
      drift: fix on the live-true side (RevealManager trigger/threshold vs
      live), never timing constants. If non-convergent → report BLOCKED with
      diff images.
- [ ] Final commits + report (status, qualitative ref changes, determinism
      evidence, gate results ×2, diff hunks proving 0.35s + MutationObserver
      gone [84a775c/3b0f07e diffs], any home/features adjustments, SHAs).
- [ ] Delete this file.

## Scratchpad paths (session
`/private/tmp/claude-501/-Users-conor-mullan-Documents-Lidr-io/aa1c2205-51cc-4181-8729-859f5e8ba556/scratchpad`)

- `old-refs/` — pre-fix references (features/pricing genuine; home/about
  already overwritten when snapshotted)
- `run1/ run2/ run4/ run5/` — post-fix capture runs (run3 not kept; had
  blur-up transient, superseded)
- `compare-runs.mjs` — pixel-compare two dirs (uses repo node_modules via
  createRequire; run with absolute paths)
- `fd-probe-{1,2,3}.png` — captureFullPage probes of live features desktop
- Determinism so far: 28/30 PNGs pixel-identical across runs at threshold 0;
  at gate tolerance (0.15) only features-desktop (bistable, above) and
  home-mobile (253 px, 0.009% noise) differed between run2 and run4.
